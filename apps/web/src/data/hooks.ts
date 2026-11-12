"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { INDEXER_URL } from "@/config";
import { indexerSource } from "./indexer";
import { fetchMetadata, isSupportedMetadataURI } from "./metadata";
import type { DataSource, TokenSort } from "./types";

const source: DataSource = indexerSource;
const LIVE = { refetchInterval: 5_000 };

export const useTokens = (sort: TokenSort, limit = 60) =>
  useQuery({
    queryKey: ["tokens", sort, limit],
    queryFn: () => source.tokens(sort, limit),
    retry: false,
    ...LIVE,
  });

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
      // Hata "boş liste" gibi gösterilmez; React Query yeniden dener ve isError verir.
      // (Henüz indekslenmemiş token için indexer zaten 200 + boş liste döner.)
      if (!res.ok) throw new Error(`Indexer ${res.status}: holders`);
      return (await res.json()) as { holderCount: number; holders: HolderRow[] };
    },
    ...LIVE,
  });

export const useWalletBalances = (holder: Address | undefined) =>
  useQuery({
    queryKey: ["balances", holder],
    queryFn: async () => {
      const res = await fetch(`${INDEXER_URL}/users/${holder}/balances`);
      // 503 vb. "hiç token yok" gibi görünmesin: fırlat, tüketici isError ile ayırt etsin
      if (!res.ok) throw new Error(`Indexer ${res.status}: balances`);
      return ((await res.json()) as { balances: { token: Address; balance: string }[] }).balances;
    },
    enabled: !!holder,
  });

// ---------------------------------------------------------------- metadata

export type { TokenMetadata } from "./metadata";

export const useMetadata = (uri: string | undefined) =>
  useQuery({
    queryKey: ["metadata", uri],
    // Doğrulama ve boyut sınırı ./metadata.ts'de (içerik güvenilmez: kontrata herkes yazabilir)
    queryFn: () => fetchMetadata(uri!),
    // Zincir üstü data: URI (token oluşturma formu böyle yazar) veya https
    enabled: isSupportedMetadataURI(uri),
    // data: URI değişmez; https içeriği değişebilir ve geçici hatalar yeniden denenmeli
    staleTime: uri?.startsWith("data:") ? Infinity : 5 * 60_000,
  });
