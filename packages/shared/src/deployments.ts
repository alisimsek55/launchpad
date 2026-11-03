import type { Address } from "viem";
import local from "../deployments/local.json";
import mainnet from "../deployments/mainnet.json";

/// Ağ başına deploy adresleri.
/// - mainnet.json: gerçek deploy sonrası elle güncellenir.
/// - local.json: anvil fork'unda `script/Simulate.s.sol` tarafından otomatik yazılır.
export type Deployment = {
  network: "local" | "mainnet";
  chainId: number;
  rpcUrl: string;
  startBlock: number;
  tokenFactory: Address;
  bondingCurve: Address;
  graduator: Address;
  lpLocker: Address;
  feeVault: Address;
  dcaVault: Address;
};

export const deployments = { local, mainnet } as Record<Deployment["network"], Deployment>;

export function getDeployment(network: string | undefined): Deployment {
  return network === "local" ? deployments.local : deployments.mainnet;
}
