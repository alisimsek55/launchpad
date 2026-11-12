import type { Address } from "viem";
import { INDEXER_URL } from "@/config";
import type { CandleRow, DataSource, DayStat, ProtocolStats, TokenInfo, TokenVolume, TradeRow } from "./types";

/// Tüm veri Ponder indexer'ının REST API'sinden (apps/indexer/src/api/index.ts).
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${INDEXER_URL}${path}`, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`Indexer ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export const indexerSource: DataSource = {
  tokens: (sort, limit) => get<TokenInfo[]>(`/tokens?sort=${sort}&limit=${limit}`),
  tokensByCreator: (creator: Address) => get<TokenInfo[]>(`/users/${creator}/tokens`),
  token: (address) => get<TokenInfo | null>(`/tokens/${address}`),
  trades: (token, limit) => get<TradeRow[]>(`/tokens/${token}/trades?limit=${limit}`),
  candles: (token, interval) => get<CandleRow[]>(`/tokens/${token}/candles?interval=${interval}`),
  protocol: () => get<ProtocolStats>(`/protocol`),
  days: (since) => get<DayStat[]>(`/protocol/days?since=${since}`),
  topTokens: (since, limit) => get<TokenVolume[]>(`/protocol/top?since=${since}&limit=${limit}`),
};
