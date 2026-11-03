// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {INonfungiblePositionManager, IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// Likiditesiz pool'da fiyatı bedavaya oynatan saldırgan.
contract PricePusher {
    function push(IUniswapV3Pool pool, bool zeroForOne, uint160 limit) external {
        pool.swap(address(this), zeroForOne, 1, limit, "");
    }

    function uniswapV3SwapCallback(int256, int256, bytes calldata) external pure {}
}

contract GraduationTest is BaseTest {
    function test_Graduation() public {
        LaunchToken t = _launchAndSettle();
        uint256 before = alice.balance;
        _buy(alice, t, 6 ether); // eşikten fazla: fazlası iade edilir

        (,, uint256 realEth, uint256 sold, bool graduated) = _state(t);
        assertTrue(graduated);
        assertTrue(t.graduated());
        assertEq(sold, C.CURVE_SUPPLY);
        assertApproxEqAbs(realEth, C.GRADUATION_ETH, 1e6);
        assertEq(t.balanceOf(alice), C.CURVE_SUPPLY);

        // Ödenen = 4.2 ETH + %1 fee; gerisi iade
        uint256 paid = before - alice.balance;
        assertApproxEqRel(paid, C.GRADUATION_ETH * C.BPS / (C.BPS - C.TRADE_FEE_BPS), 1e12);

        // Curve boşaldı, likidite Uniswap'te, NFT kilitte
        assertEq(address(d.curve).balance, 0);
        assertEq(t.balanceOf(address(d.curve)), 0);
        (uint256 positionId,) = d.locker.positions(address(t));
        assertEq(INonfungiblePositionManager(RH.UNI_V3_POSITION_MANAGER).ownerOf(positionId), address(d.locker));
        assertGt(IUniswapV3Pool(t.pool()).liquidity(), 0);

        // Fiyat sürekliliği: pool fiyatı curve'ün son fiyatına eşit
        assertEq(_sqrtPrice(t), _target(t));

        // Artık curve'de işlem yok
        vm.prank(bob);
        vm.expectRevert(BondingCurve.AlreadyGraduated.selector);
        d.curve.buy{value: 0.1 ether}(address(t), 0, block.timestamp, bob);
    }

    function test_TradingOnUniswapAfterGraduation() public {
        LaunchToken t = _launchAndSettle();
        _buy(alice, t, 6 ether);

        // Uniswap'te ETH -> token
        ISwapRouter02 router = ISwapRouter02(RH.UNI_SWAP_ROUTER_02);
        vm.prank(bob);
        uint256 out = router.exactInputSingle{value: 1 ether}(
            ISwapRouter02.ExactInputSingleParams(RH.WETH, address(t), C.UNI_FEE_TIER, bob, 1 ether, 0, 0)
        );
        assertGt(out, 0);

        // Token -> WETH (artık pool'a transfer serbest)
        vm.startPrank(alice);
        t.approve(address(router), 100_000_000e18);
        uint256 wethOut = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams(address(t), RH.WETH, C.UNI_FEE_TIER, alice, 100_000_000e18, 0, 0)
        );
        vm.stopPrank();
        assertGt(wethOut, 0);

        // LP fee'leri toplanır: ETH tarafı FeeVault'a (%70/%30), token tarafı treasury + creator'a
        uint256 creatorBefore = d.feeVault.creatorBalance(creator);
        (uint256 ethFees, uint256 tokenFees) = d.locker.collect(address(t));
        assertGt(ethFees, 0);
        assertGt(tokenFees, 0);
        assertEq(d.feeVault.creatorBalance(creator) - creatorBefore, ethFees - ethFees * 70 / 100);
        assertEq(t.balanceOf(treasury), tokenFees * 70 / 100);
    }

    /// Saldırgan likiditesiz pool'da fiyatı oynatsa da graduation fiyatı hedefe geri çeker.
    function test_Graduation_CorrectsManipulatedPrice() public {
        LaunchToken t = _launchAndSettle();
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        uint160 target = _target(t);

        PricePusher attacker = new PricePusher();
        attacker.push(pool, false, target * 3); // fiyatı ~9 kat yukarı it
        assertEq(_sqrtPrice(t), target * 3);

        _buy(alice, t, 6 ether);
        assertEq(_sqrtPrice(t), target);
        assertGt(pool.liquidity(), 0);
    }

    function test_Graduation_CorrectsPriceDown() public {
        LaunchToken t = _launchAndSettle();
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        uint160 target = _target(t);

        new PricePusher().push(pool, true, target / 3);
        _buy(alice, t, 6 ether);
        assertEq(_sqrtPrice(t), target);
    }

    /// Graduation, curve'deki birden fazla alıcıyla da çalışır ve herkes token'ını tutar.
    function testFuzz_GraduationWithManyBuyers(uint256 a) public {
        a = bound(a, 0.01 ether, 4 ether);
        LaunchToken t = _launchAndSettle();
        uint256 ga = _buy(alice, t, a);
        uint256 gb = _buy(bob, t, 10 ether);
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        assertEq(ga + gb, C.CURVE_SUPPLY);
        assertEq(_sqrtPrice(t), _target(t));
    }
}
