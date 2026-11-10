import {
  bondingCurveAbi,
  feeVaultAbi,
  getDeployment,
  graduatorAbi,
  launchTokenAbi,
  lpLockerAbi,
  tokenFactoryAbi,
  uniswapV3PoolAbi,
} from "@launchpad/shared";
import { createConfig, factory } from "ponder";
import { getAbiItem } from "viem";

// Adresler packages/shared/deployments/<ağ>.json'dan. LAUNCHPAD_NETWORK = local | testnet | mainnet
// (boşsa testnet). PONDER_RPC_URL_<chainId> RPC'yi ezer.
const d = getDeployment(process.env.LAUNCHPAD_NETWORK);
const startBlock = Number(process.env.START_BLOCK ?? d.startBlock);

export default createConfig({
  chains: {
    robinhood: {
      id: d.chainId,
      rpc: process.env[`PONDER_RPC_URL_${d.chainId}`] ?? d.rpcUrl,
      // Testnet saniyede ~7 blok üretiyor. RPC önbelleği her blokta veritabanına yazar; ücretsiz
      // sunucuda (0.1 CPU, uzak Postgres) bu yazmalar indexer'ı zincirin gerisinde bırakıyordu.
      cacheRpcRequests: false,
    },
  },
  contracts: {
    TokenFactory: { abi: tokenFactoryAbi, chain: "robinhood", address: d.tokenFactory, startBlock },
    BondingCurve: { abi: bondingCurveAbi, chain: "robinhood", address: d.bondingCurve, startBlock },
    Graduator: { abi: graduatorAbi, chain: "robinhood", address: d.graduator, startBlock },
    FeeVault: { abi: feeVaultAbi, chain: "robinhood", address: d.feeVault, startBlock },
    LPLocker: { abi: lpLockerAbi, chain: "robinhood", address: d.lpLocker, startBlock },
    // Factory'nin oluşturduğu her token'ın Transfer event'leri (holders)
    LaunchToken: {
      abi: launchTokenAbi,
      chain: "robinhood",
      address: factory({
        address: d.tokenFactory,
        event: getAbiItem({ abi: tokenFactoryAbi, name: "TokenCreated" }),
        parameter: "token",
      }),
      startBlock,
    },
    // Graduation sonrası her token'ın Uniswap v3 pool'u (trades/mumlar devam eder)
    UniswapPool: {
      abi: uniswapV3PoolAbi,
      chain: "robinhood",
      address: factory({
        address: d.graduator,
        event: getAbiItem({ abi: graduatorAbi, name: "Graduated" }),
        parameter: "pool",
      }),
      startBlock,
    },
  },
});
