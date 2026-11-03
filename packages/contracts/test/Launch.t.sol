// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {IUniswapV3Factory} from "../src/interfaces/IUniswapV3.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract LaunchTest is BaseTest {
    function test_CreateToken() public {
        LaunchToken t = _launch();

        assertEq(t.totalSupply(), C.TOTAL_SUPPLY);
        assertEq(t.balanceOf(address(d.curve)), C.TOTAL_SUPPLY);
        assertEq(t.name(), "Test Token");
        assertEq(t.symbol(), "TEST");

        // Pool, hedef graduation fiyatıyla önceden oluşturuldu
        address pool = IUniswapV3Factory(RH.UNI_V3_FACTORY).getPool(address(t), RH.WETH, C.UNI_FEE_TIER);
        assertEq(t.pool(), pool);
        assertEq(_sqrtPrice(t), _target(t));

        (uint256 x, uint256 y, uint256 r, uint256 s, bool g) = _state(t);
        assertEq(x, C.VIRTUAL_ETH);
        assertEq(y, C.VIRTUAL_TOKEN);
        assertEq(r, 0);
        assertEq(s, 0);
        assertFalse(g);

        assertEq(d.feeVault.protocolBalance(), C.LAUNCH_FEE);
    }

    function test_RevertWhen_LaunchFeeMissing() public {
        vm.prank(creator);
        vm.expectRevert(TokenFactory.InsufficientLaunchFee.selector);
        d.factory.createToken{value: C.LAUNCH_FEE - 1}("Test", "TEST", "", 0);
    }

    function test_RevertWhen_InvalidSymbol() public {
        vm.prank(creator);
        vm.expectRevert(TokenFactory.InvalidSymbol.selector);
        d.factory.createToken{value: C.LAUNCH_FEE}("Test", "WAYTOOLONGSYM", "", 0);
    }

    function test_PauseBlocksOnlyNewLaunches() public {
        LaunchToken t = _launchAndSettle();

        vm.prank(owner);
        d.factory.pause();

        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        d.factory.createToken{value: C.LAUNCH_FEE}("Test", "TEST", "", 0);

        // Mevcut token'da alım-satım devam eder
        uint256 got = _buy(alice, t, 0.1 ether);
        assertGt(_sell(alice, t, got), 0);
    }

    function test_DevBuy_NoSniperFee() public {
        vm.prank(creator);
        LaunchToken t = LaunchToken(d.factory.createToken{value: C.LAUNCH_FEE + 0.05 ether}("Test", "TEST", "", 0));
        // Sniper fee'si uygulansaydı (%20) çok daha az token gelirdi; %1 ile TS referansıyla aynı (~36.4M).
        assertEq(t.balanceOf(creator), 36_426_353_915_143_152_811_314_246);
    }

    function test_RevertWhen_DevBuyTooLarge() public {
        // 0.1 ETH ~70.4M token alır; sınır %5 = 50M
        vm.prank(creator);
        vm.expectRevert(BondingCurve.DevBuyTooLarge.selector);
        d.factory.createToken{value: C.LAUNCH_FEE + 0.1 ether}("Test", "TEST", "", 0);
    }
}
