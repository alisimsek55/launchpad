// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Constants as C} from "../src/Constants.sol";
import {DCAVault} from "../src/DCAVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

contract DCATest is BaseTest {
    address internal keeper = makeAddr("keeper");

    function setUp() public override {
        super.setUp();
        vm.prank(owner);
        d.dca.setKeeper(keeper, true);
    }

    function _plan(LaunchToken t, uint256 perBuy, uint32 interval, uint32 count, uint256 maxPrice)
        internal
        returns (uint256 id)
    {
        vm.prank(alice);
        id = d.dca.createPlan{value: perBuy * count}(address(t), perBuy, interval, count, maxPrice);
    }

    function _balance(uint256 id) internal view returns (uint256 b) {
        (,,, b,,,,) = d.dca.plans(id);
    }

    function test_ExecutesOnSchedule() public {
        LaunchToken t = _launchAndSettle();
        uint256 t0 = block.timestamp;
        uint256 id = _plan(t, 0.1 ether, 1 hours, 3, 0);
        assertEq(address(d.dca).balance, 0.3 ether);
        assertTrue(d.dca.isDue(id));

        vm.prank(keeper);
        uint256 got = d.dca.execute(id, 0);
        assertGt(got, 0);
        assertEq(t.balanceOf(alice), got); // token'lar doğrudan plan sahibine
        assertEq(_balance(id), 0.2 ether);

        // Aralık dolmadan tekrar çalışmaz
        assertFalse(d.dca.isDue(id));
        vm.prank(keeper);
        vm.expectRevert(DCAVault.TooEarly.selector);
        d.dca.execute(id, 0);

        vm.warp(t0 + 1 hours);
        vm.prank(keeper);
        d.dca.execute(id, 0);
        vm.warp(t0 + 2 hours);
        vm.prank(keeper);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 0);

        vm.warp(t0 + 3 hours);
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PlanFinished.selector);
        d.dca.execute(id, 0);
    }

    function test_RevertWhen_NotKeeper() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = _plan(t, 0.1 ether, 1 hours, 2, 0);
        vm.prank(bob);
        vm.expectRevert(DCAVault.NotKeeper.selector);
        d.dca.execute(id, 0);
    }

    function test_CancelRefundsRemaining() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = _plan(t, 0.1 ether, 1 hours, 3, 0);
        vm.prank(keeper);
        d.dca.execute(id, 0);

        uint256 before = alice.balance;
        vm.prank(alice);
        d.dca.cancelPlan(id);
        assertEq(alice.balance - before, 0.2 ether);
        assertFalse(d.dca.isDue(id));

        vm.prank(bob);
        vm.expectRevert(DCAVault.NotOwner.selector);
        d.dca.cancelPlan(id);
    }

    /// maxPrice, keeper'ın verdiği minOut'tan bağımsız olarak zincirde uygulanır.
    function test_MaxPriceProtectsUser() public {
        LaunchToken t = _launchAndSettle();
        // Başlangıç fiyatı ~1.31e-9 ETH; sınırı bunun altına koy → alım geri dönmeli
        uint256 id = _plan(t, 0.1 ether, 1 hours, 1, 1e9); // 1e-9 ETH/token
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceTooHigh.selector);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 0.1 ether);
    }

    function test_RevertWhen_InvalidPlan() public {
        LaunchToken t = _launchAndSettle();
        vm.startPrank(alice);
        vm.expectRevert(DCAVault.InvalidPlan.selector);
        d.dca.createPlan{value: 0.1 ether}(address(t), 0.1 ether, 1 minutes, 1, 0); // aralık çok kısa
        vm.expectRevert(DCAVault.InvalidPlan.selector);
        d.dca.createPlan{value: 0.1 ether}(address(t), 0.1 ether, 1 hours, 2, 0); // yanlış tutar
        vm.expectRevert(DCAVault.InvalidPlan.selector);
        d.dca.createPlan{value: 0.1 ether}(address(0xBEEF), 0.1 ether, 1 hours, 1, 0); // launchpad token'ı değil
        vm.stopPrank();
    }

    /// Graduation sonrası alımlar Uniswap'ten yapılır.
    function test_BuysOnUniswapAfterGraduation() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 6 ether); // graduate
        uint256 id = _plan(t, 0.2 ether, 1 hours, 1, 0);
        // TWAP için pool'da 5 dk'lık geçmiş gerekir (bkz. DCATwap.t.sol)
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(keeper);
        uint256 got = d.dca.execute(id, 1);
        assertGt(got, 0);
        assertEq(t.balanceOf(alice), got);
        assertEq(_balance(id), 0);
    }

    /// Graduation'ı tetikleyen DCA alımında curve'ün iade ettiği ETH plana geri yazılır.
    function test_GraduationRefundGoesBackToPlan() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 4 ether); // eşiğe yaklaş
        uint256 id = _plan(t, 2 ether, 1 hours, 1, 0);
        vm.prank(keeper);
        d.dca.execute(id, 0);
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        uint256 left = _balance(id);
        assertGt(left, 1 ether); // ~4.2 eşiği için az ETH gerekti, fazlası planda
        assertEq(address(d.dca).balance, left);

        // Kalan küsurat bir sonraki çalıştırmada Uniswap'ten harcanır
        vm.warp(block.timestamp + 1 hours);
        vm.prank(keeper);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 0);
    }

    /// maxPrice kontrolü gereken token miktarını yukarı yuvarlar: 1 wei'lik Uniswap alımı 0 token döndürür
    /// (fee sonrası girdi 0). maxPrice = 2 ETH/token ile gereken 1e18 / 2e18 = 0.5 token; aşağı
    /// yuvarlansaydı (0) alım geçerdi, yukarı yuvarlanınca (1) PriceTooHigh ile döner.
    function test_MaxPriceRoundsRequiredTokensUp() public {
        LaunchToken t = _launchAndSettle();
        _buy(bob, t, 6 ether); // graduate
        vm.warp(block.timestamp + 5 minutes); // TWAP geçmişi

        // Sınırsız planda aynı alım gerçekten 0 token döndürüyor (kenar durumu)
        uint256 free = _plan(t, 1, 1 hours, 1, 0);
        vm.prank(keeper);
        assertEq(d.dca.execute(free, 0), 0);

        uint256 id = _plan(t, 1, 1 hours, 1, 2e18);
        vm.prank(keeper);
        vm.expectRevert(DCAVault.PriceTooHigh.selector);
        d.dca.execute(id, 0);
        assertEq(_balance(id), 1);
    }
}
