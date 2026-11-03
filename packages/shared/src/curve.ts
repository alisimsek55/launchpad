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
export const PROTOCOL_FEE_BPS = 70n;
export const CREATOR_FEE_BPS = 30n;
export const SNIPER_WINDOW = 60n;
export const SNIPER_FEE_START_BPS = 2_000n;

export type CurveState = {
  virtualEth: bigint; // x
  virtualToken: bigint; // y
};

export const initialCurve = (): CurveState => ({
  virtualEth: VIRTUAL_ETH,
  virtualToken: VIRTUAL_TOKEN,
});

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
