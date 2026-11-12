import { CREATOR_FEE_BPS, CURVE_SUPPLY, TRADE_FEE_BPS, VIRTUAL_TOKEN, getDeployment } from "@launchpad/shared";
import { ponder, type Context } from "ponder:registry";
import schema from "ponder:schema";
import { formatEther, zeroAddress, type Address, type Hex } from "viem";

const CANDLE_INTERVALS = [60, 300, 3600, 21600, 86400];
const DAY = 86400;
const eth = (wei: bigint) => Number(formatEther(wei));
const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);
const WETH = BigInt(deployment.weth);
// Başlangıç spot fiyatı = VIRTUAL_ETH / VIRTUAL_TOKEN (ağın curve parametrelerinden)
const INITIAL_PRICE = eth(BigInt(deployment.virtualEth)) / eth(VIRTUAL_TOKEN);
// Curve'deki gerçek token rezervi = sanal rezerv - bu sabit (sanal offset; satılmamış curve arzı)
const VIRTUAL_TOKEN_OFFSET = VIRTUAL_TOKEN - CURVE_SUPPLY;
const Q96 = 2n ** 96n;
const bondingCurve = deployment.bondingCurve.toLowerCase();
const graduator = deployment.graduator.toLowerCase();

// ---------------------------------------------------------------- yardımcılar

async function bumpProtocol(
  context: Context,
  d: Partial<{ tokens: number; graduated: number; trades: number; volume: bigint; fees: bigint; revenue: bigint }>,
) {
  await context.db
    .insert(schema.protocolStat)
    .values({
      id: 1,
      tokenCount: d.tokens ?? 0,
      graduatedCount: d.graduated ?? 0,
      tradeCount: d.trades ?? 0,
      volumeWei: d.volume ?? 0n,
      feesWei: d.fees ?? 0n,
      revenueWei: d.revenue ?? 0n,
    })
    .onConflictDoUpdate((r) => ({
      tokenCount: r.tokenCount + (d.tokens ?? 0),
      graduatedCount: r.graduatedCount + (d.graduated ?? 0),
      tradeCount: r.tradeCount + (d.trades ?? 0),
      volumeWei: r.volumeWei + (d.volume ?? 0n),
      feesWei: r.feesWei + (d.fees ?? 0n),
      revenueWei: r.revenueWei + (d.revenue ?? 0n),
    }));
}

async function bumpDay(
  context: Context,
  timestamp: bigint,
  d: Partial<{ launches: number; graduations: number; trades: number; volume: bigint; fees: bigint; revenue: bigint }>,
) {
  const date = Math.floor(Number(timestamp) / DAY) * DAY;
  await context.db
    .insert(schema.dayStat)
    .values({
      date,
      launches: d.launches ?? 0,
      graduations: d.graduations ?? 0,
      tradeCount: d.trades ?? 0,
      volumeWei: d.volume ?? 0n,
      feesWei: d.fees ?? 0n,
      revenueWei: d.revenue ?? 0n,
    })
    .onConflictDoUpdate((r) => ({
      launches: r.launches + (d.launches ?? 0),
      graduations: r.graduations + (d.graduations ?? 0),
      tradeCount: r.tradeCount + (d.trades ?? 0),
      volumeWei: r.volumeWei + (d.volume ?? 0n),
      feesWei: r.feesWei + (d.fees ?? 0n),
      revenueWei: r.revenueWei + (d.revenue ?? 0n),
    }));
}

/// Pool'un izlenen bakiyelerini değiştirir ve güncel pool kaydıyla döner.
/// amount0/amount1: pool açısından imzalı tutarlar (pozitif = pool'a giren).
async function addPoolBalances(context: Context, pool: Address, amount0: bigint, amount1: bigint) {
  const p = await context.db.find(schema.poolToken, { pool });
  if (!p) return null;
  const ethDelta = p.tokenIsToken0 ? amount1 : amount0;
  const tokenDelta = p.tokenIsToken0 ? amount0 : amount1;
  if (ethDelta === 0n && tokenDelta === 0n) return p;
  return context.db
    .update(schema.poolToken, { pool })
    .set({ ethBalanceWei: p.ethBalanceWei + ethDelta, tokenBalanceWei: p.tokenBalanceWei + tokenDelta });
}

/// Pool'un rezervleri (DexScreener). İki taraf da pool event'lerinden izlenen muhasebe bakiyesidir.
/// WETH tarafını balanceOf ile birebir tutmak için tüm WETH Transfer'larını dinlemek gerekirdi: Ponder
/// 0.18 event argümanını factory adres kümesiyle süzemiyor (topic filtresi yalnız sabit değer alır),
/// sınırsız WETH trafiği ise ücretsiz sunucuya sığmaz. Bu yüzden token tarafı da Transfer yerine aynı
/// event'lerden izlenir; doğrudan transferler (bağış) iki tarafta da sayılmaz ve rezervler tutarlı kalır.
/// v3'te aktif likidite (L) pool bakiyesi değildir: dar aralıklı pozisyonlar varken L/√P, L·√P
/// formülü rezervleri yanlış gösterir; bu yüzden bakiyeler kullanılır.
function poolReserves(p: { ethBalanceWei: bigint; tokenBalanceWei: bigint }) {
  return { reserveEthWei: p.ethBalanceWei, reserveTokenWei: p.tokenBalanceWei };
}

/// Curve ve Uniswap işlemleri için ortak kayıt: trade + token toplamları + mumlar + günlük veriler.
async function recordTrade(
  context: Context,
  t: {
    id: string;
    token: Address;
    trader: Address;
    isBuy: boolean;
    ethWei: bigint;
    tokenWei: bigint;
    spotPrice: number;
    timestamp: bigint;
    txHash: Hex;
    source: "curve" | "uniswap";
    pair: Address;
    blockNumber: bigint;
    txIndex: number;
    logIndex: number;
    /// İşlem sonrası spot fiyat (token başına ETH) kesin oran olarak
    priceNum: bigint;
    priceDen: bigint;
    reserveEthWei: bigint;
    reserveTokenWei: bigint;
    realEthWei?: bigint;
    creatorFeeWei?: bigint;
  },
) {
  if (t.tokenWei === 0n) return;
  const price = eth(t.ethWei) / eth(t.tokenWei);
  await context.db.insert(schema.trade).values({
    id: t.id,
    token: t.token,
    trader: t.trader,
    isBuy: t.isBuy,
    ethWei: t.ethWei,
    tokenWei: t.tokenWei,
    priceEth: price,
    timestamp: t.timestamp,
    txHash: t.txHash,
    source: t.source,
    pair: t.pair,
    blockNumber: t.blockNumber,
    txIndex: t.txIndex,
    logIndex: t.logIndex,
    priceNum: t.priceNum,
    priceDen: t.priceDen,
    reserveEthWei: t.reserveEthWei,
    reserveTokenWei: t.reserveTokenWei,
  });

  // Mumlar spot fiyatla çizilir: işlem öncesi fiyat → işlem sonrası fiyat. (Ortalama işlem fiyatı
  // tek işlemlik mumu open = close düz bir çizgiye çevirir ve fiyat hareketini göstermez.)
  const before = (await context.db.find(schema.token, { address: t.token }))?.priceEth ?? t.spotPrice;
  const after = t.spotPrice;

  await context.db.update(schema.token, { address: t.token }).set((r) => ({
    priceEth: t.spotPrice,
    volumeWei: r.volumeWei + t.ethWei,
    tradeCount: r.tradeCount + 1,
    realEthWei: t.realEthWei ?? r.realEthWei,
    creatorFeesWei: r.creatorFeesWei + (t.creatorFeeWei ?? 0n),
  }));

  for (const interval of CANDLE_INTERVALS) {
    const time = Math.floor(Number(t.timestamp) / interval) * interval;
    await context.db
      .insert(schema.candle)
      .values({
        token: t.token,
        interval,
        time,
        open: before,
        high: Math.max(before, after),
        low: Math.min(before, after),
        close: after,
        volumeWei: t.ethWei,
      })
      .onConflictDoUpdate((r) => ({
        high: Math.max(r.high, after),
        low: Math.min(r.low, after),
        close: after,
        volumeWei: r.volumeWei + t.ethWei,
      }));
  }

  const date = Math.floor(Number(t.timestamp) / DAY) * DAY;
  await context.db
    .insert(schema.tokenDay)
    .values({ token: t.token, date, volumeWei: t.ethWei, tradeCount: 1 })
    .onConflictDoUpdate((r) => ({ volumeWei: r.volumeWei + t.ethWei, tradeCount: r.tradeCount + 1 }));
  await bumpDay(context, t.timestamp, { trades: 1, volume: t.ethWei });
  await bumpProtocol(context, { trades: 1, volume: t.ethWei });
}

// ---------------------------------------------------------------- event'ler

ponder.on("TokenFactory:TokenCreated", async ({ event, context }) => {
  const { token, creator, name, symbol, metadataURI, pool, timestamp } = event.args;
  // Uniswap kuralı: küçük adres token0
  const tokenIsToken0 = BigInt(token) < WETH;

  await context.db.insert(schema.token).values({
    address: token,
    name,
    symbol,
    metadataURI,
    creator,
    pool,
    tokenIsToken0,
    createdAt: timestamp,
    createdBlock: event.block.number,
    createdTxHash: event.transaction.hash,
    graduated: false,
    graduationPending: false,
    priceEth: INITIAL_PRICE,
    volumeWei: 0n,
    tradeCount: 0,
    realEthWei: 0n,
    creatorFeesWei: 0n,
  });
  await context.db.insert(schema.poolToken).values({ pool, token, tokenIsToken0, ethBalanceWei: 0n, tokenBalanceWei: 0n });
  await bumpProtocol(context, { tokens: 1 });
  await bumpDay(context, timestamp, { launches: 1 });
});

ponder.on("BondingCurve:Trade", async ({ event, context }) => {
  const a = event.args;
  await recordTrade(context, {
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    token: a.token,
    trader: a.trader,
    isBuy: a.isBuy,
    ethWei: a.ethAmount,
    tokenWei: a.tokenAmount,
    spotPrice: eth(a.virtualEth) / eth(a.virtualToken),
    timestamp: a.timestamp,
    txHash: event.transaction.hash,
    source: "curve",
    pair: a.token,
    blockNumber: event.block.number,
    txIndex: event.transaction.transactionIndex,
    logIndex: event.log.logIndex,
    priceNum: a.virtualEth,
    priceDen: a.virtualToken,
    reserveEthWei: a.realEth,
    reserveTokenWei: a.virtualToken - VIRTUAL_TOKEN_OFFSET,
    realEthWei: a.realEth,
    creatorFeeWei: a.creatorFee,
  });
});

// Fiyat düzeltmesi tek adımda bitmedi: varlıklar Graduator'da bekliyor, LP henüz yok. `graduated` bayrağı
// değişmez (Swap guard'ı yalnız Graduated'a bağlı kalır), böylece bekleme sırasındaki düzeltme swap'ları
// (continueGraduation) kullanıcı işlemi olarak kaydedilmez.
ponder.on("Graduator:GraduationPending", async ({ event, context }) => {
  await context.db.update(schema.token, { address: event.args.token }).set({ graduationPending: true });
});

ponder.on("Graduator:Graduated", async ({ event, context }) => {
  const { token, pool, ethLiquidity, tokenLiquidity } = event.args;
  await context.db.update(schema.token, { address: token }).set({ graduated: true, graduationPending: false });
  // Graduated aynı tx'in son log'u: düzeltme swap'ı, mint ve token transferleri işlenmiş durumda.
  // Rezervler pool'un izlenen bakiyeleri (graduation öncesi eklenmiş üçüncü taraf likiditesi dahil).
  const p = await context.db.find(schema.poolToken, { pool });
  const reserves = p ? poolReserves(p) : { reserveEthWei: ethLiquidity, reserveTokenWei: tokenLiquidity };
  // Uniswap pool'una ilk likidite girişi (DexScreener "join")
  await context.db.insert(schema.liquidityEvent).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    kind: "join",
    pair: pool,
    token,
    maker: event.transaction.from,
    ethWei: ethLiquidity,
    tokenWei: tokenLiquidity,
    ...reserves,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    txIndex: event.transaction.transactionIndex,
    logIndex: event.log.logIndex,
  });
  await bumpProtocol(context, { graduated: 1 });
  await bumpDay(context, event.block.timestamp, { graduations: 1 });
});

ponder.on("UniswapPool:Swap", async ({ event, context }) => {
  const { amount0, amount1, sqrtPriceX96 } = event.args;
  // Tutarlar pool açısından: pozitif = pool'a giren. Bakiye her swap'ta güncellenir (graduation
  // öncesi olanlar dahil); işlem kaydı ise aşağıdaki guard'a bağlıdır.
  const p = await addPoolBalances(context, event.log.address, amount0, amount1);
  if (!p) return;
  // Graduation öncesi swap'lar kullanıcı işlemi değildir: Graduator, Graduated'dan ÖNCE aynı tx'te
  // fiyat düzeltme swap'ı yapabilir; saldırganın boş pool'da fiyat itmesi de graduation'dan önce olur.
  // Event'ler log sırasıyla işlendiğinden graduated bayrağı yalnızca Graduated log'undan sonra true olur.
  const info = await context.db.find(schema.token, { address: p.token });
  if (!info?.graduated) return;
  const tokenDelta = p.tokenIsToken0 ? amount0 : amount1;
  const ethDelta = p.tokenIsToken0 ? amount1 : amount0;
  const abs = (v: bigint) => (v < 0n ? -v : v);
  const sqrt = Number(sqrtPriceX96) / 2 ** 96;
  const price1Per0 = sqrt * sqrt; // ikisi de 18 ondalık
  // Kesin oran: price1Per0 = sqrtP² / 2^192
  const sq = sqrtPriceX96 * sqrtPriceX96;
  const Q192 = Q96 * Q96;
  await recordTrade(context, {
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    token: p.token,
    trader: event.transaction.from,
    isBuy: tokenDelta < 0n,
    ethWei: abs(ethDelta),
    tokenWei: abs(tokenDelta),
    spotPrice: p.tokenIsToken0 ? price1Per0 : 1 / price1Per0,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
    source: "uniswap",
    pair: event.log.address,
    blockNumber: event.block.number,
    txIndex: event.transaction.transactionIndex,
    logIndex: event.log.logIndex,
    priceNum: p.tokenIsToken0 ? sq : Q192,
    priceDen: p.tokenIsToken0 ? Q192 : sq,
    ...poolReserves(p),
  });
});

// Pool bakiyelerini değiştiren diğer event'ler (rezervler için; bkz. poolReserves)
ponder.on("UniswapPool:Mint", async ({ event, context }) => {
  const { amount0, amount1 } = event.args;
  await addPoolBalances(context, event.log.address, amount0, amount1);
});

ponder.on("UniswapPool:Collect", async ({ event, context }) => {
  const { amount0, amount1 } = event.args;
  await addPoolBalances(context, event.log.address, -amount0, -amount1);
});

ponder.on("UniswapPool:CollectProtocol", async ({ event, context }) => {
  const { amount0, amount1 } = event.args;
  await addPoolBalances(context, event.log.address, -amount0, -amount1);
});

ponder.on("UniswapPool:Flash", async ({ event, context }) => {
  // Borç geri ödendi; pool'da net kalan yalnızca ödenen ücret
  const { paid0, paid1 } = event.args;
  await addPoolBalances(context, event.log.address, paid0, paid1);
});

ponder.on("FeeVault:FeesDeposited", async ({ event, context }) => {
  const { creator, protocolAmount, creatorAmount } = event.args;
  const total = protocolAmount + creatorAmount;
  // creator == 0 ise FeeVault tamamını protokole yazar
  const revenue = creator === zeroAddress ? total : protocolAmount;
  await bumpProtocol(context, { fees: total, revenue });
  await bumpDay(context, event.block.timestamp, { fees: total, revenue });
});

ponder.on("LPLocker:LPFeesCollected", async ({ event, context }) => {
  const creatorPart = (event.args.ethAmount * CREATOR_FEE_BPS) / TRADE_FEE_BPS;
  await context.db
    .update(schema.token, { address: event.args.token })
    .set((r) => ({ creatorFeesWei: r.creatorFeesWei + creatorPart }));
});

ponder.on("LaunchToken:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  if (value === 0n || from === to) return;
  const token = event.log.address;

  // Graduation: curve tüm token'ları Graduator'a aktarır. Bu log, curve likiditesinin çıkışı
  // (DexScreener "exit") olarak kaydedilir; Graduated log'u ise pool'a girişi (join) temsil eder.
  // Ayrı log'lar kullanılır çünkü spec bir blokta (txnIndex, eventIndex) çiftinin tekil olmasını ister.
  if (from.toLowerCase() === bondingCurve && to.toLowerCase() === graduator) {
    const info = await context.db.find(schema.token, { address: token });
    if (info) {
      await context.db.insert(schema.liquidityEvent).values({
        id: `${event.transaction.hash}-${event.log.logIndex}`,
        kind: "exit",
        pair: token,
        token,
        maker: event.transaction.from,
        ethWei: info.realEthWei,
        tokenWei: 0n, // son alımla curve arzı tükendi; aktarılan token'lar LP payıdır, curve rezervi değil
        reserveEthWei: 0n,
        reserveTokenWei: 0n,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
        txHash: event.transaction.hash,
        txIndex: event.transaction.transactionIndex,
        logIndex: event.log.logIndex,
      });
    }
  }

  // holderCount değişimi: bakiye 0'dan çıkan +1, 0'a inen -1
  let holderDelta = 0;

  if (from !== zeroAddress) {
    const row = await context.db.find(schema.balance, { token, holder: from });
    const next = (row?.balance ?? 0n) - value;
    await context.db
      .insert(schema.balance)
      .values({ token, holder: from, balance: next })
      .onConflictDoUpdate({ balance: next });
    if (next === 0n) holderDelta -= 1;
  }

  const row = await context.db.find(schema.balance, { token, holder: to });
  const prev = row?.balance ?? 0n;
  await context.db
    .insert(schema.balance)
    .values({ token, holder: to, balance: prev + value })
    .onConflictDoUpdate({ balance: prev + value });
  if (prev === 0n) holderDelta += 1;

  if (holderDelta !== 0) {
    await context.db
      .insert(schema.holderStats)
      .values({ token, holderCount: holderDelta })
      .onConflictDoUpdate((r) => ({ holderCount: r.holderCount + holderDelta }));
  }
});
