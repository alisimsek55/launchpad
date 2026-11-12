// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {console} from "forge-std/console.sol";
import {Vm} from "forge-std/Vm.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BaseTest} from "./Base.t.sol";
import {PricePusher} from "./Graduation.t.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {Graduator} from "../src/Graduator.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {INonfungiblePositionManager, IUniswapV3Pool, IWETH9} from "../src/interfaces/IUniswapV3.sol";
import {TickMath} from "../src/libraries/TickMath.sol";

interface IPoolLp {
    function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data)
        external
        returns (uint256 amount0, uint256 amount1);
    function burn(int24 tickLower, int24 tickUpper, uint128 amount) external returns (uint256, uint256);
    function collect(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external returns (uint128, uint128);
}

/// Saldırgan: graduation öncesi pool'a sadece WETH ile binlerce dar pozisyon koyar (NPM'siz, doğrudan pool.mint).
contract TickStuffer {
    IUniswapV3Pool internal immutable pool;
    IWETH9 internal immutable weth = IWETH9(RH.WETH);
    int24[] internal lowers;
    uint128[] internal liqs;

    constructor(IUniswapV3Pool pool_) payable {
        pool = pool_;
        weth.deposit{value: msg.value}();
    }

    /// wethPer > 0 ise her pozisyona yaklaşık o kadar WETH koyar, değilse sabit `liquidity`
    function stuff(int24 first, uint256 n, int24 step, uint256 wethPer, uint128 liquidity) external {
        bool wethIs0 = pool.token0() == RH.WETH;
        for (uint256 i = 0; i < n; i++) {
            int24 lower = first + int24(int256(i)) * step;
            if (step < 0) lower -= C.UNI_TICK_SPACING; // aşağı doğru: [lower, lower+200]
            int24 upper = lower + C.UNI_TICK_SPACING;
            uint128 l = liquidity;
            if (wethPer > 0) {
                uint256 sa = TickMath.getSqrtRatioAtTick(lower);
                uint256 sb = TickMath.getSqrtRatioAtTick(upper);
                l = uint128(
                    wethIs0
                        ? Math.mulDiv(Math.mulDiv(wethPer, sa, 1 << 96), sb, sb - sa)
                        : Math.mulDiv(wethPer, 1 << 96, sb - sa)
                );
            }
            IPoolLp(address(pool)).mint(address(this), lower, upper, l, "");
            lowers.push(lower);
            liqs.push(l);
        }
    }

    /// Tüm pozisyonları kapatır, her şeyi çağırana gönderir
    function exit() external returns (uint256 got0, uint256 got1) {
        for (uint256 i = 0; i < lowers.length; i++) {
            int24 l = lowers[i];
            IPoolLp(address(pool)).burn(l, l + C.UNI_TICK_SPACING, liqs[i]);
            (uint128 a0, uint128 a1) = IPoolLp(address(pool))
                .collect(msg.sender, l, l + C.UNI_TICK_SPACING, type(uint128).max, type(uint128).max);
            got0 += a0;
            got1 += a1;
        }
        weth.transfer(msg.sender, weth.balanceOf(address(this)));
    }

    function uniswapV3MintCallback(uint256 amount0, uint256 amount1, bytes calldata) external {
        // Pozisyonlar fiyatın WETH tarafında: token tarafı her zaman 0 olmalı (pool'a token aktarılamaz)
        if (amount0 > 0) weth.transfer(msg.sender, amount0);
        if (amount1 > 0) weth.transfer(msg.sender, amount1);
    }
}

/// Eski Graduator mantığı: hedefe TEK swap (sınırsız tick geçişi). Sadece gas ölçümü için.
contract OldCorrection {
    function run(IUniswapV3Pool pool, bool zeroForOne, uint256 amountIn, uint160 limit) external {
        pool.swap(address(this), zeroForOne, int256(amountIn), limit, "");
    }

    function uniswapV3SwapCallback(int256 d0, int256 d1, bytes calldata) external {
        if (d0 > 0) IWETH9(IUniswapV3Pool(msg.sender).token0()).transfer(msg.sender, uint256(d0));
        if (d1 > 0) IWETH9(IUniswapV3Pool(msg.sender).token1()).transfer(msg.sender, uint256(d1));
    }
}

/// [High] Graduation gas-DoS: saldırgan boş pool'da fiyatı itip hedef ile itilmiş fiyat arasına
/// binlerce initialize tick koyar. Eski tek-swap düzeltmesi blok gas limitini aşıyordu; yeni Graduator
/// her çağrıda en fazla MAX_TICK_CROSSINGS tick geçer ve gerekirse `continueGraduation` ile devam eder.
contract GraduationDosTest is BaseTest {
    /// Arbitrum (Robinhood Chain, Orbit) tx/blok gas limiti
    uint256 internal constant BLOCK_GAS_LIMIT = 32_000_000;
    uint256 internal constant STEP_GAS_CAP = 15_000_000; // her adım bunun çok altında kalmalı

    function _floor(int24 t) internal pure returns (int24) {
        int24 s = C.UNI_TICK_SPACING;
        int24 r = t / s;
        if (t < 0 && t % s != 0) r -= 1;
        return r * s;
    }

    /// İki yönelimi de test etmek için: token adresi WETH'ten küçük (token0) ya da büyük (token1) olana
    /// kadar launch eder (adres CREATE nonce'una bağlı), sonra sniper penceresinin dışına çıkar.
    function _launchOriented(bool token0) internal returns (LaunchToken t) {
        uint256 t0 = block.timestamp;
        for (uint256 i = 0; i < 300; i++) {
            t = _launch();
            if ((address(t) < RH.WETH) == token0) {
                vm.warp(t0 + C.SNIPER_WINDOW);
                return t;
            }
        }
        revert("yonelim bulunamadi");
    }

    /// Fiyatı token "pahalı" yönüne `n` pozisyon ötesine iter ve araya `n` bitişik dar WETH pozisyonu koyar
    /// (n+1 initialize tick). Pozisyonlar hedefin hemen ötesinden başlar.
    function _attack(LaunchToken t, uint256 n, uint256 wethBudget, uint256 wethPer) internal returns (TickStuffer st) {
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        bool tokenIs0 = address(t) < RH.WETH;
        (, int24 targetTick,,,,,) = pool.slot0();
        int24 s = C.UNI_TICK_SPACING;
        int24 span = int24(int256(n + 1)) * s;
        PricePusher pusher = new PricePusher();
        st = new TickStuffer{value: wethBudget}(pool);
        if (tokenIs0) {
            // token0: fiyat (WETH/token) yukarı; pozisyonlar hedefin üstünde, mevcut fiyatın altında (token1 = WETH)
            int24 first = _floor(targetTick) + s;
            pusher.push(pool, false, TickMath.getSqrtRatioAtTick(first + span));
            st.stuff(first, n, s, wethPer, 1e9);
        } else {
            // token1: fiyat (token/WETH) aşağı; pozisyonlar hedefin altında, mevcut fiyatın üstünde (token0 = WETH)
            int24 first = _floor(targetTick);
            pusher.push(pool, true, TickMath.getSqrtRatioAtTick(first - span));
            st.stuff(first, n, -s, wethPer, 1e9);
        }
    }

    /// Bekleyen graduation'ı bitene kadar ilerletir; her adımın gas'ını sınırlar. Adım sayısını döner.
    function _drain(LaunchToken t) internal returns (uint256 steps, uint256 maxGas) {
        while (true) {
            (address c,,,) = d.graduator.pending(address(t));
            if (c == address(0)) break;
            uint256 g0 = gasleft();
            vm.prank(bob); // herkes çağırabilir
            d.graduator.continueGraduation{gas: BLOCK_GAS_LIMIT}(address(t));
            uint256 used = g0 - gasleft();
            if (used > maxGas) maxGas = used;
            steps++;
            assertLt(steps, 100, "sonsuz dongu");
        }
    }

    function _assertGraduatedClean(LaunchToken t) internal view {
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        (address c,,,) = d.graduator.pending(address(t));
        assertEq(c, address(0), "hala bekliyor");
        assertEq(_sqrtPrice(t), _target(t), "fiyat hedefte degil");
        (uint256 positionId,) = d.locker.positions(address(t));
        assertEq(INonfungiblePositionManager(RH.UNI_V3_POSITION_MANAGER).ownerOf(positionId), address(d.locker));
        assertGt(IUniswapV3Pool(t.pool()).liquidity(), 0);
        // Graduator'da hiçbir şey kalmaz (bekleyen başka graduation yoksa)
        assertEq(t.balanceOf(address(d.graduator)), 0);
        assertEq(IWETH9(RH.WETH).balanceOf(address(d.graduator)), 0);
        assertEq(address(d.graduator).balance, 0);
    }

    function test_TickStuffing_OldLogicExceedsBlockGas_NewLogicGraduates_Token0() public {
        _TickStuffing_OldLogicExceedsBlockGas_NewLogicGraduates(true);
    }

    function test_TickStuffing_OldLogicExceedsBlockGas_NewLogicGraduates_Token1() public {
        _TickStuffing_OldLogicExceedsBlockGas_NewLogicGraduates(false);
    }

    /// Ana senaryo: 1.500 dar pozisyon (1.501 tick). Eski mantık tek swap'ta blok limitini aşar;
    /// yeni mantık son alımı sınırlı gas'la tamamlar, kalan adımlar herkesçe ilerletilir.
    function _TickStuffing_OldLogicExceedsBlockGas_NewLogicGraduates(bool token0) internal {
        uint256 n = 1_500;
        LaunchToken t = _launchOriented(token0);
        _attack(t, n, 1 ether, 0);
        _buy(alice, t, 4 ether); // eşiğin hemen altına kadar
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        uint160 target = _target(t);

        // --- ESKİ mantık: Graduator'ın vereceği girdiyle hedefe tek swap (token transferi açılarak simüle)
        uint256 snap = vm.snapshotState();
        {
            vm.prank(address(d.curve));
            t.markGraduated();
            OldCorrection old = new OldCorrection();
            deal(address(t), address(old), C.LP_SUPPLY / 2);
            bool zeroForOne = _sqrtPrice(t) > target;
            uint256 g0 = gasleft();
            old.run(pool, zeroForOne, C.LP_SUPPLY / 2, target);
            uint256 oldGas = g0 - gasleft();
            console.log("eski tek swap gas (1501 tick):", oldGas);
            console.log("tick basina gas:", oldGas / (n + 1));
            assertGt(oldGas, BLOCK_GAS_LIMIT, "eski mantik blok limitini asmali");
        }
        vm.revertToState(snap);

        // --- YENİ mantık: son alım blok limitiyle çalışır
        uint256 before = gasleft();
        vm.expectEmit(true, true, false, false, address(d.graduator));
        emit Graduator.GraduationPending(address(t), address(pool), 0);
        vm.prank(alice);
        d.curve.buy{value: 1 ether, gas: BLOCK_GAS_LIMIT}(address(t), 0, block.timestamp, alice);
        uint256 buyGas = before - gasleft();
        console.log("yeni son alim gas:", buyGas);
        assertLt(buyGas, STEP_GAS_CAP);

        // Bekleme durumu: curve kapandı, varlıklar Graduator'da token'a ayrılmış
        (,,,, bool graduated) = _state(t);
        assertTrue(graduated);
        (address c, uint128 wethHeld,,) = d.graduator.pending(address(t));
        assertEq(c, creator);
        assertEq(IWETH9(RH.WETH).balanceOf(address(d.graduator)), wethHeld);

        (uint256 steps, uint256 maxGas) = _drain(t);
        console.log("continueGraduation adim:", steps);
        console.log("en pahali adim gas:", maxGas);
        assertLt(maxGas, STEP_GAS_CAP);
        // 1501 tick / 200 => son alım + en fazla 8 devam adımı
        assertLe(steps, (n + 1) / d.graduator.MAX_TICK_CROSSINGS() + 1);
        _assertGraduatedClean(t);
    }

    function test_FewTicks_GraduatesAtomically_Token0() public {
        _FewTicks_GraduatesAtomically(true);
    }

    function test_FewTicks_GraduatesAtomically_Token1() public {
        _FewTicks_GraduatesAtomically(false);
    }

    /// Az tick (<= MAX_TICK_CROSSINGS): eskisi gibi tek tx'te, beklemeden graduate olur.
    function _FewTicks_GraduatesAtomically(bool token0) internal {
        LaunchToken t = _launchOriented(token0);
        _attack(t, 150, 1 ether, 0); // 151 tick < MAX_TICK_CROSSINGS
        uint256 g0 = gasleft();
        _buy(alice, t, 6 ether);
        console.log("151 tick ile son alim gas:", g0 - gasleft());
        _assertGraduatedClean(t);
    }

    /// Normal graduation (pool hedefte) davranışı değişmedi: tarama/swap yok, tek tx.
    function test_AtTarget_Unchanged() public {
        LaunchToken t = _launchAndSettle();
        assertEq(_sqrtPrice(t), _target(t));
        uint256 g0 = gasleft();
        _buy(alice, t, 6 ether);
        console.log("normal son alim gas:", g0 - gasleft());
        _assertGraduatedClean(t);
    }

    function test_PushedNoTicks_GraduatesAtomically_Token0() public {
        _PushedNoTicks_GraduatesAtomically(true);
    }

    function test_PushedNoTicks_GraduatesAtomically_Token1() public {
        _PushedNoTicks_GraduatesAtomically(false);
    }

    /// Tick'siz fiyat itme: tek tx'te düzeltilir (bitmap taraması hiç tick bulmaz).
    function _PushedNoTicks_GraduatesAtomically(bool token0) internal {
        LaunchToken t = _launchOriented(token0);
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        bool tokenIs0 = address(t) < RH.WETH;
        // En uç fiyata it: tüm bitmap kelimeleri taranır
        new PricePusher()
            .push(
                pool, !tokenIs0, tokenIs0 ? TickMath.getSqrtRatioAtTick(880_000) : TickMath.getSqrtRatioAtTick(-880_000)
            );
        _buy(alice, t, 6 ether);
        _assertGraduatedClean(t);
    }

    function test_StuffingAttackerCannotExtractValue_Token0() public {
        _StuffingAttackerCannotExtractValue(true);
    }

    function test_StuffingAttackerCannotExtractValue_Token1() public {
        _StuffingAttackerCannotExtractValue(false);
    }

    /// Değer çıkarılamaz: saldırganın WETH'i, Graduator'ın hedeften pahalıya sattığı token'a döner.
    /// Pozisyonlar kapatıldığında hedef fiyattan değeri yatırdığından az olmalı; graduation da normal
    /// değerin en az %99'unu (pool fee'si) elde eder.
    function _StuffingAttackerCannotExtractValue(bool token0) internal {
        uint256 n = 700; // > 2 adım
        LaunchToken t = _launchOriented(token0);
        bool tokenIs0 = address(t) < RH.WETH;
        TickStuffer st = _attack(t, n, 50 ether, 0.005 ether); // ~3.5 ETH gerçek alış emri
        uint256 deposited = 50 ether - IWETH9(RH.WETH).balanceOf(address(st));
        console.log("saldirgan yatirdi (wei):", deposited);
        assertGt(deposited, 0.1 ether);

        vm.recordLogs();
        _buy(alice, t, 6 ether);
        uint256 protocolBefore = d.feeVault.protocolBalance(); // son alımın işlem fee'si hariç tutulur
        _drain(t);
        _assertGraduatedClean(t);

        // Graduation'ın elde ettiği toplam değer (hedef fiyattan): LP + protokole giden WETH artığı + yakılan
        // token. Normal graduation = 4.2 ETH + 200M token = 2 * 4.2 ETH. Pool fee'si (%1) dışında kayıp yok.
        (uint256 ethUsed, uint256 tokenUsed) = _graduatedAmounts();
        uint256 leftoverWeth = d.feeVault.protocolBalance() - protocolBefore;
        uint256 burned = t.balanceOf(C.DEAD);
        uint256 total = ethUsed + leftoverWeth + Math.mulDiv(tokenUsed + burned, C.GRADUATION_ETH, C.LP_SUPPLY);
        console.log("graduation toplam degeri (wei):", total);
        assertGe(total, (2 * C.GRADUATION_ETH * 99) / 100);

        // Saldırgan çıkar: değeri yatırdığından az
        vm.prank(attackerEoa);
        (uint256 got0, uint256 got1) = st.exit();
        (uint256 tokenOut, uint256 wethOut) = tokenIs0 ? (got0, got1) : (got1, got0);
        uint256 value = wethOut + Math.mulDiv(tokenOut, C.GRADUATION_ETH, C.LP_SUPPLY);
        console.log("saldirgan cikis degeri (wei):", value);
        assertLt(value, deposited, "saldirgan kar etti");
    }

    address internal attackerEoa = makeAddr("attackerEoa");

    function _graduatedAmounts() internal returns (uint256 ethUsed, uint256 tokenUsed) {
        bytes32 sig = Graduator.Graduated.selector;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(d.graduator) && logs[i].topics[0] == sig) {
                (, ethUsed, tokenUsed,) = abi.decode(logs[i].data, (uint256, uint256, uint256, uint160));
            }
        }
        assertGt(ethUsed, 0, "Graduated yok");
    }

    /// İki token aynı anda beklemedeyken WETH'leri karışmaz: biri bitince diğerinin WETH'i yerinde kalır.
    function test_TwoPendingGraduations_FundsIsolated() public {
        LaunchToken a = _launchAndSettle();
        vm.prank(creator);
        LaunchToken b = LaunchToken(d.factory.createToken{value: C.LAUNCH_FEE}("Second", "TWO", "ipfs://b", 0));
        vm.warp(block.timestamp + C.SNIPER_WINDOW);
        _attack(a, 700, 1 ether, 0);
        _attack(b, 700, 1 ether, 0);
        _buy(alice, a, 6 ether);
        _buy(bob, b, 6 ether);
        (, uint128 wa,,) = d.graduator.pending(address(a));
        (, uint128 wb,,) = d.graduator.pending(address(b));
        assertGt(wa, 0);
        assertGt(wb, 0);
        assertEq(IWETH9(RH.WETH).balanceOf(address(d.graduator)), uint256(wa) + wb);

        _drain(a);
        (, uint128 wb2,,) = d.graduator.pending(address(b));
        assertEq(wb2, wb);
        assertEq(IWETH9(RH.WETH).balanceOf(address(d.graduator)), wb);
        _drain(b);
        _assertGraduatedClean(a);
        _assertGraduatedClean(b);
    }

    function test_PendingThenPriceFlipped_StillCompletes_Token0() public {
        _PendingThenPriceFlipped_StillCompletes(true);
    }

    function test_PendingThenPriceFlipped_StillCompletes_Token1() public {
        _PendingThenPriceFlipped_StillCompletes(false);
    }

    /// Bekleme sırasında token pool'a aktarılabilir (curve graduated işaretledi). Biri fiyatı hedefin
    /// öbür tarafına itse de devam adımı yön değiştirip hedefe getirir.
    function _PendingThenPriceFlipped_StillCompletes(bool token0) internal {
        LaunchToken t = _launchOriented(token0);
        _attack(t, 700, 1 ether, 0);
        _buy(alice, t, 6 ether);
        (address c,,,) = d.graduator.pending(address(t));
        assertTrue(c != address(0));

        // Fiyatı token "ucuz" yönüne, hedefin çok ötesine it (aradaki saldırgan tick'lerini tek tx'te geçmeden:
        // önce bekleyen adımları bitirmek yerine boş bölgeye atlamak mümkün değil, bu yüzden bob token satar)
        IUniswapV3Pool pool = IUniswapV3Pool(t.pool());
        bool tokenIs0 = address(t) < RH.WETH;
        OldCorrection seller = new OldCorrection();
        vm.prank(alice);
        t.transfer(address(seller), 100_000_000e18);
        uint160 far = tokenIs0 ? TickMath.getSqrtRatioAtTick(-600_000) : TickMath.getSqrtRatioAtTick(600_000);
        seller.run(pool, tokenIs0, 100_000_000e18, far);
        if (tokenIs0) assertLt(_sqrtPrice(t), _target(t));
        else assertGt(_sqrtPrice(t), _target(t));

        _drain(t);
        _assertGraduatedClean(t);
    }

    function test_ContinueGraduation_RevertsIfNotPending() public {
        LaunchToken t = _launchAndSettle();
        vm.expectRevert(Graduator.NotPending.selector);
        d.graduator.continueGraduation(address(t));
        _buy(alice, t, 6 ether);
        vm.expectRevert(Graduator.NotPending.selector);
        d.graduator.continueGraduation(address(t));
    }

    function test_SwapCallback_OnlyActivePool() public {
        LaunchToken t = _launchAndSettle();
        vm.prank(t.pool());
        vm.expectRevert(Graduator.UnauthorizedCallback.selector);
        d.graduator.uniswapV3SwapCallback(1, 1, "");
    }

    /// TickMath portu v3-core ile aynı: uç değerler ve gerçek pool'un slot0 tutarlılığı
    function test_TickMath_MatchesUniswap() public {
        assertEq(TickMath.getSqrtRatioAtTick(-887_272), 4295128739);
        assertEq(TickMath.getSqrtRatioAtTick(887_272), 1461446703485210103287273052203988822378723970342);
        assertEq(TickMath.getSqrtRatioAtTick(0), 1 << 96);
        LaunchToken t = _launchAndSettle();
        (uint160 p, int24 tick,,,,,) = IUniswapV3Pool(t.pool()).slot0();
        assertLe(TickMath.getSqrtRatioAtTick(tick), p);
        assertGt(TickMath.getSqrtRatioAtTick(tick + 1), p);
    }
}
