// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BaseTest} from "./Base.t.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {Constants as C} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

/// Rastgele al-sat dizileri üreten handler.
contract CurveHandler is Test {
    BondingCurve internal curve;
    LaunchToken internal token;
    address[3] internal actors;
    uint256 public lastK;

    constructor(BondingCurve curve_, LaunchToken token_) {
        curve = curve_;
        token = token_;
        actors = [makeAddr("h1"), makeAddr("h2"), makeAddr("h3")];
        for (uint256 i; i < 3; i++) {
            vm.deal(actors[i], 1_000 ether);
        }
        lastK = C.VIRTUAL_ETH * C.VIRTUAL_TOKEN;
    }

    function buy(uint256 actorSeed, uint256 eth, uint256 dt) external {
        if (_graduated()) return;
        vm.warp(block.timestamp + bound(dt, 0, 30));
        address a = actors[actorSeed % 3];
        eth = bound(eth, 1e9, 1 ether);
        vm.prank(a);
        curve.buy{value: eth}(address(token), 0, block.timestamp, a);
        _checkK();
    }

    function sell(uint256 actorSeed, uint256 pct) external {
        if (_graduated()) return;
        address a = actors[actorSeed % 3];
        uint256 bal = token.balanceOf(a);
        uint256 amount = bal * bound(pct, 1, 100) / 100;
        if (amount == 0) return;
        vm.startPrank(a);
        token.approve(address(curve), amount);
        curve.sell(address(token), amount, 0, block.timestamp, a);
        vm.stopPrank();
        _checkK();
    }

    function _graduated() internal view returns (bool g) {
        (,,,,,, g) = curve.curves(address(token));
    }

    /// k hiçbir işlemde azalmamalı (yuvarlama hep curve lehine).
    function _checkK() internal {
        (uint128 x, uint128 y,,,,, bool g) = curve.curves(address(token));
        if (g) return;
        uint256 k = uint256(x) * y;
        assertGe(k, lastK, "k azaldi");
        lastK = k;
    }
}

/// forge-config: default.invariant.runs = 32
/// forge-config: default.invariant.depth = 40
contract CurveInvariantTest is BaseTest {
    CurveHandler internal handler;
    LaunchToken internal t;

    function setUp() public override {
        super.setUp();
        t = _launchAndSettle();
        handler = new CurveHandler(d.curve, t);
        targetContract(address(handler));
    }

    /// Curve'deki ETH her zaman kayıtlı gerçek rezerve eşittir (fee'ler anında kasaya gider).
    function invariant_EthBalanceMatchesReserve() public view {
        (,, uint256 realEth,, bool graduated) = _state(t);
        assertEq(address(d.curve).balance, graduated ? 0 : realEth);
    }

    /// Satılan token asla curve arzını aşmaz ve curve'deki token = arz - satılan.
    function invariant_TokenAccounting() public view {
        (,,, uint256 sold, bool graduated) = _state(t);
        assertLe(sold, C.CURVE_SUPPLY);
        if (!graduated) assertEq(t.balanceOf(address(d.curve)), C.TOTAL_SUPPLY - sold);
    }

    /// Fiyat hiçbir zaman başlangıç fiyatının altına düşmez.
    function invariant_PriceNeverBelowStart() public view {
        (uint256 x, uint256 y,,, bool graduated) = _state(t);
        if (graduated) return;
        assertGe(x * C.VIRTUAL_TOKEN, C.VIRTUAL_ETH * y);
    }
}
