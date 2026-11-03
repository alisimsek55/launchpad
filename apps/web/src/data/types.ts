import type { Address, Hash } from "viem";

/// Görüntüleme için sayılar JS number (ETH / token birimi). Zincire giden tutarlar her zaman bigint.
export type TokenInfo = {
  address: Address;
  name: string;
  symbol: string;
  metadataURI: string;
  creator: Address;
  pool: Address;
  createdAt: number;
  graduated: boolean;
  priceEth: number;
  marketCapEth: number;
  volumeEth: number;
  tradeCount: number;
  /// Curve'deki ETH; graduation ilerlemesi = realEth / 4.2
  realEth: number;
  creatorFeesEth: number;
};

export type TradeRow = {
  id: string;
  token: Address;
  trader: Address;
  isBuy: boolean;
  ethAmount: number;
  tokenAmount: number;
  priceEth: number;
  timestamp: number;
  txHash: Hash;
  source: "curve" | "uniswap";
};

export type CandleRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeEth: number;
};

export type TokenSort = "new" | "marketCap" | "volume";

export interface DataSource {
  tokens(sort: TokenSort, limit: number): Promise<TokenInfo[]>;
  tokensByCreator(creator: Address): Promise<TokenInfo[]>;
  token(address: Address): Promise<TokenInfo | null>;
  trades(token: Address, limit: number): Promise<TradeRow[]>;
  candles(token: Address, interval: number): Promise<CandleRow[]>;
}

export const CANDLE_INTERVALS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "1h", seconds: 3600 },
  { label: "6h", seconds: 21600 },
  { label: "1D", seconds: 86400 },
] as const;
