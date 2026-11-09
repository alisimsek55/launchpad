import { chainFor, curveParamsOf, getDeployment, type Network } from "@launchpad/shared";
import { formatEther } from "viem";

/// local (anvil fork) | testnet (herkese açık demo) | mainnet
export const network = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet") as Network;
export const deployment = getDeployment(network);
export const isLocal = deployment.network === "local";
export const isTestnet = deployment.network === "testnet";

export const chain = chainFor(deployment.chainId, deployment.rpcUrl);

/// İsteğe bağlı: varsa Privy ile giriş, yoksa tarayıcı cüzdanı (MetaMask/Rabby)
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
/// Ponder indexer (tüm veri: tokenlar, işlemler, mumlar, holders, analytics)
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069";

export const DEFAULT_SLIPPAGE_BPS = 100; // %1

/// Ağa göre değişen curve parametreleri (testnet'te mainnet'in 1/1000'i: graduation 0.0042 ETH)
export const curveParams = curveParamsOf(deployment);
export const GRADUATION_ETH = Number(formatEther(curveParams.graduationEth));
export const LAUNCH_FEE_ETH = formatEther(curveParams.launchFee);
