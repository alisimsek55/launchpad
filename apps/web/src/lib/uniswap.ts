import { parseAbi } from "viem";

/// Graduation sonrası Uniswap v3 işlemleri için minimal ABI'ler.
export const swapRouter02Abi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);

export const quoterV2Abi = parseAbi([
  "struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }",
  // Zincirde nonpayable ama durum değiştirmez (swap simülasyonu içeride revert edilir); okuma olarak
  // çağırabilmek için view tanımlı. useSimulateContract graduated token'larda teklif döndürmüyordu.
  "function quoteExactInputSingle(QuoteExactInputSingleParams params) view returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

/// SwapRouter02: çıktıyı router'da tut (sonra unwrapWETH9 ile ETH olarak gönder)
export const ADDRESS_THIS = "0x0000000000000000000000000000000000000002";
export const UNI_FEE_TIER = 10_000;
