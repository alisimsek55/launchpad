// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Vm} from "forge-std/Vm.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {BaseTest} from "./Base.t.sol";
import {Constants as C} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

/// On-chain `quoteBuy` / `quoteBuyDetailed` görünümleri `buy` ile birebir aynı sonucu vermeli:
/// normal alım, tam eşiğe gelen alım ve eşiği aşan (iadeli) son alım; sniper fee penceresi dahil.
contract QuoteBuyTest is BaseTest {
    // packages/shared/src/curve.ts quoteBuy ile hesaplandı (sniper penceresi dışında, %1 fee).
    // Taze curve'e 4 ETH alımından sonra 2 ETH'lik terminal alım:
    uint256 internal constant TS_AFTER_4ETH_TOKENS = 788_059_701_492_537_313_432_835_821;
    uint256 internal constant TS_TERM_2ETH_TOKENS = 11_940_298_507_462_686_567_164_179;
    uint256 internal constant TS_TERM_2ETH_FEE = 2_424_242_424_242_425;
    uint256 internal constant TS_TERM_2ETH_REFUND = 1_757_575_757_575_757_575;
    // Taze curve'e 6 ETH alım (tek seferde graduation):
    uint256 internal constant TS_FRESH_6ETH_FEE = 42_424_242_424_242_425;
    uint256 internal constant TS_FRESH_6ETH_REFUND = 1_757_575_757_575_757_575;

    /// Teklifi al, aynı tutarla gerçek alımı yap, token / fee / iade birebir eşit olmalı.
    function _assertQuoteMatchesBuy(LaunchToken t, address who, uint256 ethIn)
        internal
        returns (uint256 tokens, uint256 fee, uint256 refund)
    {
        (tokens, fee, refund) = d.curve.quoteBuyDetailed(address(t), ethIn);
        (uint256 qTokens, uint256 qFee) = d.curve.quoteBuy(address(t), ethIn);
        assertEq(qTokens, tokens, "quoteBuy tokens");
        assertEq(qFee, fee, "quoteBuy fee");

        uint256 ethBefore = who.balance;
        uint256 tokBefore = t.balanceOf(who);
        vm.recordLogs();
        uint256 got = _buy(who, t, ethIn);

        assertEq(got, tokens, "tokens");
        assertEq(t.balanceOf(who) - tokBefore, tokens, "token balance");
        assertEq(_tradeFee(), fee, "fee");
        assertEq(ethBefore - who.balance, ethIn - refund, "spent (ethIn - refund)");
    }

    /// Graduation, artan WETH'yi de FeeVault'a yatırabildiği için fee, Trade event'inden okunur.
    function _tradeFee() internal returns (uint256) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(d.curve) && logs[i].topics[0] == BondingCurve.Trade.selector) {
                (,,, uint256 protocolFee, uint256 creatorFee,,,,) = abi.decode(
                    logs[i].data, (bool, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
                );
                return protocolFee + creatorFee;
            }
        }
        revert("Trade event yok");
    }

    function test_NonTerminal_MatchesBuyAndTs() public {
        LaunchToken t = _launchAndSettle();
        (uint256 tokens, uint256 fee, uint256 refund) = _assertQuoteMatchesBuy(t, alice, 4 ether);
        assertEq(tokens, TS_AFTER_4ETH_TOKENS);
        assertEq(fee, 0.04 ether);
        assertEq(refund, 0);
    }

    /// Eski görünüm fee'yi tüm ethIn üzerinden raporluyordu; terminal alımda yalnız brüt tutardan alınır.
    function test_Terminal_MatchesBuyAndTs() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 4 ether);
        (uint256 tokens, uint256 fee, uint256 refund) = _assertQuoteMatchesBuy(t, alice, 2 ether);
        assertEq(tokens, TS_TERM_2ETH_TOKENS);
        assertEq(fee, TS_TERM_2ETH_FEE);
        assertEq(refund, TS_TERM_2ETH_REFUND);
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
    }

    function test_FreshOvershoot_MatchesBuyAndTs() public {
        LaunchToken t = _launchAndSettle();
        (uint256 tokens, uint256 fee, uint256 refund) = _assertQuoteMatchesBuy(t, alice, 6 ether);
        assertEq(tokens, C.CURVE_SUPPLY);
        assertEq(fee, TS_FRESH_6ETH_FEE);
        assertEq(refund, TS_FRESH_6ETH_REFUND);
    }

    /// Tam eşiğe gelen alım (`>=` dalı): kalan arzın tamamı, iade 0.
    function test_ExactlyAtThreshold_MatchesBuy() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 1 ether);
        (uint256 x, uint256 y,, uint256 sold,) = _state(t);
        uint256 remaining = C.CURVE_SUPPLY - sold;
        uint256 needed = Math.mulDiv(x, y, y - remaining, Math.Rounding.Ceil) - x;
        uint256 gross = Math.mulDiv(needed, C.BPS, C.BPS - C.TRADE_FEE_BPS, Math.Rounding.Ceil);

        (uint256 tokens,, uint256 refund) = _assertQuoteMatchesBuy(t, alice, gross);
        assertEq(tokens, remaining);
        assertEq(refund, 0);
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
    }

    function test_SniperWindow_NonTerminal_MatchesBuy() public {
        LaunchToken t = _launch();
        uint256 t0 = vm.getBlockTimestamp();
        vm.warp(t0 + 17);
        (, uint256 fee,) = _assertQuoteMatchesBuy(t, alice, 1 ether);
        assertGt(fee, 0.1 ether); // sniper fee > %10
    }

    function test_SniperWindow_Overshoot_MatchesBuy() public {
        LaunchToken t = _launch();
        uint256 t0 = vm.getBlockTimestamp();
        vm.warp(t0 + 10);
        (uint256 tokens,, uint256 refund) = _assertQuoteMatchesBuy(t, alice, 10 ether);
        assertEq(tokens, C.CURVE_SUPPLY);
        assertGt(refund, 0);
    }

    function testFuzz_QuoteMatchesBuy(uint256 pre, uint256 ethIn, uint256 dt) public {
        LaunchToken t = _launch();
        uint256 t0 = vm.getBlockTimestamp();
        vm.warp(t0 + bound(dt, 0, 120));
        pre = bound(pre, 0, 4.5 ether);
        if (pre > 0) _buy(bob, t, pre);
        (,,,, bool graduated) = _state(t);
        vm.assume(!graduated);
        ethIn = bound(ethIn, 1, 8 ether);
        _assertQuoteMatchesBuy(t, alice, ethIn);
    }
}
