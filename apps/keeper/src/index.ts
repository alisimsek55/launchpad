/// DCA keeper: zamanı gelen planları DCAVault.execute ile çalıştırır.
///   LAUNCHPAD_NETWORK=local|testnet|mainnet  adresler packages/shared/deployments'tan (boşsa testnet)
///   KEEPER_PRIVATE_KEY                keeper hesabı (DCAVault.setKeeper ile yetkilendirilmiş olmalı)
///   KEEPER_RPC_URL                    (isteğe bağlı) RPC
///   POLL_MS=30000  SLIPPAGE_BPS=300   döngü aralığı (tam sayı, >= 1000 ms) ve keeper'ın teklif üstüne uyguladığı
///                                     slippage (tam sayı, 0-9999); geçersiz değerde keeper başlamaz, boşsa varsayılan
///   KEEPER_STATE_FILE=.keeper-state.json  kalıcı durum (JSON, v2): plan başarısızlık backoff'u, keşfedilen en yüksek
///                                     plan id'si ve aktif (bakiyesi > 0) plan kümesi; çalışma dizinine göre, yoksa/bozuksa
///                                     uyarıyla sıfırdan başlar, v1 dosyası uyarıyla taşınır (gitignore'da)
///   KEEPER_SCAN_BATCH=200             multicall başına plan sayısı (1-5000); hata veren parça atlanıp diğerleri sürer
/// Her tur: yalnız yeni plan id'leri keşfedilir (tur başına en çok 5.000), sonra yalnız aktif planlar taranır;
/// bitmiş planlar bir daha okunmaz (bkz. src/state.ts).
/// `--once`: tek tur çalışıp çıkar (GitHub Actions cron bu modu kullanır, bkz. .github/workflows/keeper.yml).
import { bondingCurveAbi, chainFor, dcaVaultAbi, getDeployment, graduatorAbi } from "@launchpad/shared";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseAbi,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  applyDiscovery,
  chunkIds,
  chunkList,
  discoveryRange,
  isConsistent,
  loadState,
  saveState,
  type PlanStatus,
} from "./state.js";

const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);
const chain = chainFor(deployment.chainId, process.env.KEEPER_RPC_URL ?? deployment.rpcUrl);
/// Ortam değişkenini tam sayı olarak okur; boş/tanımsızsa varsayılan, geçersizse veya aralık dışıysa hata.
function envInt(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return def;
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new Error(`${name} ${min} ile ${max} arasında bir tam sayı olmalı (verilen: "${raw}")`);
  }
  return n;
}
const POLL_MS = envInt("POLL_MS", 30_000, 1_000, 86_400_000); // en az 1 sn: RPC'yi boğmasın
const SLIPPAGE_BPS = BigInt(envInt("SLIPPAGE_BPS", 300, 0, 9_999)); // 10000 ve üstü minTokensOut'u negatif yapar
const BACKOFF_MS = 10 * 60_000; // başarısız plan 10 dk dinlenir (ör. maxPrice aşıldı)
const SCAN_BATCH = envInt("KEEPER_SCAN_BATCH", 200, 1, 5_000); // multicall başına plan sayısı
const DISCOVER_MAX = 5_000; // tur başına keşfedilen en çok yeni plan id'si; büyük birikim turlara yayılır
const STATE_FILE = process.env.KEEPER_STATE_FILE?.trim() || ".keeper-state.json";
const STATE_SCOPE = `${deployment.chainId}:${deployment.dcaVault.toLowerCase()}`;

if (/^0x0+$/.test(deployment.dcaVault)) {
  console.log(`DCAVault ${deployment.network} ağında henüz deploy edilmemiş; yapılacak iş yok.`);
  process.exit(0);
}

// MetaMask özel anahtarı "0x" öneki olmadan verir; kopyalarken boşluk/satır sonu da gelebilir.
const rawKey = process.env.KEEPER_PRIVATE_KEY?.trim();
if (!rawKey) throw new Error("KEEPER_PRIVATE_KEY gerekli");
const key = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("KEEPER_PRIVATE_KEY 32 baytlık hex olmalı (64 karakter)");
const account = privateKeyToAccount(key);
console.log(`Keeper: ${account.address} (${deployment.network})`);
const publicClient = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ chain, account, transport: http() });

const quoterAbi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) returns (uint256 amountOut, uint160, uint32, uint256)",
]);
// Ağın WETH/Uniswap adresleri deploy dosyasından
const UNI = { weth: deployment.weth, uniQuoterV2: deployment.uniQuoterV2 };
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
// Kalıcı durum: backoff + keşif sınırı + aktif planlar (--once cron çalıştırmaları arasında actions/cache ile taşınır)
const state = loadState(STATE_FILE, STATE_SCOPE, Date.now(), (m) => log("uyarı:", m));

// DCAVault.execute revert'lerinin log açıklamaları (hepsi backoff'a gider)
const REVERT_REASONS: Record<string, string> = {
  PriceTooHigh: "fiyat planın maxPrice sınırının üstünde",
  PriceManipulated: "pool fiyatı 5 dk TWAP'tan ~%5'ten fazla sapmış (olası manipülasyon), alım yapılmadı",
  TwapUnavailable: "pool'un 5 dk TWAP geçmişi yetersiz ve planın maxPrice'ı yok, alım yapılamaz",
  TooEarly: "plan henüz due değil",
  PlanFinished: "plan bitmiş",
  Slippage: "fiyat teklif ile işlem arasında slippage sınırını aştı",
};

/// Hatanın kısa açıklaması: bilinen kontrat revert'lerinde hata adı + açıklama, yoksa mesajın ilk satırı.
function describeError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (name) return REVERT_REASONS[name] ? `${name} — ${REVERT_REASONS[name]}` : name;
  }
  return (e as Error).message.split("\n")[0]!;
}

/// Güncel teklif (curve veya Uniswap) eksi slippage = minTokensOut.
/// null: graduation bekliyor (curve kapalı, LP henüz açılmadı); pool'a karşı teklif alınmaz, plan atlanır.
async function minOutFor(token: Hex, ethIn: bigint): Promise<bigint | null> {
  const curve = await publicClient.readContract({
    address: deployment.bondingCurve,
    abi: bondingCurveAbi,
    functionName: "curves",
    args: [token],
  });
  const graduated = curve[6];
  let quote: bigint;
  if (graduated) {
    // Bekleyen graduation'da pool fiyatı hedefe henüz taşınmamış olabilir; bu pool'dan teklif alınmaz.
    const [pendingCreator] = await publicClient.readContract({
      address: deployment.graduator,
      abi: graduatorAbi,
      functionName: "pending",
      args: [token],
    });
    if (pendingCreator !== zeroAddress) return null;
    const { result } = await publicClient.simulateContract({
      address: UNI.uniQuoterV2,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: UNI.weth, tokenOut: token, amountIn: ethIn, fee: 10_000, sqrtPriceLimitX96: 0n }],
    });
    quote = result[0];
  } else {
    [quote] = await publicClient.readContract({
      address: deployment.bondingCurve,
      abi: bondingCurveAbi,
      functionName: "quoteBuy",
      args: [token, ethIn],
    });
  }
  return (quote * (10_000n - SLIPPAGE_BPS)) / 10_000n;
}

/// Bir planı çalıştırır; hata olursa backoff'a sokar (durum dosyasına tick sonunda yazılır).
async function runPlan(id: bigint, token: Hex, ethPerBuy: bigint, balance: bigint, now: number) {
  try {
    const ethIn = balance < ethPerBuy ? balance : ethPerBuy;
    const minOut = await minOutFor(token, ethIn);
    if (minOut === null) {
      // Backoff yok: graduation'ı herkes tamamlayabilir; biter bitmez sonraki turda alım yapılır.
      log(`plan ${id}: atlandı — ${token} graduation'ı bekliyor (Graduator.continueGraduation henüz tamamlanmadı)`);
      return;
    }
    const { request } = await publicClient.simulateContract({
      account,
      address: deployment.dcaVault,
      abi: dcaVaultAbi,
      functionName: "execute",
      args: [id, minOut],
    });
    const gas = await publicClient.estimateContractGas(request);
    const hash = await wallet.writeContract({ ...request, gas: (gas * 12n) / 10n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    // Blokta yer alıp revert olan işlem de makbuz döndürür; başarısız sayıp backoff'a sok (gaz yakmaya devam etmesin).
    if (receipt.status !== "success") throw new Error(`işlem revert oldu (${receipt.status}) — tx ${hash}`);
    log(`plan ${id}: ${formatEther(ethIn)} ETH alım → ${receipt.status} (${hash})`);
  } catch (e) {
    state.backoff.set(id, now + BACKOFF_MS);
    log(`plan ${id}: atlandı (10 dk backoff) — ${describeError(e)}`);
  }
}

/// Plan durumlarını parça parça okur (parça başına tek multicall: plans + isteğe bağlı isDue).
/// Hata veren parça loglanır ve null döner; çağıran o id'leri düşürmemeli/atlamamalı.
async function readPlans(ids: bigint[], withDue: boolean) {
  try {
    return await publicClient.multicall({
      contracts: ids.flatMap((id) => [
        { address: deployment.dcaVault, abi: dcaVaultAbi, functionName: "plans" as const, args: [id] as const },
        ...(withDue
          ? [{ address: deployment.dcaVault, abi: dcaVaultAbi, functionName: "isDue" as const, args: [id] as const }]
          : []),
      ]),
    });
  } catch (e) {
    log(`plan ${ids[0]}-${ids[ids.length - 1]} parçası okunamadı, atlandı — ${(e as Error).message.split("\n")[0]}`);
    return null;
  }
}

/// plans() sonucundan bakiye; okunamadıysa null.
function balanceOf(r: { status: "success" | "failure"; result?: unknown }): bigint | null {
  if (r.status !== "success") return null;
  return (r.result as readonly [Hex, Hex, bigint, bigint, ...unknown[]])[3];
}

async function tick() {
  const next = await publicClient.readContract({
    address: deployment.dcaVault,
    abi: dcaVaultAbi,
    functionName: "nextPlanId",
  });
  // Durum nextPlanId ile çelişiyorsa (vault değişti) baştan keşfet.
  if (!isConsistent(state, next)) {
    log("uyarı: durum vault'un nextPlanId'siyle tutarsız; baştan keşfediliyor");
    state.discoveredUpTo = 0n;
    state.active.clear();
  }

  // 1) Keşif: yalnızca yeni id'ler (en çok DISCOVER_MAX), canlı olanlar active'e eklenir.
  const [from, to] = discoveryRange(state.discoveredUpTo, next, DISCOVER_MAX);
  const statuses: PlanStatus[] = [];
  for (const ids of chunkIds(from, to, SCAN_BATCH)) {
    const res = await readPlans(ids, false);
    for (const [i] of ids.entries()) {
      // balance = 0: plan iptal edildi/bitti; kontratta yeniden doldurma yok, bir daha asla due olmaz.
      const b = res ? balanceOf(res[i]!) : null;
      statuses.push(b === null ? "unknown" : b === 0n ? "finished" : "live");
    }
  }
  const before = state.discoveredUpTo;
  applyDiscovery(state, from, statuses);
  if (state.discoveredUpTo > before) log(`keşif ${before + 1n}-${state.discoveredUpTo} · aktif plan: ${state.active.size}`);

  // 2) Yalnız aktif planlar taranır; bakiyesi 0'a inen çıkarılır. Hata veren parçanın id'leri kalır.
  const active = [...state.active].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const ids of chunkList(active, SCAN_BATCH)) {
    const res = await readPlans(ids, true);
    if (!res) continue;
    const now = Date.now();
    for (const [i, id] of ids.entries()) {
      const p = res[2 * i]!;
      const d = res[2 * i + 1]!;
      const balance = balanceOf(p);
      if (balance === null) continue;
      if (balance === 0n) {
        state.active.delete(id);
        state.backoff.delete(id);
        continue;
      }
      if (d.status !== "success" || !d.result) continue;
      if ((state.backoff.get(id) ?? 0) > now) continue;
      const [, token, ethPerBuy] = p.result as readonly [Hex, Hex, bigint, bigint, ...unknown[]];
      await runPlan(id, token, ethPerBuy, balance, now);
    }
  }
}

/// Durumu kaydeder; yazılamazsa keeper çökmez (sonraki tur yine denenir).
function persist() {
  try {
    saveState(STATE_FILE, STATE_SCOPE, state, Date.now());
  } catch (e) {
    log(`durum dosyası yazılamadı (${STATE_FILE}): ${(e as Error).message}`);
  }
}

log(`keeper ${account.address} · ağ ${deployment.network} · vault ${deployment.dcaVault}`);
if (process.argv.includes("--once")) {
  try {
    await tick();
  } finally {
    persist();
  }
} else {
  for (;;) {
    await tick().catch((e) => log("tur hatası:", (e as Error).message));
    persist();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
