/// Zincir üstü token metadata'sını okur ve doğrular. metadataURI'yi herkes kontrata doğrudan
/// yazabilir; bu yüzden içerik güvenilmez veridir: TypeScript cast'i yetmez, her alan çalışma
/// anında kontrol edilir (ör. {"description":{"x":1}} React'te sayfayı çökertirdi).

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  x?: string;
  telegram?: string;
  website?: string;
};

/// Okunacak en fazla bayt (form 24 KB'a kadar yazar; pay bırakıldı)
const MAX_BODY_BYTES = 64_000;
// Alan sınırları: form 32/10/256 karakter yazar; eski/elle yazılmış kayıtlar için biraz pay
const MAX_NAME = 64;
const MAX_SYMBOL = 16;
const MAX_DESCRIPTION = 1_000;
const MAX_URL = 2_048;
const MAX_DATA_IMAGE = 48_000;

/// Desteklenen URI'ler: zincir üstü data: JSON (formun yazdığı) veya https
export const isSupportedMetadataURI = (uri: string | undefined): uri is string =>
  !!uri && /^(data:application\/json[;,]|https:\/\/)/i.test(uri);

/// Ziyaretçi tarayıcısından harici adrese gidilir: çerez ve referer gönderilmez.
export async function fetchMetadata(uri: string): Promise<TokenMetadata | null> {
  const res = await fetch(uri, { credentials: "omit", referrerPolicy: "no-referrer" });
  // Geçici 429/503 gibi hatalar React Query tarafından yeniden denensin diye fırlatılır
  if (!res.ok) throw new Error(`Metadata ${res.status}`);
  const text = await readCapped(res, MAX_BODY_BYTES);
  if (text === null) return null;
  try {
    return sanitizeMetadata(JSON.parse(text));
  } catch {
    return null; // bozuk JSON: yeniden denemek düzeltmez
  }
}

/// Gövdeyi en fazla `max` bayt okur; aşarsa okumayı keser ve null döner.
async function readCapped(res: Response, max: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) {
    await res.body?.cancel();
    return null;
  }
  if (!res.body) return (await res.text()).slice(0, max);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

/// Yalnızca https:// bağlantılar (javascript:, data:, http: vb. düşer)
function httpsUrl(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > MAX_URL) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/// Görsel: data:image/... (zincir üstü) veya https:// adres
function imageUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (/^data:image\//i.test(s)) return s.length <= MAX_DATA_IMAGE ? s : undefined;
  return httpsUrl(s);
}

export function sanitizeMetadata(raw: unknown): TokenMetadata | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    name: str(r.name, MAX_NAME) ?? "",
    symbol: str(r.symbol, MAX_SYMBOL) ?? "",
    description: str(r.description, MAX_DESCRIPTION) ?? "",
    image: imageUrl(r.image) ?? "",
    x: httpsUrl(r.x),
    telegram: httpsUrl(r.telegram),
    website: httpsUrl(r.website),
  };
}
