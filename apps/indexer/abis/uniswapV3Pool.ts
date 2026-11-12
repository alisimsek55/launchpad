import { parseAbi } from "viem";

/// Uniswap v3 pool'unun indexer'ın dinlediği event'leri. packages/shared'deki ABI yalnızca Swap'ı
/// içeriyor (otomatik üretilir, elle düzenlenmez); pool'un WETH bakiyesini event'lerden izlemek için
/// token hareketi yaratan diğer event'ler de gerekli. Burn token taşımaz (yalnızca tokensOwed yazar),
/// bakiyeden çıkış Collect ile olur; bu yüzden Burn dinlenmez.
export const uniswapV3PoolEventsAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)",
  "event CollectProtocol(address indexed sender, address indexed recipient, uint128 amount0, uint128 amount1)",
  "event Flash(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1)",
]);
