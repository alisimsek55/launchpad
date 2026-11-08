import { CREATOR_FEE_BPS, TRADE_FEE_BPS, getDeployment } from "@launchpad/shared";
import { ponder, type Context } from "ponder:registry";
import schema from "ponder:schema";
import { formatEther, zeroAddress, type Address, type Hex } from "viem";

const CANDLE_INTERVALS = [60, 300, 3600, 21600, 86400];
const DAY = 86400;
const INITIAL_PRICE = 1.4 / (3.2e9 / 3); // VIRTUAL_ETH / VIRTUAL_TOKEN
const eth = (wei: bigint) => Number(formatEther(wei));
const WETH = BigInt(getDeployment(process.env.LAUNCHPAD_NETWORK).weth);

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
  });

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
      .values({ token: t.token, interval, time, open: price, high: price, low: price, close: price, volumeWei: t.ethWei })
      .onConflictDoUpdate((r) => ({
        high: Math.max(r.high, price),
        low: Math.min(r.low, price),
        close: price,
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
    graduated: false,
    priceEth: INITIAL_PRICE,
    volumeWei: 0n,
    tradeCount: 0,
    realEthWei: 0n,
    creatorFeesWei: 0n,
  });
  await context.db.insert(schema.poolToken).values({ pool, token, tokenIsToken0 });
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
    realEthWei: a.realEth,
    creatorFeeWei: a.creatorFee,
  });
});

ponder.on("Graduator:Graduated", async ({ event, context }) => {
  await context.db.update(schema.token, { address: event.args.token }).set({ graduated: true });
  await bumpProtocol(context, { graduated: 1 });
  await bumpDay(context, event.block.timestamp, { graduations: 1 });
});

ponder.on("UniswapPool:Swap", async ({ event, context }) => {
  const p = await context.db.find(schema.poolToken, { pool: event.log.address });
  if (!p) return;
  const { amount0, amount1, sqrtPriceX96 } = event.args;
  // Tutarlar pool açısından: pozitif = pool'a giren
  const tokenDelta = p.tokenIsToken0 ? amount0 : amount1;
  const ethDelta = p.tokenIsToken0 ? amount1 : amount0;
  const abs = (v: bigint) => (v < 0n ? -v : v);
  const sqrt = Number(sqrtPriceX96) / 2 ** 96;
  const price1Per0 = sqrt * sqrt; // ikisi de 18 ondalık
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
  });
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
