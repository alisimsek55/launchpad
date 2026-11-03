import { getDeployment, robinhood } from "@launchpad/shared";
import { defineChain } from "viem";

export const network = process.env.NEXT_PUBLIC_NETWORK === "local" ? "local" : "mainnet";
export const deployment = getDeployment(network);
export const isLocal = network === "local";

/// Robinhood Chain; yerelde RPC anvil fork'una yönlenir (chain id aynı kalır).
export const chain = defineChain({
  ...robinhood,
  rpcUrls: { default: { http: [deployment.rpcUrl] } },
});

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
/// Goldsky subgraph GraphQL URL'i. Boşsa (yerel) veriler doğrudan zincirden okunur.
export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? "";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const DEFAULT_SLIPPAGE_BPS = 100; // %1
