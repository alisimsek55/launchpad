import { defineChain } from "viem";

// Kaynak: const.md (2026-11-03'te doğrulandı)
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
  // Standart Multicall3 adresi; 2026-11-03'te zincirde doğrulandı (const.md)
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  // Multicall3 testnet'te de standart adreste (2026-11-09'da zincirde doğrulandı)
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

/// Deploy dosyasındaki chainId + RPC'ye göre viem zinciri (yerel fork mainnet id'sini korur).
export function chainFor(chainId: number, rpcUrl: string) {
  const base = chainId === robinhoodTestnet.id ? robinhoodTestnet : robinhood;
  return defineChain({ ...base, rpcUrls: { default: { http: [rpcUrl] } } });
}
