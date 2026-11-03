import { BigDecimal } from "@graphprotocol/graph-ts";
import { FeesDeposited } from "../generated/FeeVault/FeeVault";
import { LPFeesCollected } from "../generated/LPLocker/LPLocker";
import { Token } from "../generated/schema";
import { getProtocol, getProtocolDay, toDecimal } from "./helpers";

const CREATOR_SHARE = BigDecimal.fromString("0.3");

/// Kasaya yatan her fee (işlem, launch, LP, graduation artığı) buradan sayılır.
export function handleFeesDeposited(event: FeesDeposited): void {
  const protocolAmount = toDecimal(event.params.protocolAmount);
  const creatorAmount = toDecimal(event.params.creatorAmount);
  const total = protocolAmount.plus(creatorAmount);
  // creator == 0 ise FeeVault tamamını protokole yazar
  const revenue = event.params.creator.toHexString() == "0x0000000000000000000000000000000000000000" ? total : protocolAmount;

  const protocol = getProtocol();
  protocol.feesEth = protocol.feesEth.plus(total);
  protocol.protocolRevenueEth = protocol.protocolRevenueEth.plus(revenue);
  protocol.save();

  const day = getProtocolDay(event.block.timestamp);
  day.feesEth = day.feesEth.plus(total);
  day.protocolRevenueEth = day.protocolRevenueEth.plus(revenue);
  day.save();
}

/// Graduation sonrası Uniswap LP fee'lerinin creator payı (ETH tarafı).
export function handleLPFeesCollected(event: LPFeesCollected): void {
  const token = Token.load(event.params.token);
  if (token == null) return;
  token.creatorFeesEth = token.creatorFeesEth.plus(toDecimal(event.params.ethAmount).times(CREATOR_SHARE));
  token.save();
}
