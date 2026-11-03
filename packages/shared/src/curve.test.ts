import { describe, expect, it } from "vitest";
import {
  CURVE_SUPPLY,
  GRADUATION_ETH,
  LP_SUPPLY,
  buyFeeBps,
  initialCurve,
  quoteBuy,
  quoteSell,
  spotPrice,
} from "./curve";

describe("bonding curve", () => {
  it("4.2 ETH (fee hariç) ile ~800M token satılır", () => {
    const { tokenOut } = quoteBuy(initialCurve(), GRADUATION_ETH, 0n);
    const diff = tokenOut > CURVE_SUPPLY ? tokenOut - CURVE_SUPPLY : CURVE_SUPPLY - tokenOut;
    expect(diff < 10n ** 9n).toBe(true); // yuvarlama farkı < 1e-9 token
  });

  it("graduation fiyatı Uniswap açılış fiyatına eşit", () => {
    const { next } = quoteBuy(initialCurve(), GRADUATION_ETH, 0n);
    const poolPrice = (GRADUATION_ETH * 10n ** 18n) / LP_SUPPLY;
    const curvePrice = spotPrice(next);
    const diff = curvePrice > poolPrice ? curvePrice - poolPrice : poolPrice - curvePrice;
    expect(diff <= 1n).toBe(true);
  });

  it("al-sat turu kullanıcıya kâr bırakmaz (k azalmaz)", () => {
    const start = initialCurve();
    const buy = quoteBuy(start, 10n ** 18n, 0n);
    const sell = quoteSell(buy.next, buy.tokenOut, 0n);
    expect(sell.ethOut <= 10n ** 18n).toBe(true);
    expect(sell.next.virtualEth * sell.next.virtualToken >= start.virtualEth * start.virtualToken).toBe(true);
  });

  it("sniper fee'si %20'den %1'e iner", () => {
    expect(buyFeeBps(0n)).toBe(2000n);
    expect(buyFeeBps(30n)).toBe(1050n);
    expect(buyFeeBps(60n)).toBe(100n);
    expect(buyFeeBps(600n)).toBe(100n);
  });
});
