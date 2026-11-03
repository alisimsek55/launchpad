import { bondingCurveAbi, feeVaultAbi, graduatorAbi, tokenFactoryAbi } from "@launchpad/shared";
import { createPublicClient, formatEther, getAbiItem, http, zeroAddress, type Address } from "viem";
import { chain, deployment } from "@/config";
import type { CandleRow, DataSource, DayStat, TokenInfo, TokenVolume, TradeRow } from "./types";

/// YEREL veri kaynağı: subgraph olmadan (graph-node yok) event'ler doğrudan RPC'den okunur.
/// Sadece curve işlemlerini görür (graduation sonrası Uniswap swap'ları dahil değil).
const client = createPublicClient({ chain, transport: http() });
const fromBlock = BigInt(deployment.startBlock);
const num = (v: bigint) => Number(formatEther(v));
const DAY = 86400;

const blockTimes = new Map<bigint, number>();
async function blockTime(n: bigint): Promise<number> {
  if (!blockTimes.has(n)) blockTimes.set(n, Number((await client.getBlock({ blockNumber: n })).timestamp));
  return blockTimes.get(n)!;
}

async function load() {
  const [created, trades, graduated, fees] = await Promise.all([
    client.getLogs({
      address: deployment.tokenFactory,
      event: getAbiItem({ abi: tokenFactoryAbi, name: "TokenCreated" }),
      fromBlock,
    }),
    client.getLogs({
      address: deployment.bondingCurve,
      event: getAbiItem({ abi: bondingCurveAbi, name: "Trade" }),
      fromBlock,
    }),
    client.getLogs({
      address: deployment.graduator,
      event: getAbiItem({ abi: graduatorAbi, name: "Graduated" }),
      fromBlock,
    }),
    client.getLogs({
      address: deployment.feeVault,
      event: getAbiItem({ abi: feeVaultAbi, name: "FeesDeposited" }),
      fromBlock,
    }),
  ]);

  const tokens = new Map<string, TokenInfo>();
  for (const l of created) {
    const a = l.args;
    tokens.set(a.token!.toLowerCase(), {
      address: a.token!,
      name: a.name!,
      symbol: a.symbol!,
      metadataURI: a.metadataURI!,
      creator: a.creator!,
      pool: a.pool!,
      createdAt: Number(a.timestamp!),
      graduated: false,
      priceEth: 1.4 / 1_066_666_666.67,
      marketCapEth: 1.3125,
      volumeEth: 0,
      tradeCount: 0,
      realEth: 0,
      creatorFeesEth: 0,
    });
  }

  const rows: TradeRow[] = [];
  for (const l of trades) {
    const a = l.args;
    const t = tokens.get(a.token!.toLowerCase());
    if (!t) continue;
    const eth = num(a.ethAmount!);
    const amount = num(a.tokenAmount!);
    const spot = num(a.virtualEth!) / num(a.virtualToken!);
    t.priceEth = spot;
    t.marketCapEth = spot * 1e9;
    t.volumeEth += eth;
    t.tradeCount += 1;
    t.realEth = num(a.realEth!);
    t.creatorFeesEth += num(a.creatorFee!);
    rows.push({
      id: `${l.transactionHash}-${l.logIndex}`,
      token: t.address,
      trader: a.trader!,
      isBuy: a.isBuy!,
      ethAmount: eth,
      tokenAmount: amount,
      priceEth: amount > 0 ? eth / amount : 0,
      timestamp: Number(a.timestamp!),
      txHash: l.transactionHash,
      source: "curve",
    });
  }

  const graduations: number[] = [];
  for (const l of graduated) {
    const t = tokens.get(l.args.token!.toLowerCase());
    if (t) t.graduated = true;
    graduations.push(await blockTime(l.blockNumber));
  }

  const feeRows: { time: number; total: number; revenue: number }[] = [];
  for (const l of fees) {
    const p = num(l.args.protocolAmount!);
    const c = num(l.args.creatorAmount!);
    feeRows.push({ time: await blockTime(l.blockNumber), total: p + c, revenue: l.args.creator === zeroAddress ? p + c : p });
  }

  return { tokens: [...tokens.values()], trades: rows.reverse(), graduations, fees: feeRows };
}

function toCandles(trades: TradeRow[], interval: number): CandleRow[] {
  const map = new Map<number, CandleRow>();
  for (const t of [...trades].sort((a, b) => a.timestamp - b.timestamp)) {
    const time = Math.floor(t.timestamp / interval) * interval;
    const c = map.get(time);
    if (!c) {
      map.set(time, { time, open: t.priceEth, high: t.priceEth, low: t.priceEth, close: t.priceEth, volumeEth: t.ethAmount });
    } else {
      c.high = Math.max(c.high, t.priceEth);
      c.low = Math.min(c.low, t.priceEth);
      c.close = t.priceEth;
      c.volumeEth += t.ethAmount;
    }
  }
  return [...map.values()];
}

const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

export const rpcSource: DataSource = {
  async tokens(sort, limit) {
    const { tokens } = await load();
    const key = sort === "new" ? "createdAt" : sort === "marketCap" ? "marketCapEth" : "volumeEth";
    return tokens.sort((a, b) => b[key] - a[key]).slice(0, limit);
  },
  async tokensByCreator(creator) {
    const { tokens } = await load();
    return tokens.filter((t) => same(t.creator, creator)).sort((a, b) => b.createdAt - a.createdAt);
  },
  async token(address) {
    const { tokens } = await load();
    return tokens.find((t) => same(t.address, address)) ?? null;
  },
  async trades(token, limit) {
    const { trades } = await load();
    return trades.filter((t) => same(t.token, token)).slice(0, limit);
  },
  async candles(token, interval) {
    const { trades } = await load();
    return toCandles(
      trades.filter((t) => same(t.token, token)),
      interval,
    );
  },
  async protocol() {
    const { tokens, trades, graduations, fees } = await load();
    return {
      tokenCount: tokens.length,
      graduatedCount: graduations.length,
      tradeCount: trades.length,
      volumeEth: trades.reduce((s, t) => s + t.ethAmount, 0),
      feesEth: fees.reduce((s, f) => s + f.total, 0),
      protocolRevenueEth: fees.reduce((s, f) => s + f.revenue, 0),
    };
  },
  async days(since) {
    const { tokens, trades, graduations, fees } = await load();
    const map = new Map<number, DayStat>();
    const day = (ts: number) => {
      const date = Math.floor(ts / DAY) * DAY;
      if (!map.has(date))
        map.set(date, { date, volumeEth: 0, feesEth: 0, protocolRevenueEth: 0, launches: 0, graduations: 0, tradeCount: 0 });
      return map.get(date)!;
    };
    for (const t of trades) {
      const d = day(t.timestamp);
      d.volumeEth += t.ethAmount;
      d.tradeCount += 1;
    }
    for (const t of tokens) day(t.createdAt).launches += 1;
    for (const g of graduations) day(g).graduations += 1;
    for (const f of fees) {
      const d = day(f.time);
      d.feesEth += f.total;
      d.protocolRevenueEth += f.revenue;
    }
    return [...map.values()].filter((d) => d.date >= since - DAY).sort((a, b) => a.date - b.date);
  },
  async topTokens(since, limit) {
    const { trades } = await load();
    const map = new Map<string, TokenVolume>();
    for (const t of trades) {
      if (t.timestamp < since) continue;
      const k = t.token.toLowerCase();
      const v = map.get(k) ?? { token: t.token, volumeEth: 0, tradeCount: 0 };
      v.volumeEth += t.ethAmount;
      v.tradeCount += 1;
      map.set(k, v);
    }
    return [...map.values()].sort((a, b) => b.volumeEth - a.volumeEth).slice(0, limit);
  },
};
