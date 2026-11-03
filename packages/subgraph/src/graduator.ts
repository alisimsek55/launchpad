import { DataSourceContext } from "@graphprotocol/graph-ts";
import { Graduated } from "../generated/Graduator/Graduator";
import { Token } from "../generated/schema";
import { UniswapV3Pool } from "../generated/templates";
import { getProtocol, getProtocolDay } from "./helpers";

export function handleGraduated(event: Graduated): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  token.graduated = true;
  token.graduatedAt = event.block.timestamp;
  token.save();

  const protocol = getProtocol();
  protocol.graduatedCount = protocol.graduatedCount + 1;
  protocol.save();

  const day = getProtocolDay(event.block.timestamp);
  day.graduations = day.graduations + 1;
  day.save();

  // Bundan sonraki işlemler Uniswap pool'unda: Swap event'lerini dinlemeye başla.
  const context = new DataSourceContext();
  context.setBytes("token", token.id);
  context.setBoolean("tokenIsToken0", token.tokenIsToken0);
  UniswapV3Pool.createWithContext(event.params.pool, context);
}
