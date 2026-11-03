import { launchTokenAbi, robinhood, tokenFactoryAbi } from "@launchpad/shared";
import { createConfig, factory } from "ponder";
import { getAbiItem } from "viem";

// Deploy adresleri env'den gelir (mainnet deploy'undan sonra .env'ye yazılacak, bkz. env.example).
const factoryAddress = (process.env.TOKEN_FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const startBlock = Number(process.env.START_BLOCK ?? 0);

export default createConfig({
  chains: {
    robinhood: {
      id: robinhood.id,
      rpc: process.env.PONDER_RPC_URL_4663 ?? robinhood.rpcUrls.default.http[0],
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
