import { Address, BigDecimal, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Candle, Protocol, ProtocolDayData, Token, TokenDayData, Trade, User } from "../generated/schema";

export const ZERO_BD = BigDecimal.zero();
export const ZERO_BI = BigInt.zero();
export const ONE_BI = BigInt.fromI32(1);
export const TOTAL_SUPPLY = BigDecimal.fromString("1000000000");
const WAD = BigDecimal.fromString("1000000000000000000");
const PROTOCOL_ID = Bytes.fromHexString("0x01");
const CANDLE_INTERVALS: i32[] = [60, 300, 3600, 21600, 86400];

export function toDecimal(value: BigInt): BigDecimal {
  return value.toBigDecimal().div(WAD);
}

export function getProtocol(): Protocol {
  let p = Protocol.load(PROTOCOL_ID);
  if (p == null) {
    p = new Protocol(PROTOCOL_ID);
    p.tokenCount = 0;
    p.graduatedCount = 0;
    p.tradeCount = ZERO_BI;
    p.volumeEth = ZERO_BD;
    p.feesEth = ZERO_BD;
    p.protocolRevenueEth = ZERO_BD;
  }
  return p;
}

export function getProtocolDay(timestamp: BigInt): ProtocolDayData {
  const day = timestamp.toI32() / 86400;
  const id = Bytes.fromI32(day);
  let d = ProtocolDayData.load(id);
  if (d == null) {
    d = new ProtocolDayData(id);
    d.date = day * 86400;
    d.volumeEth = ZERO_BD;
    d.feesEth = ZERO_BD;
    d.protocolRevenueEth = ZERO_BD;
    d.launches = 0;
    d.graduations = 0;
    d.tradeCount = 0;
  }
  return d;
}

export function getUser(address: Address): User {
  let u = User.load(address);
  if (u == null) {
    u = new User(address);
    u.tradeCount = ZERO_BI;
    u.volumeEth = ZERO_BD;
    u.tokensCreated = 0;
    u.save();
  }
  return u;
}

/// Curve ve Uniswap işlemleri için ortak kayıt: Trade + token/protokol/kullanıcı toplamları + mumlar.
export function recordTrade(
  event: ethereum.Event,
  token: Token,
  traderAddress: Address,
  isBuy: boolean,
  ethAmount: BigDecimal,
  tokenAmount: BigDecimal,
  spotPrice: BigDecimal,
  source: string,
): void {
  if (tokenAmount.equals(ZERO_BD)) return;
  const price = ethAmount.div(tokenAmount);
  const trader = getUser(traderAddress);

  const trade = new Trade(event.transaction.hash.concatI32(event.logIndex.toI32()));
  trade.token = token.id;
  trade.trader = trader.id;
  trade.isBuy = isBuy;
  trade.ethAmount = ethAmount;
  trade.tokenAmount = tokenAmount;
  trade.priceEth = price;
  trade.source = source;
  trade.timestamp = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.txHash = event.transaction.hash;
  trade.save();

  // Mumlar spot fiyatla çizilir: işlem öncesi spot → işlem sonrası spot. Ortalama işlem fiyatı
  // (`price`) yalnızca Trade.priceEth'te kalır; mumda kullanılırsa tek işlemlik mum open = close olur.
  const before = token.priceEth;
  token.priceEth = spotPrice;
  token.marketCapEth = spotPrice.times(TOTAL_SUPPLY);
  token.volumeEth = token.volumeEth.plus(ethAmount);
  token.tradeCount = token.tradeCount.plus(ONE_BI);
  token.save();

  trader.tradeCount = trader.tradeCount.plus(ONE_BI);
  trader.volumeEth = trader.volumeEth.plus(ethAmount);
  trader.save();

  const protocol = getProtocol();
  protocol.tradeCount = protocol.tradeCount.plus(ONE_BI);
  protocol.volumeEth = protocol.volumeEth.plus(ethAmount);
  protocol.save();

  const day = getProtocolDay(event.block.timestamp);
  day.volumeEth = day.volumeEth.plus(ethAmount);
  day.tradeCount = day.tradeCount + 1;
  day.save();

  updateTokenDay(token.id, event.block.timestamp, ethAmount);
  for (let i = 0; i < CANDLE_INTERVALS.length; i++) {
    updateCandle(token.id, CANDLE_INTERVALS[i], event.block.timestamp, before, spotPrice, ethAmount);
  }
}

function updateTokenDay(token: Bytes, timestamp: BigInt, ethAmount: BigDecimal): void {
  const day = timestamp.toI32() / 86400;
  const id = token.concatI32(day);
  let d = TokenDayData.load(id);
  if (d == null) {
    d = new TokenDayData(id);
    d.token = token;
    d.date = day * 86400;
    d.volumeEth = ZERO_BD;
    d.tradeCount = 0;
  }
  d.volumeEth = d.volumeEth.plus(ethAmount);
  d.tradeCount = d.tradeCount + 1;
  d.save();
}

function updateCandle(
  token: Bytes,
  interval: i32,
  timestamp: BigInt,
  before: BigDecimal,
  after: BigDecimal,
  ethAmount: BigDecimal,
): void {
  const start = (timestamp.toI32() / interval) * interval;
  const id = token.concatI32(interval).concatI32(start);
  let c = Candle.load(id);
  if (c == null) {
    c = new Candle(id);
    c.token = token;
    c.interval = interval;
    c.timestamp = BigInt.fromI32(start);
    c.open = before;
    c.high = before;
    c.low = before;
    c.volumeEth = ZERO_BD;
    c.tradeCount = 0;
  }
  if (after.gt(c.high)) c.high = after;
  if (after.lt(c.low)) c.low = after;
  c.close = after;
  c.volumeEth = c.volumeEth.plus(ethAmount);
  c.tradeCount = c.tradeCount + 1;
  c.save();
}
