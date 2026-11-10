"use client";

import { useQuery } from "@tanstack/react-query";
import { isTestnet } from "@/config";

/// ETH/USD gösterge fiyatı. Anahtarsız, tarayıcıdan (CORS *) çağrılabilen iki kaynak:
/// birincil Coinbase spot, yedek CoinGecko simple price. Gerekçe: notes.md "USD fiyatlar".
/// İkisi de düşerse `undefined` döner ve USD değerleri hiç gösterilmez (site ETH ile çalışmaya devam eder).
const SOURCES: { url: string; parse: (j: unknown) => unknown }[] = [
  {
    url: "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    parse: (j) => (j as { data?: { amount?: string } }).data?.amount,
  },
  {
    url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    parse: (j) => (j as { ethereum?: { usd?: number } }).ethereum?.usd,
  },
];

async function fetchEthUsd(): Promise<number> {
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) continue;
      const v = Number(s.parse(await res.json()));
      if (Number.isFinite(v) && v > 0) return v;
    } catch {
      // sıradaki kaynağa geç
    }
  }
  throw new Error("ETH/USD alınamadı");
}

const MINUTE = 60_000;

/// 1 ETH kaç USD; bilinmiyorsa undefined. Tüm sayfalar aynı önbelleği paylaşır (60 sn).
export function useEthUsd(): number | undefined {
  const { data } = useQuery({
    queryKey: ["ethUsd"],
    queryFn: fetchEthUsd,
    staleTime: MINUTE,
    refetchInterval: MINUTE,
    retry: 1,
  });
  return data;
}

/// USD değerlerinin üzerine gelince görünen açıklama
export const USD_NOTE = isTestnet
  ? "Gösterge değer: mainnet ETH/USD fiyatıyla hesaplanır (Coinbase). Testnet ETH'sinin gerçek değeri yoktur."
  : "ETH/USD fiyatı: Coinbase (yedek CoinGecko), 60 sn'de bir güncellenir.";
