import type { Address } from "viem";
import { SUBGRAPH_URL } from "@/config";
import type { DataSource, TokenInfo, TokenSort, TradeRow } from "./types";

/// Production veri kaynağı: Goldsky subgraph (packages/subgraph/schema.graphql).
async function query<T>(q: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: q, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]!.message);
  return json.data as T;
}

const TOKEN_FIELDS = `id name symbol metadataURI creator { id } pool createdAt graduated priceEth marketCapEth volumeEth tradeCount realEth creatorFeesEth`;

type RawToken = {
  id: Address;
  name: string;
  symbol: string;
  metadataURI: string;
  creator: { id: Address };
  pool: Address;
  createdAt: string;
  graduated: boolean;
  priceEth: string;
  marketCapEth: string;
  volumeEth: string;
  tradeCount: string;
  realEth: string;
  creatorFeesEth: string;
};

const toToken = (t: RawToken): TokenInfo => ({
  address: t.id,
  name: t.name,
  symbol: t.symbol,
  metadataURI: t.metadataURI,
  creator: t.creator.id,
  pool: t.pool,
  createdAt: Number(t.createdAt),
  graduated: t.graduated,
  priceEth: Number(t.priceEth),
  marketCapEth: Number(t.marketCapEth),
  volumeEth: Number(t.volumeEth),
  tradeCount: Number(t.tradeCount),
  realEth: Number(t.realEth),
  creatorFeesEth: Number(t.creatorFeesEth),
});

const ORDER: Record<TokenSort, string> = { new: "createdAt", marketCap: "marketCapEth", volume: "volumeEth" };

export const subgraphSource: DataSource = {
  async tokens(sort, limit) {
    const d = await query<{ tokens: RawToken[] }>(
      `query($first:Int!){ tokens(first:$first, orderBy:${ORDER[sort]}, orderDirection:desc){ ${TOKEN_FIELDS} } }`,
      { first: limit },
    );
    return d.tokens.map(toToken);
  },
  async tokensByCreator(creator) {
    const d = await query<{ tokens: RawToken[] }>(
      `query($c:String!){ tokens(where:{creator:$c}, orderBy:createdAt, orderDirection:desc){ ${TOKEN_FIELDS} } }`,
      { c: creator.toLowerCase() },
    );
    return d.tokens.map(toToken);
  },
  async token(address) {
    const d = await query<{ token: RawToken | null }>(`query($id:ID!){ token(id:$id){ ${TOKEN_FIELDS} } }`, {
      id: address.toLowerCase(),
    });
    return d.token ? toToken(d.token) : null;
  },
  async trades(token, limit) {
    const d = await query<{
      trades: {
        id: string;
        trader: { id: Address };
        isBuy: boolean;
        ethAmount: string;
        tokenAmount: string;
        priceEth: string;
        timestamp: string;
        txHash: `0x${string}`;
        source: "curve" | "uniswap";
      }[];
    }>(
      `query($t:String!,$first:Int!){ trades(where:{token:$t}, first:$first, orderBy:timestamp, orderDirection:desc){ id trader { id } isBuy ethAmount tokenAmount priceEth timestamp txHash source } }`,
      { t: token.toLowerCase(), first: limit },
    );
    return d.trades.map(
      (t): TradeRow => ({
        id: t.id,
        token,
        trader: t.trader.id,
        isBuy: t.isBuy,
        ethAmount: Number(t.ethAmount),
        tokenAmount: Number(t.tokenAmount),
        priceEth: Number(t.priceEth),
        timestamp: Number(t.timestamp),
        txHash: t.txHash,
        source: t.source,
      }),
    );
  },
  async candles(token, interval) {
    const d = await query<{
      candles: { timestamp: string; open: string; high: string; low: string; close: string; volumeEth: string }[];
    }>(
      `query($t:String!,$i:Int!){ candles(where:{token:$t, interval:$i}, first:1000, orderBy:timestamp, orderDirection:asc){ timestamp open high low close volumeEth } }`,
      { t: token.toLowerCase(), i: interval },
    );
    return d.candles.map((c) => ({
      time: Number(c.timestamp),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volumeEth: Number(c.volumeEth),
    }));
  },
};
