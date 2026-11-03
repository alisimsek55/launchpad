// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {Constants as C} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

contract TradeTest is BaseTest {
    // Değerler packages/shared/src/curve.ts ile hesaplandı: iki uygulama birebir aynı olmalı.
    uint256 internal constant TS_BUY_1ETH_TOKENS = 441_841_004_184_100_418_410_041_841;
    uint256 internal constant TS_SELL_HALF_ETH = 618_057_783_641_160_950;

    function test_Buy_MatchesTsReference() public {
        LaunchToken t = _launchAndSettle();
        uint256 got = _buy(alice, t, 1 ether);
        assertEq(got, TS_BUY_1ETH_TOKENS);
        assertEq(t.balanceOf(alice), got);

        // %1 fee: %0.5 protokol, %0.5 creator
        assertEq(d.feeVault.protocolBalance(), C.LAUNCH_FEE + 0.005 ether);
        assertEq(d.feeVault.creatorBalance(creator), 0.005 ether);
        assertEq(address(d.curve).balance, 0.99 ether);
    }

    function test_Sell_MatchesTsReference() public {
        LaunchToken t = _launchAndSettle();
        uint256 got = _buy(alice, t, 1 ether);
        uint256 before = alice.balance;
        uint256 ethOut = _sell(alice, t, got / 2);
        assertEq(ethOut, TS_SELL_HALF_ETH);
        assertEq(alice.balance - before, ethOut);
    }

    function test_QuoteMatchesExecution() public {
        LaunchToken t = _launchAndSettle();
        (uint256 quoted,) = d.curve.quoteBuy(address(t), 0.5 ether);
        assertEq(_buy(alice, t, 0.5 ether), quoted);

        (uint256 quotedEth,) = d.curve.quoteSell(address(t), quoted / 3);
        assertEq(_sell(alice, t, quoted / 3), quotedEth);
    }

    function test_SniperFee_DecaysLinearly() public {
        LaunchToken t = _launch();
        // via-IR, test içinde block.timestamp'i önbelleğe alabiliyor; mutlak zamanlarla warp et.
        uint256 t0 = block.timestamp;
        assertEq(d.curve.currentBuyFeeBps(address(t)), 2_000);
        vm.warp(t0 + 30);
        assertEq(d.curve.currentBuyFeeBps(address(t)), 1_050);
        vm.warp(t0 + 60);
        assertEq(d.curve.currentBuyFeeBps(address(t)), 100);
    }

    function test_SniperPaysTwentyPercent() public {
        LaunchToken t = _launch();
        _buy(alice, t, 1 ether);
        // %20 fee: 0.1 protokol + 0.1 creator
        assertEq(d.feeVault.protocolBalance(), C.LAUNCH_FEE + 0.1 ether);
        assertEq(d.feeVault.creatorBalance(creator), 0.1 ether);
    }

    function test_CreatorClaimsFees() public {
        LaunchToken t = _launchAndSettle();
        _buy(alice, t, 1 ether);
        uint256 before = creator.balance;
        vm.prank(creator);
        d.feeVault.claimCreatorFees();
        assertEq(creator.balance - before, 0.005 ether);
    }

    function test_RevertWhen_Slippage() public {
        LaunchToken t = _launchAndSettle();
        vm.prank(alice);
        vm.expectRevert(BondingCurve.Slippage.selector);
        d.curve.buy{value: 1 ether}(address(t), TS_BUY_1ETH_TOKENS + 1, block.timestamp, alice);
    }

    function test_RevertWhen_Expired() public {
        LaunchToken t = _launchAndSettle();
        vm.prank(alice);
        vm.expectRevert(BondingCurve.Expired.selector);
        d.curve.buy{value: 1 ether}(address(t), 0, block.timestamp - 1, alice);
    }

    function test_RevertWhen_TransferToPoolBeforeGraduation() public {
        LaunchToken t = _launchAndSettle();
        _buy(alice, t, 0.1 ether);
        address pool = t.pool();
        vm.prank(alice);
        vm.expectRevert(LaunchToken.TransferToPoolBeforeGraduation.selector);
        t.transfer(pool, 1);
    }

    /// Al-sat turu asla kâr bırakmaz (curve istismar edilemez).
    function testFuzz_BuyThenSellNeverProfits(uint256 ethIn) public {
        ethIn = bound(ethIn, 1e9, 4 ether);
        LaunchToken t = _launchAndSettle();
        uint256 got = _buy(alice, t, ethIn);
        uint256 ethOut = _sell(alice, t, got);
        assertLt(ethOut, ethIn);
    }

    /// Birden fazla kullanıcı karışık al-sat yaptığında curve hep ödeme gücüne sahiptir:
    /// herkes tüm token'ını satabilir.
    function testFuzz_EveryoneCanExit(uint256 a, uint256 b) public {
        a = bound(a, 1e12, 2 ether);
        b = bound(b, 1e12, 2 ether);
        LaunchToken t = _launchAndSettle();
        uint256 ga = _buy(alice, t, a);
        uint256 gb = _buy(bob, t, b);
        _sell(alice, t, ga);
        _sell(bob, t, gb);
        (,, uint256 realEth, uint256 sold,) = _state(t);
        assertEq(sold, 0);
        assertEq(address(d.curve).balance, realEth);
    }
}
