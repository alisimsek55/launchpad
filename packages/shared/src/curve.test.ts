import { describe, expect, it } from "vitest";
import {
  curveParamsOf,
  maxDevBuyEth,
  CURVE_SUPPLY,
  GRADUATION_ETH,
  LP_SUPPLY,
  buyFeeBps,
  initialCurve,
  quoteBuy,
  quoteSell,
  remainingCurveSupply,
  spotPrice,
  VIRTUAL_TOKEN,
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

// Beklenen değerler BondingCurve._buy formülleriyle BigInt'te ayrıca hesaplandı.
describe("eşiği aşan son alım (BondingCurve._buy ile birebir)", () => {
  const graduatedNext = { virtualEth: 5_600_000_000_000_000_000n, virtualToken: 266_666_666_666_666_666_666_666_667n };

  it("başlangıçtan 6 ETH @ %1: 800M token, fee brüt tutardan, fazlası iade", () => {
    const q = quoteBuy(initialCurve(), 6n * 10n ** 18n, 100n);
    expect(q.tokenOut).toBe(CURVE_SUPPLY);
    expect(q.fee).toBe(42_424_242_424_242_425n);
    expect(q.refund).toBe(1_757_575_757_575_757_575n);
    expect(q.graduates).toBe(true);
    expect(q.next).toEqual(graduatedNext);
    // curve'e giren ETH + fee + iade = gönderilen ETH
    expect(q.next.virtualEth - initialCurve().virtualEth + q.fee + q.refund).toBe(6n * 10n ** 18n);
  });

  it("curve ortasından fee'siz taşan alım: kalan token, fazla ETH iade", () => {
    const mid = quoteBuy(initialCurve(), 10n ** 18n, 0n);
    expect(mid.graduates).toBe(false);
    expect(remainingCurveSupply(mid.next)).toBe(CURVE_SUPPLY - mid.tokenOut);
    const q = quoteBuy(mid.next, 5n * 10n ** 18n, 0n);
    expect(q.tokenOut).toBe(355_555_555_555_555_555_555_555_556n);
    expect(mid.tokenOut + q.tokenOut).toBe(CURVE_SUPPLY);
    expect(q.fee).toBe(0n);
    expect(q.refund).toBe(1_800_000_000_000_000_000n);
    expect(q.next).toEqual(graduatedNext);
  });

  it("tam eşik (4.2 ETH, fee'siz): CURVE_SUPPLY, iade 0", () => {
    const q = quoteBuy(initialCurve(), GRADUATION_ETH, 0n);
    expect(q.tokenOut).toBe(CURVE_SUPPLY);
    expect(q.fee).toBe(0n);
    expect(q.refund).toBe(0n);
    expect(q.graduates).toBe(true);
    expect(q.next).toEqual(graduatedNext);
  });

  it("eşik altı alım değişmedi: refund 0, next = ceil(k / (x + ethToCurve))", () => {
    const start = initialCurve();
    const q = quoteBuy(start, 10n ** 18n);
    expect(q.fee).toBe(10n ** 16n);
    expect(q.refund).toBe(0n);
    expect(q.graduates).toBe(false);
    const newX = start.virtualEth + 10n ** 18n - 10n ** 16n;
    const k = start.virtualEth * start.virtualToken;
    const newY = (k + newX - 1n) / newX;
    expect(q.next).toEqual({ virtualEth: newX, virtualToken: newY });
    expect(q.tokenOut).toBe(start.virtualToken - newY);
  });

  it("graduation olmuş veya geçersiz durumda hata verir (sözleşme revert eder)", () => {
    expect(() => quoteBuy(graduatedNext, 1n)).toThrow(RangeError);
    expect(() => quoteBuy({ virtualEth: VIRTUAL_TOKEN, virtualToken: VIRTUAL_TOKEN + 1n }, 1n)).toThrow(RangeError);
  });
});

describe("testnet parametreleri (1/1000)", () => {
  const testnet = curveParamsOf({
    virtualEth: "1400000000000000",
    graduationEth: "4200000000000000",
    launchFee: "500000000000",
  });

  it("0.0042 ETH (fee hariç) ile ~800M token satılır, fiyat Uniswap açılışına eşit", () => {
    const { tokenOut, next } = quoteBuy(initialCurve(testnet), testnet.graduationEth, 0n);
    const diff = tokenOut > CURVE_SUPPLY ? tokenOut - CURVE_SUPPLY : CURVE_SUPPLY - tokenOut;
    expect(diff < 10n ** 12n).toBe(true);
    const poolPrice = (testnet.graduationEth * 10n ** 18n) / LP_SUPPLY;
    const d = spotPrice(next) > poolPrice ? spotPrice(next) - poolPrice : poolPrice - spotPrice(next);
    expect(d <= 1n).toBe(true);
  });

  it("dev buy sınırı ETH cinsinden de 1/1000 ölçeklenir", () => {
    const ratio = Number(maxDevBuyEth()) / Number(maxDevBuyEth(testnet));
    expect(Math.round(ratio)).toBe(1000);
  });

  it("0.006 ETH @ %1 eşiği aşar: 800M token, fee ve iade 1/1000 ölçekli (yuvarlama sözleşmedeki gibi)", () => {
    const q = quoteBuy(initialCurve(testnet), 6n * 10n ** 15n, 100n);
    expect(q.tokenOut).toBe(CURVE_SUPPLY);
    expect(q.fee).toBe(42_424_242_424_243n);
    expect(q.refund).toBe(1_757_575_757_575_757n);
    expect(q.next).toEqual({ virtualEth: 5_600_000_000_000_000n, virtualToken: 266_666_666_666_666_666_666_666_667n });
  });

  it("tam eşik (0.0042 ETH, fee'siz): CURVE_SUPPLY, iade 0", () => {
    const q = quoteBuy(initialCurve(testnet), testnet.graduationEth, 0n);
    expect(q.tokenOut).toBe(CURVE_SUPPLY);
    expect(q.refund).toBe(0n);
    expect(q.graduates).toBe(true);
  });
});
