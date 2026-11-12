// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {DCAVault, ISwapRouter02} from "../src/DCAVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {IUniswapV3Pool} from "../src/interfaces/IUniswapV3.sol";

/// Graduation sonrası DCA alımlarında TWAP koruması ve iade sonrası maxPrice kontrolü.
contract DCATwapTest is BaseTest {
    address internal keeper = makeAddr("keeper");

    function setUp() public override {
        super.setUp();
        vm.prank(owner);
        d.dca.setKeeper(keeper, true);
        vm.deal(keeper, 100 ether);
    }

    function _plan(LaunchToken t, uint256 perBuy, uint32 count, uint256 maxPrice) internal returns (uint256 id) {
        vm.prank(alice);
        id = d.dca.createPlan{value: perBuy * count}(address(t), perBuy, 1 hours, count, maxPrice);
    }

    function _balance(uint256 id) internal view returns (uint256 b) {
        (,,, b,,,,) = d.dca.plans(id);
    }

    /// Keeper'ın (ya da herhangi birinin) Uniswap'ten token alarak fiyatı yukarı itmesi.
    function _pushPrice(address who, LaunchToken t, uint256 eth) internal {
        vm.prank(who);
        ISwapRouter02(RH.UNI_SWAP_ROUTER_02).exactInputSingle{value: eth}(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: RH.WETH,
                tokenOut: address(t),
                fee: C.UNI_FEE_TIER,
                recipient: who,
                amountIn: eth,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _cardinalityNext(LaunchToken t) internal view returns (uint16 next) {
        (,,,, next,,) = IUniswapV3Pool(t.pool()).slot0();
    }

    function test_CreatePlanGrowsOracleCardinality() public {
        LaunchToken t = _launchAndSettle();
        assertEq(_cardinalityNext(t), 1);
        vm.prank(alice);
        uint256 g = gasleft();
        d.dca.createPlan{value: 0.1 ether}(address(t), 0.1 ether, 1 hours, 1, 0);
        emit log_named_uint("ilk createPlan gas (oracle buyutme dahil)", g - gasleft());
        assertEq(_cardinalityNext(t), d.dca.ORACLE_CARDINALITY());

        // İkinci plan tekrar büyütmez (no-op)
        _plan(t, 0.1 ether, 1, 0);
        assertEq(_cardinalityNext(t), d.dca.ORACLE_CARDINALITY());
    }

    /// Normal durum: fiyat TWAP'a yakın, plan Uniswap'ten çalışır.
    function test_PostGraduation_WithinTwap_Executes() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = _plan(t, 0.1 ether, 2, 0); // graduation öncesi: oracle büyütüldü
        _buy(bob, t, 6 ether); // graduate
        uint256 t0 = vm.getBlockTimestamp();

        vm.warp(t0 + 10 minutes);
        _pushPrice(bob, t, 0.01 ether); // küçük, dürüst işlem (< %5)
        vm.prank(keeper);
        uint256 got = d.dca.execute(id, 1);
        assertGt(got, 0);
        assertEq(t.balanceOf(alice), got);
        assertEq(_balance(id), 0.1 ether);
    }

    /// Saldırı: keeper aynı blokta fiyatı iter, sonra minTokensOut = 0 ve maxPrice = 0 ile çalıştırır.
    function test_PostGraduation_KeeperManipulation_Reverts() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = _plan(t, 0.5 ether, 1, 0);
        _buy(bob, t, 6 ether);
        uint256 t0 = vm.getBlockTimestamp();

        vm.warp(t0 + 10 minutes);
        _pushPrice(keeper, t, 1 ether); // ~%50 fiyat artışı
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceManipulated.selector);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 0.5 ether);
    }

    /// Fiyatı birkaç blok boyunca tutmak da yetmez: 5 dk ortalama, kısa süreli itmeyi seyreltir.
    function test_PostGraduation_SustainedShortManipulation_Reverts() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = _plan(t, 0.5 ether, 1, 0);
        _buy(bob, t, 6 ether);
        uint256 t0 = vm.getBlockTimestamp();

        vm.warp(t0 + 10 minutes);
        _pushPrice(keeper, t, 1 ether);
        vm.warp(t0 + 10 minutes + 30); // 30 sn tutuldu
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceManipulated.selector);
        d.dca.execute(id, 0);
    }

    /// Az gözlem: pool'da 5 dk geriye bakılamıyorsa (graduation'dan hemen sonra, kapasite 1) ve
    /// kullanıcı maxPrice koymadıysa alım yapılmaz.
    function test_LowCardinality_NoMaxPrice_Reverts() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 6 ether); // graduate: kapasite 1, son gözlem şimdi
        uint256 id = _plan(t, 0.1 ether, 1, 0);
        vm.prank(keeper);
        vm.expectRevert(DCAVault.TwapUnavailable.selector);
        d.dca.execute(id, 0);

        // 5 dk swap olmazsa tek gözlemle de TWAP hesaplanır
        vm.warp(vm.getBlockTimestamp() + 5 minutes);
        vm.prank(keeper);
        assertGt(d.dca.execute(id, 0), 0);
    }

    /// Az gözlem + maxPrice: kullanıcının fiyat sınırına güvenilir; sınır manipülasyonu da durdurur.
    function test_LowCardinality_MaxPriceFallback() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 6 ether);
        // Graduation fiyatı 2.1e-8 ETH; 0.1 ETH alımın (fee + etki) ortalaması bunun ~%4 üstü
        uint256 ok = _plan(t, 0.1 ether, 1, 2.3e10);
        uint256 tight = _plan(t, 0.1 ether, 1, 2.3e10);
        vm.prank(keeper);
        assertGt(d.dca.execute(ok, 0), 0);

        // Keeper fiyatı iterse maxPrice yakalar
        _pushPrice(keeper, t, 1 ether);
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceTooHigh.selector);
        d.dca.execute(tight, 0);
    }

    /// Bulgu 4: curve'de ~11.94M token kala 2 ETH'lik plan, maxPrice 3e-8 ETH/token.
    /// Gerçek harcama ≈ 0.2424 ETH (ortalama ≈ 2.03e-8) → alım geçmeli, iade plana dönmeli.
    function test_MaxPrice_TerminalBuyUsesActualSpend() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 4 ether);
        uint256 id = _plan(t, 2 ether, 1, 3e10);
        vm.prank(keeper);
        uint256 got = d.dca.execute(id, 0);
        assertEq(got, 11_940_298_507_462_686_567_164_179); // QuoteBuy.t.sol TS referansı
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        assertEq(_balance(id), 1_757_575_757_575_757_575); // iade plana yazıldı
        assertEq(address(d.dca).balance, _balance(id));
    }

    /// Aynı terminal alım, gerçek ortalama fiyat sınırın üstündeyse yine reddedilir.
    function test_MaxPrice_TerminalBuyAboveLimit_Reverts() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 4 ether);
        uint256 id = _plan(t, 2 ether, 1, 2e10); // ortalama ≈ 2.03e-8 > 2e-8
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceTooHigh.selector);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 2 ether);
    }
}
