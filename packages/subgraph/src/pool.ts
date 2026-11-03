import { BigDecimal, BigInt, dataSource } from "@graphprotocol/graph-ts";
import { Swap } from "../generated/templates/UniswapV3Pool/UniswapV3Pool";
import { Token } from "../generated/schema";
import { recordTrade, toDecimal, ZERO_BI } from "./helpers";

const Q96 = BigInt.fromI32(2).pow(96).toBigDecimal();

export function handleSwap(event: Swap): void {
  const context = dataSource.context();
  const token = Token.load(context.getBytes("token"));
  if (token == null) return;
  const tokenIsToken0 = context.getBoolean("tokenIsToken0");

  // Tutarlar pool açısından: pozitif = pool'a giren, negatif = pool'dan çıkan
  const tokenDelta = tokenIsToken0 ? event.params.amount0 : event.params.amount1;
  const ethDelta = tokenIsToken0 ? event.params.amount1 : event.params.amount0;
  const isBuy = tokenDelta.lt(ZERO_BI); // token pool'dan çıktıysa kullanıcı aldı

  // v3 fiyatı = (sqrtPriceX96 / 2^96)^2 = token1 / token0 (ikisi de 18 ondalık)
  const sqrt = event.params.sqrtPriceX96.toBigDecimal().div(Q96);
  const price1Per0 = sqrt.times(sqrt);
  const spot = tokenIsToken0 ? price1Per0 : BigDecimal.fromString("1").div(price1Per0);

  recordTrade(
    event,
    token,
    event.transaction.from,
    isBuy,
    toDecimal(ethDelta.abs()),
    toDecimal(tokenDelta.abs()),
    spot,
    "uniswap",
  );
}
