"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { API_URL, INDEXER_URL, SUBGRAPH_URL } from "@/config";
import { rpcSource } from "./rpc";
import { subgraphSource } from "./subgraph";
import type { DataSource, TokenSort } from "./types";

const source: DataSource = SUBGRAPH_URL ? subgraphSource : rpcSource;
const LIVE = { refetchInterval: 5_000 };

export const useTokens = (sort: TokenSort, limit = 60) =>
  useQuery({ queryKey: ["tokens", sort, limit], queryFn: () => source.tokens(sort, limit), ...LIVE });

export const useTokensByCreator = (creator: Address | undefined) =>
  useQuery({
    queryKey: ["tokensByCreator", creator],
    queryFn: () => source.tokensByCreator(creator!),
    enabled: !!creator,
  });

export const useToken = (address: Address) =>
  useQuery({ queryKey: ["token", address], queryFn: () => source.token(address), ...LIVE });

export const useTrades = (token: Address, limit = 50) =>
  useQuery({ queryKey: ["trades", token, limit], queryFn: () => source.trades(token, limit), ...LIVE });

export const useCandles = (token: Address, interval: number) =>
  useQuery({ queryKey: ["candles", token, interval], queryFn: () => source.candles(token, interval), ...LIVE });

export const useProtocol = () => useQuery({ queryKey: ["protocol"], queryFn: () => source.protocol(), ...LIVE });

export const useDays = (since: number) =>
  useQuery({ queryKey: ["days", since], queryFn: () => source.days(since), refetchInterval: 30_000 });

export const useTopTokens = (since: number, limit = 10) =>
  useQuery({ queryKey: ["topTokens", since, limit], queryFn: () => source.topTokens(since, limit), refetchInterval: 30_000 });

// ---------------------------------------------------------------- indexer (Ponder)

export type HolderRow = {
  rank: number;
  holder: Address;
  balance: string;
  sharePct: number;
  type: "Wallet" | "Contract";
  label: string | null;
};

export const useHolders = (token: Address) =>
  useQuery({
    queryKey: ["holders", token],
    queryFn: async () => {
      const res = await fetch(`${INDEXER_URL}/tokens/${token}/holders?limit=100`);
      if (!res.ok) return { holderCount: 0, holders: [] as HolderRow[] };
      return (await res.json()) as { holderCount: number; holders: HolderRow[] };
    },
    ...LIVE,
  });

export const useWalletBalances = (holder: Address | undefined) =>
  useQuery({
    queryKey: ["balances", holder],
    queryFn: async () => {
      const res = await fetch(`${INDEXER_URL}/users/${holder}/balances`);
      if (!res.ok) return [];
      return ((await res.json()) as { balances: { token: Address; balance: string }[] }).balances;
    },
    enabled: !!holder,
  });

// ---------------------------------------------------------------- metadata (api)

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  x?: string;
  telegram?: string;
  website?: string;
};

export const useMetadata = (uri: string | undefined) =>
  useQuery({
    queryKey: ["metadata", uri],
    queryFn: async () => {
      const res = await fetch(uri!);
      if (!res.ok) return null;
      return (await res.json()) as TokenMetadata;
    },
    // Sadece kendi API'mizin http(s) URI'lerini çöz
    enabled: !!uri && /^https?:\/\//.test(uri),
    staleTime: Infinity,
  });

export async function uploadMetadata(form: FormData): Promise<{ uri: string; image: string }> {
  const res = await fetch(`${API_URL}/metadata`, { method: "POST", body: form });
  const json = (await res.json()) as { uri?: string; image?: string; error?: string };
  if (!res.ok || !json.uri) throw new Error(json.error ?? "Metadata yüklenemedi");
  return { uri: json.uri, image: json.image! };
}
