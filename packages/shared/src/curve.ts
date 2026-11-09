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

/// ETH ile alım: fee düşülür, kalan ETH curve'e girer. Token aşağı yuvarlanır (protokol lehine).
export function quoteBuy(state: CurveState, ethIn: bigint, feeBps: bigint = TRADE_FEE_BPS) {
  const fee = (ethIn * feeBps) / BPS;
  const ethToCurve = ethIn - fee;
  const k = state.virtualEth * state.virtualToken;
  const newX = state.virtualEth + ethToCurve;
  const newY = ceilDiv(k, newX);
  const tokenOut = state.virtualToken - newY;
  return { tokenOut, fee, next: { virtualEth: newX, virtualToken: newY } };
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
