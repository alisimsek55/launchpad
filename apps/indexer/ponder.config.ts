import { getDeployment, launchTokenAbi, tokenFactoryAbi } from "@launchpad/shared";
import { createConfig, factory } from "ponder";
import { getAbiItem } from "viem";

// Adresler packages/shared/deployments/<ağ>.json'dan; env değişkenleri bunları ezer.
// Yerel: LAUNCHPAD_NETWORK=local (anvil + script/Simulate.s.sol)
const deployment = getDeployment(process.env.LAUNCHPAD_NETWORK);
const factoryAddress = (process.env.TOKEN_FACTORY_ADDRESS ?? deployment.tokenFactory) as `0x${string}`;
const startBlock = Number(process.env.START_BLOCK ?? deployment.startBlock);

export default createConfig({
  chains: {
    robinhood: {
      id: deployment.chainId,
      rpc: process.env.PONDER_RPC_URL_4663 ?? deployment.rpcUrl,
    },
  },
  contracts: {
    TokenFactory: {
      abi: tokenFactoryAbi,
      chain: "robinhood",
      address: factoryAddress,
      startBlock,
    },
    // Factory'nin oluşturduğu her token'ın Transfer event'leri
    LaunchToken: {
      abi: launchTokenAbi,
      chain: "robinhood",
      address: factory({
        address: factoryAddress,
        event: getAbiItem({ abi: tokenFactoryAbi, name: "TokenCreated" }),
        parameter: "token",
      }),
      startBlock,
    },
  },
});
