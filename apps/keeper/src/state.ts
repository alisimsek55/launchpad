/// Keeper durumu ve plan taraması için saf yardımcılar (ağ/RPC bilgisi yok, tek başına test edilebilir).
/// Durum dosyası (v2): { version, scope, discoveredUpTo, active, backoff } — bkz. loadState/saveState.
///   discoveredUpTo: okunmuş en yüksek plan id'si (monoton; 0 = hiçbiri). Yeni planlar bunun üstünden keşfedilir.
///   active:         keşfedilmiş ve bakiyesi > 0 olan plan id'leri; her tur yalnız bunlar taranır.
/// Böylece maxPrice'ı hiç tutmayan eski bir canlı plan, ondan sonraki tüm bitmiş planların her turda
/// yeniden taranmasına yol açmaz (v1'in "ilk canlı planda duran imleç" sorunu).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PlanStatus = "finished" | "live" | "unknown";

export interface KeeperState {
  /// Bu id'ye kadar (dahil) tüm planlar okundu; canlı olanlar `active`'te. En düşük değer 0.
  discoveredUpTo: bigint;
  /// Bakiyesi > 0 olan bilinen planlar
  active: Set<bigint>;
  /// planId -> backoff bitiş zamanı (ms, epoch)
  backoff: Map<bigint, number>;
}

interface StateFileV1 {
  version: 1;
  scope: string;
  /// Bu id'nin altındaki tüm planlar bitmiş
  cursor: string;
  backoff: Record<string, number>;
}

interface StateFile {
  version: 2;
  /// Durumun ait olduğu vault (chainId:adres); farklıysa dosya yok sayılır (yeniden deploy / ağ değişimi)
  scope: string;
  discoveredUpTo: string;
  active: string[];
  backoff: Record<string, number>;
}

export const emptyState = (): KeeperState => ({ discoveredUpTo: 0n, active: new Set(), backoff: new Map() });

/// [from, toExclusive) aralığını en çok `size` elemanlı parçalara böler.
export function chunkIds(from: bigint, toExclusive: bigint, size: number): bigint[][] {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("size >= 1 olmalı");
  const out: bigint[][] = [];
  for (let start = from; start < toExclusive; start += BigInt(size)) {
    const end = start + BigInt(size) < toExclusive ? start + BigInt(size) : toExclusive;
    const batch: bigint[] = [];
    for (let id = start; id < end; id++) batch.push(id);
    out.push(batch);
  }
  return out;
}

/// Bir listeyi en çok `size` elemanlı parçalara böler.
export function chunkList<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("size >= 1 olmalı");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/// Bu turda keşfedilecek yeni id aralığı [from, toExclusive): discoveredUpTo'nun hemen sonrasından,
/// en çok `maxNew` id (büyük birikim birkaç tura yayılır). Plan id'leri 1'den başlar.
export function discoveryRange(discoveredUpTo: bigint, nextPlanId: bigint, maxNew: number): [bigint, bigint] {
  if (!Number.isSafeInteger(maxNew) || maxNew < 1) throw new Error("maxNew >= 1 olmalı");
  const from = discoveredUpTo + 1n;
  const cap = from + BigInt(maxNew);
  return [from, nextPlanId < cap ? nextPlanId : cap];
}

/// Keşif sonucunu duruma işler. `statuses[i]` startId+i planının durumu.
/// "live" planlar active'e eklenir. discoveredUpTo yalnızca ardışık okunmuş ("finished"/"live") id'ler
/// üzerinden ilerler: ilk "unknown"da (ör. hata veren parça) durur, böylece okunamayan plan asla atlanmaz
/// (sonraki turda yeniden okunur; tekrar okunan canlı plan Set'te zaten var).
export function applyDiscovery(state: KeeperState, startId: bigint, statuses: PlanStatus[]): void {
  let upTo = state.discoveredUpTo;
  let contiguous = upTo === startId - 1n;
  for (const [i, s] of statuses.entries()) {
    const id = startId + BigInt(i);
    if (s === "live") state.active.add(id);
    if (s === "unknown") contiguous = false;
    if (contiguous) upTo = id;
  }
  state.discoveredUpTo = upTo;
}

/// Durum vault'un güncel nextPlanId'siyle tutarlı mı? (Değilse vault değişmiştir; baştan keşfedilmeli.)
/// Not: active, discoveredUpTo'nun üstünde id içerebilir (hata veren keşif parçasından sonraki canlı planlar).
export function isConsistent(state: KeeperState, nextPlanId: bigint): boolean {
  if (state.discoveredUpTo >= nextPlanId) return false;
  for (const id of state.active) if (id < 1n || id >= nextPlanId) return false;
  return true;
}

/// Süresi dolmuş backoff kayıtlarını siler.
export function pruneBackoff(backoff: Map<bigint, number>, now: number): void {
  for (const [id, until] of backoff) if (until <= now) backoff.delete(id);
}

const ID_RE = /^[1-9]\d*$/;

function readBackoff(raw: unknown, now: number): Map<bigint, number> {
  const backoff = new Map<bigint, number>();
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (ID_RE.test(k) && typeof v === "number" && Number.isFinite(v)) backoff.set(BigInt(k), v);
    }
  }
  pruneBackoff(backoff, now);
  return backoff;
}

/// Durum dosyasını okur. Dosya yok → sessizce boş durum; bozuk/uyumsuz → uyarı + boş durum.
/// v1 dosyası uyarıyla v2'ye taşınır: v1 imlecinin altındaki tüm planlar bitmiş olduğundan
/// discoveredUpTo = cursor - 1, active boş (imleçten itibaren yeniden keşfedilir). Asla fırlatmaz.
export function loadState(path: string, scope: string, now: number, warn: (msg: string) => void): KeeperState {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") warn(`durum dosyası okunamadı (${path}): ${(e as Error).message}; sıfırdan başlanıyor`);
    return emptyState();
  }
  try {
    const raw = JSON.parse(text) as Partial<StateFile> | Partial<StateFileV1> | null;
    if (!raw || typeof raw !== "object" || (raw.version !== 1 && raw.version !== 2)) throw new Error("bilinmeyen sürüm/biçim");
    if (raw.scope !== scope) {
      warn(`durum dosyası başka bir vault'a ait (${String(raw.scope)} ≠ ${scope}); sıfırdan başlanıyor`);
      return emptyState();
    }
    if (raw.version === 1) {
      const v1 = raw as Partial<StateFileV1>;
      if (typeof v1.cursor !== "string" || !ID_RE.test(v1.cursor)) throw new Error("v1 cursor geçersiz");
      warn(`durum dosyası v1; v2'ye taşınıyor (${v1.cursor} ve sonrası yeniden keşfedilecek)`);
      return { discoveredUpTo: BigInt(v1.cursor) - 1n, active: new Set(), backoff: readBackoff(v1.backoff, now) };
    }
    const v2 = raw as Partial<StateFile>;
    if (typeof v2.discoveredUpTo !== "string" || !/^(0|[1-9]\d*)$/.test(v2.discoveredUpTo)) {
      throw new Error("discoveredUpTo geçersiz");
    }
    if (!Array.isArray(v2.active) || !v2.active.every((x) => typeof x === "string" && ID_RE.test(x))) {
      throw new Error("active geçersiz");
    }
    const state: KeeperState = {
      discoveredUpTo: BigInt(v2.discoveredUpTo),
      active: new Set(v2.active.map((x) => BigInt(x))),
      backoff: readBackoff(v2.backoff, now),
    };
    return state;
  } catch (e) {
    warn(`durum dosyası bozuk (${path}): ${(e as Error).message}; sıfırdan başlanıyor`);
    return emptyState();
  }
}

/// Durumu atomik yazar (geçici dosya + rename). Başarısızlıkta fırlatır; çağıran yakalayıp loglamalı.
export function saveState(path: string, scope: string, state: KeeperState, now: number): void {
  pruneBackoff(state.backoff, now);
  const file: StateFile = {
    version: 2,
    scope,
    discoveredUpTo: state.discoveredUpTo.toString(),
    active: [...state.active].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((id) => id.toString()),
    backoff: Object.fromEntries([...state.backoff].map(([id, until]) => [id.toString(), until])),
  };
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + "\n");
  renameSync(tmp, path);
}
