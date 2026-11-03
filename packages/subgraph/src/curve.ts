import { Trade as TradeEvent } from "../generated/BondingCurve/BondingCurve";
import { Token } from "../generated/schema";
import { recordTrade, toDecimal } from "./helpers";

export function handleCurveTrade(event: TradeEvent): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  // İşlem sonrası spot fiyat = virtualEth / virtualToken
  const spot = toDecimal(event.params.virtualEth).div(toDecimal(event.params.virtualToken));

  token.realEth = toDecimal(event.params.realEth);
  token.creatorFeesEth = token.creatorFeesEth.plus(toDecimal(event.params.creatorFee));

  recordTrade(
    event,
    token,
    event.params.trader,
    event.params.isBuy,
    toDecimal(event.params.ethAmount),
    toDecimal(event.params.tokenAmount),
    spot,
    "curve",
  );
}
