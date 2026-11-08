import type { Address } from "viem";
import local from "../deployments/local.json";
import mainnet from "../deployments/mainnet.json";
import testnet from "../deployments/testnet.json";

/// Ağ başına deploy adresleri (protokol + o ağdaki WETH/Uniswap v3).
/// - local.json: anvil mainnet fork'unda `script/Simulate.s.sol` yazar.
/// - testnet.json: `script/DeployTestnet.s.sol` yazar (Uniswap v3'ü de kendisi deploy eder).
/// - mainnet.json: gerçek deploy sonrası elle güncellenir (audit şart, bkz. reports/deploy-runbook.md).
export type Network = "local" | "testnet" | "mainnet";

export type Deployment = {
  network: Network;
  chainId: number;
  rpcUrl: string;
  startBlock: number;
  tokenFactory: Address;
  bondingCurve: Address;
  graduator: Address;
  lpLocker: Address;
  feeVault: Address;
  dcaVault: Address;
  weth: Address;
  uniV3Factory: Address;
  uniPositionManager: Address;
  uniSwapRouter02: Address;
  uniQuoterV2: Address;
};

export const deployments = { local, testnet, mainnet } as Record<Network, Deployment>;

/// Bilinmeyen/boş değerde testnet (herkese açık demo ağı).
export function getDeployment(network: string | undefined): Deployment {
  if (network === "local" || network === "mainnet") return deployments[network];
  return deployments.testnet;
}
