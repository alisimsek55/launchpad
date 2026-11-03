import { bondingCurveAbi, graduatorAbi, tokenFactoryAbi } from "@launchpad/shared";
import { createPublicClient, formatEther, getAbiItem, http, type Address } from "viem";
import { chain, deployment } from "@/config";
import type { CandleRow, DataSource, TokenInfo, TradeRow } from "./types";

/// YEREL veri kaynağı: subgraph olmadan (graph-node yok) event'ler doğrudan RPC'den okunur.
/// Sadece curve işlemlerini görür (graduation sonrası Uniswap swap'ları dahil değil).
const client = createPublicClient({ chain, transport: http() });
const fromBlock = BigInt(deployment.startBlock);
const num = (v: bigint) => Number(formatEther(v));

async function load() {
  const [created, trades, graduated] = await Promise.all([
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
  for (const l of graduated) {
    const t = tokens.get(l.args.token!.toLowerCase());
    if (t) t.graduated = true;
  }
  return { tokens: [...tokens.values()], trades: rows.reverse() };
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
};
