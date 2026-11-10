// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PricePusher} from "./Graduation.t.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {IUniswapV3Pool, IWETH9} from "../src/interfaces/IUniswapV3.sol";

interface INPM {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    function mint(MintParams calldata) external payable returns (uint256, uint128, uint256, uint256);
    function decreaseLiquidity(DecreaseLiquidityParams calldata) external payable returns (uint256, uint256);
    function collect(CollectParams calldata) external payable returns (uint256, uint256);
}

/// Uç durum: saldırgan graduation'dan önce boş pool'da fiyatı yukarı itip, hedef ile
/// itilmiş fiyat arasına büyük WETH likiditesi koyar (token tarafını koyamaz: pool'a transfer yasak).
/// Beklenen: graduation asla kilitlenmez (ilk sürümde tüm token satılıp mint revert ediyordu = DoS),
/// fiyat hedefin altına inmez ve saldırgan ZARAR eder.
contract ManipulationTest is BaseTest {
    address internal attacker = makeAddr("attacker");
    INPM internal npm = INPM(RH.UNI_V3_POSITION_MANAGER);

    function _floor(int24 t) internal pure returns (int24) {
        int24 s = C.UNI_TICK_SPACING;
        int24 r = t / s;
        if (t < 0 && t % s != 0) r -= 1;
        return r * s;
    }

    function testFuzz_WethLiquidityAttackFails(uint256 depositSeed, uint256 pushSeed) public {
        uint256 deposit = bound(depositSeed, 0.5 ether, 100 ether);
        uint160 mult = uint160(bound(pushSeed, 2, 5)); // sqrt fiyat 2-5x → fiyat 4-25x

        LaunchToken t = _launchAndSettle();
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        bool tokenIs0 = address(t) < RH.WETH;
        uint160 target = _target(t);
        (, int24 targetTick,,,,,) = pool.slot0();

        // 1) Token'ı "pahalı" yöne it: token0 ise fiyat (WETH/token) yukarı, token1 ise (token/WETH) aşağı
        PricePusher pusher = new PricePusher();
        if (tokenIs0) pusher.push(pool, false, target * mult);
        else pusher.push(pool, true, target / mult);
        (, int24 pushedTick,,,,,) = pool.slot0();

        // 2) Hedef ile itilmiş fiyat arasına sadece WETH ile likidite (alış emirleri)
        int24 lower;
        int24 upper;
        if (tokenIs0) {
            lower = _floor(targetTick) + C.UNI_TICK_SPACING;
            upper = _floor(pushedTick);
        } else {
            lower = _floor(pushedTick) + C.UNI_TICK_SPACING;
            upper = _floor(targetTick);
        }
        vm.deal(attacker, deposit);
        vm.startPrank(attacker);
        IWETH9(RH.WETH).deposit{value: deposit}();
        IWETH9(RH.WETH).approve(address(npm), deposit);
        (uint256 positionId, uint128 liquidity,,) = npm.mint(
            INPM.MintParams({
                token0: tokenIs0 ? address(t) : RH.WETH,
                token1: tokenIs0 ? RH.WETH : address(t),
                fee: C.UNI_FEE_TIER,
                tickLower: lower,
                tickUpper: upper,
                amount0Desired: tokenIs0 ? 0 : deposit,
                amount1Desired: tokenIs0 ? deposit : 0,
                amount0Min: 0,
                amount1Min: 0,
                recipient: attacker,
                deadline: block.timestamp
            })
        );
        vm.stopPrank();
        uint256 deposited = deposit - IWETH9(RH.WETH).balanceOf(attacker);

        // 3) Graduation
        _buy(alice, t, 6 ether);
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        assertGt(pool.liquidity(), 0); // graduation kilitlenmedi (DoS yok)
        // Fiyat hedefte ya da (çok derin saldırgan likiditesinde) token lehine daha yüksekte kalır, asla altında değil
        if (tokenIs0) assertGe(_sqrtPrice(t), target);
        else assertLe(_sqrtPrice(t), target);

        // 4) Saldırgan pozisyonunu kapatır: graduation fiyatıyla değeri yatırdığından az olmalı
        vm.startPrank(attacker);
        npm.decreaseLiquidity(INPM.DecreaseLiquidityParams(positionId, liquidity, 0, 0, block.timestamp));
        (uint256 a0, uint256 a1) =
            npm.collect(INPM.CollectParams(positionId, attacker, type(uint128).max, type(uint128).max));
        vm.stopPrank();
        (uint256 tokenOut, uint256 wethOut) = tokenIs0 ? (a0, a1) : (a1, a0);
        uint256 value = wethOut + (tokenOut * C.GRADUATION_ETH) / C.LP_SUPPLY;
        assertLt(value, deposited, "saldirgan kar etti");
    }
}
