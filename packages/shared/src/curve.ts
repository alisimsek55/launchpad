import { parseEther } from "viem";

// Kaynak: const.md — packages/contracts/src/Constants.sol ile birebir aynı olmalı.
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const CURVE_SUPPLY = 800_000_000n * 10n ** 18n;
export const LP_SUPPLY = 200_000_000n * 10n ** 18n;
export const GRADUATION_ETH = parseEther("4.2");
export const VIRTUAL_ETH = parseEther("1.4");
export const VIRTUAL_TOKEN = 1_066_666_666_666_666_666_666_666_667n;

export const BPS = 10_000n;
export const TRADE_FEE_BPS = 100n;
export const PROTOCOL_FEE_BPS = 50n;
export const CREATOR_FEE_BPS = 50n;
export const SNIPER_WINDOW = 60n;
export const SNIPER_FEE_START_BPS = 2_000n;

export type CurveState = {
  virtualEth: bigint; // x
  virtualToken: bigint; // y
};

/// Ağa göre değişen ETH miktarları (testnet'te mainnet'in 1/1000'i). Kaynak: deploy dosyası.
export type CurveParams = { virtualEth: bigint; graduationEth: bigint; launchFee: bigint };

export const MAINNET_CURVE_PARAMS: CurveParams = {
  virtualEth: VIRTUAL_ETH,
  graduationEth: GRADUATION_ETH,
  launchFee: parseEther("0.0005"),
};

export function curveParamsOf(d: { virtualEth: string; graduationEth: string; launchFee: string }): CurveParams {
  return { virtualEth: BigInt(d.virtualEth), graduationEth: BigInt(d.graduationEth), launchFee: BigInt(d.launchFee) };
}

export const initialCurve = (params: CurveParams = MAINNET_CURVE_PARAMS): CurveState => ({
  virtualEth: params.virtualEth,
  virtualToken: VIRTUAL_TOKEN,
});

/// Arzın %5'i sınırına denk gelen en yüksek dev buy (fee dahil): (k / (y0 - 50M) - x0) / 0.99
export function maxDevBuyEth(params: CurveParams = MAINNET_CURVE_PARAMS): bigint {
  const maxTokens = 50_000_000n * 10n ** 18n;
  const x0 = params.virtualEth;
  return (((x0 * VIRTUAL_TOKEN) / (VIRTUAL_TOKEN - maxTokens) - x0) * 10_000n) / 9_900n;
}

/// Launch'tan bu yana geçen süreye göre alım fee'si (bps): %20'den %1'e lineer düşüş.
export function buyFeeBps(secondsSinceLaunch: bigint): bigint {
  if (secondsSinceLaunch >= SNIPER_WINDOW) return TRADE_FEE_BPS;
  const range = SNIPER_FEE_START_BPS - TRADE_FEE_BPS;
  return SNIPER_FEE_START_BPS - (range * secondsSinceLaunch) / SNIPER_WINDOW;
}

/// Curve'de satılmayı bekleyen token. Sözleşmede her alım/satım `virtualToken` ile `tokensSold`'u
/// aynı miktarda ters yönde değiştirir ve başlangıçta virtualToken = VIRTUAL_TOKEN, tokensSold = 0'dır;
/// yani tokensSold = VIRTUAL_TOKEN - virtualToken her zaman tam olarak geçerlidir (iki ağda da).
export function remainingCurveSupply(state: CurveState): bigint {
  const tokensSold = VIRTUAL_TOKEN - state.virtualToken;
  if (tokensSold < 0n || tokensSold >= CURVE_SUPPLY) {
    // Sözleşmede ulaşılamaz durum ya da graduation olmuş curve (orada AlreadyGraduated ile revert eder).
    throw new RangeError("Geçersiz veya graduation olmuş curve durumu");
  }
  return CURVE_SUPPLY - tokensSold;
}

/// ETH ile alım: fee düşülür, kalan ETH curve'e girer. Token aşağı yuvarlanır (protokol lehine).
/// BondingCurve._buy ile birebir: eşiği aşan (veya tam eşiğe gelen) son alım kalan token'la sınırlanır,
/// curve'e yalnızca gereken ETH girer, fee bu brüt tutar üzerinden alınır, fazlası `refund` olarak iade edilir.
export function quoteBuy(state: CurveState, ethIn: bigint, feeBps: bigint = TRADE_FEE_BPS) {
  const x = state.virtualEth;
  const y = state.virtualToken;
  const remaining = remainingCurveSupply(state);

  let fee = (ethIn * feeBps) / BPS;
  let ethToCurve = ethIn - fee;
  let tokenOut = y - ceilDiv(x * y, x + ethToCurve);
  let refund = 0n;
  // Sözleşmedeki gibi `>=`: tam eşiğe gelen alım da bu daldan geçer (sonuç aynı, refund 0 olabilir).
  const graduates = tokenOut >= remaining;
  if (graduates) {
    tokenOut = remaining;
    ethToCurve = ceilDiv(x * y, y - remaining) - x;
    let gross = ceilDiv(ethToCurve * BPS, BPS - feeBps);
    if (gross > ethIn) gross = ethIn;
    fee = gross - ethToCurve;
    refund = ethIn - gross;
  }
  return { tokenOut, fee, refund, graduates, next: { virtualEth: x + ethToCurve, virtualToken: y - tokenOut } };
}

/// Token satışı: curve'den çıkan ETH'den fee düşülür. ETH aşağı yuvarlanır (protokol lehine).
export function quoteSell(state: CurveState, tokenIn: bigint, feeBps: bigint = TRADE_FEE_BPS) {
  const k = state.virtualEth * state.virtualToken;
  const newY = state.virtualToken + tokenIn;
  const newX = ceilDiv(k, newY);
  const ethFromCurve = state.virtualEth - newX;
  const fee = (ethFromCurve * feeBps) / BPS;
  return { ethOut: ethFromCurve - fee, fee, next: { virtualEth: newX, virtualToken: newY } };
}

/// Fiyat (token başına ETH), 18 ondalıklı sabit nokta.
export function spotPrice(state: CurveState): bigint {
  return (state.virtualEth * 10n ** 18n) / state.virtualToken;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}
