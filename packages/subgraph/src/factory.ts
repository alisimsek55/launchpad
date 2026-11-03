import { BigDecimal } from "@graphprotocol/graph-ts";
import { TokenCreated } from "../generated/TokenFactory/TokenFactory";
import { Token } from "../generated/schema";
import { getProtocol, getProtocolDay, getUser, TOTAL_SUPPLY, ZERO_BD, ZERO_BI } from "./helpers";

// Robinhood Chain mainnet WETH (const.md), küçük harf. token0/token1 sıralaması için.
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";

// Başlangıç spot fiyatı: VIRTUAL_ETH / VIRTUAL_TOKEN = 1.4 / 1066666666.67
const INITIAL_PRICE = BigDecimal.fromString("0.0000000013125");

export function handleTokenCreated(event: TokenCreated): void {
  const creator = getUser(event.params.creator);
  creator.tokensCreated = creator.tokensCreated + 1;
  creator.save();

  const token = new Token(event.params.token);
  token.creator = creator.id;
  token.name = event.params.name;
  token.symbol = event.params.symbol;
  token.metadataURI = event.params.metadataURI;
  token.pool = event.params.pool;
  // Aynı uzunlukta küçük harfli hex: string karşılaştırması = sayısal karşılaştırma (Uniswap token0 kuralı)
  token.tokenIsToken0 = event.params.token.toHexString() < WETH;
  token.createdAt = event.block.timestamp;
  token.createdAtBlock = event.block.number;
  token.graduated = false;
  token.priceEth = INITIAL_PRICE;
  token.marketCapEth = INITIAL_PRICE.times(TOTAL_SUPPLY);
  token.volumeEth = ZERO_BD;
  token.tradeCount = ZERO_BI;
  token.realEth = ZERO_BD;
  token.creatorFeesEth = ZERO_BD;
  token.save();

  const protocol = getProtocol();
  protocol.tokenCount = protocol.tokenCount + 1;
  protocol.save();

  const day = getProtocolDay(event.block.timestamp);
  day.launches = day.launches + 1;
  day.save();
}
