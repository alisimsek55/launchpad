// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Constants as C} from "./Constants.sol";
import {FeeVault} from "./FeeVault.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {LPLocker} from "./LPLocker.sol";
import {INonfungiblePositionManager, IUniswapV3Pool, IWETH9} from "./interfaces/IUniswapV3.sol";
import {PriceMath} from "./libraries/PriceMath.sol";

/// @notice Curve'den gelen ETH ve token'larla Uniswap v3'te full-range likidite açar ve
/// LP NFT'sini LPLocker'a kilitler. Tümü curve'ün son alım tx'i içinde, atomik olarak.
contract Graduator {
    using SafeERC20 for IERC20;

    address public immutable curve;
    LPLocker public immutable locker;
    IWETH9 public immutable weth;
    INonfungiblePositionManager public immutable positionManager;
    FeeVault public immutable feeVault;

    /// Swap callback yetkisi; sadece tx süresince yaşar (EIP-1153 transient storage)
    address private transient activePool;

    event Graduated(
        address indexed token,
        address indexed pool,
        uint256 positionId,
        uint256 ethLiquidity,
        uint256 tokenLiquidity,
        uint160 sqrtPriceX96
    );

    error OnlyCurve();
    error UnauthorizedCallback();
    error ZeroAddress();
    error OnlyWeth();

    constructor(
        address curve_,
        LPLocker locker_,
        IWETH9 weth_,
        INonfungiblePositionManager positionManager_,
        FeeVault feeVault_
    ) {
        if (
            curve_ == address(0) || address(locker_) == address(0) || address(weth_) == address(0)
                || address(positionManager_) == address(0) || address(feeVault_) == address(0)
        ) revert ZeroAddress();
        curve = curve_;
        locker = locker_;
        weth = weth_;
        positionManager = positionManager_;
        feeVault = feeVault_;
    }

    function graduate(address token, address creator) external payable {
        if (msg.sender != curve) revert OnlyCurve();
        weth.deposit{value: msg.value}();

        address pool = LaunchToken(token).pool();
        bool tokenIsToken0 = token < address(weth);
        (address token0, address token1) = tokenIsToken0 ? (token, address(weth)) : (address(weth), token);

        // Pool, launch'ta hedef fiyatla initialize edildi. Biri likiditesiz pool'da fiyatı
        // oynattıysa geri çek. Token transferi pool'a kapalı olduğu için saldırgan sadece WETH
        // likiditesi ekleyebilir; bu da düzeltme swap'ını bizim için zararsız (hatta kârlı) yapar.
        // Çok derin WETH likiditesinde fiyat hedefe tam inmeyebilir; o zaman LP mevcut (daha yüksek)
        // fiyattan açılır ve piyasa (token sahiplerinin satışları) fiyatı aşağı çeker.
        uint160 target = PriceMath.targetSqrtPriceX96(tokenIsToken0);
        // forge-lint: disable-next-line(unused-return) -- sadece fiyat gerekli
        (uint160 current,,,,,,) = IUniswapV3Pool(pool).slot0();
        if (current != target) _movePrice(pool, current > target, target, token0, token1);

        uint256 amount0 = IERC20(token0).balanceOf(address(this));
        uint256 amount1 = IERC20(token1).balanceOf(address(this));
        IERC20(token0).forceApprove(address(positionManager), amount0);
        IERC20(token1).forceApprove(address(positionManager), amount1);

        // liquidity değeri gerekmiyor
        // forge-lint: disable-start(unused-return)
        (uint256 positionId,, uint256 used0, uint256 used1) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: C.UNI_FEE_TIER,
                tickLower: C.MIN_TICK,
                tickUpper: C.MAX_TICK,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0, // aynı tx'te fiyatı biz ayarladık; araya girilemez
                amount1Min: 0,
                recipient: address(locker),
                deadline: block.timestamp
            })
        );
        // forge-lint: disable-end(unused-return)
        locker.register(positionId, token, creator);

        // Yuvarlama artıkları: token yakılır, WETH protokole gider.
        uint256 leftoverToken = IERC20(token).balanceOf(address(this));
        if (leftoverToken > 0) IERC20(token).safeTransfer(C.DEAD, leftoverToken);
        uint256 leftoverWeth = weth.balanceOf(address(this));
        if (leftoverWeth > 0) {
            weth.withdraw(leftoverWeth);
            feeVault.depositFees{value: leftoverWeth}(address(0), leftoverWeth, 0);
        }

        // forge-lint: disable-next-line(unused-return) -- sadece fiyat gerekli
        (uint160 finalPrice,,,,,,) = IUniswapV3Pool(pool).slot0();
        (uint256 ethUsed, uint256 tokenUsed) = tokenIsToken0 ? (used1, used0) : (used0, used1);
        // Graduated, final pool fiyatını içerdiği için sonda yayınlanır; çağıran sadece BondingCurve (nonReentrant).
        // forge-lint: disable-next-line(reentrancy-events)
        emit Graduated(token, pool, positionId, ethUsed, tokenUsed, finalPrice);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
        if (msg.sender != activePool) revert UnauthorizedCallback();
        if (amount0Delta > 0) {
            // forge-lint: disable-next-line(unsafe-typecast) -- amount0Delta > 0 kontrol edildi
            IERC20(IUniswapV3Pool(msg.sender).token0()).safeTransfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            // forge-lint: disable-next-line(unsafe-typecast) -- amount1Delta > 0 kontrol edildi
            IERC20(IUniswapV3Pool(msg.sender).token1()).safeTransfer(msg.sender, uint256(amount1Delta));
        }
    }

    /// WETH.withdraw için
    receive() external payable {
        if (msg.sender != address(weth)) revert OnlyWeth();
    }

    function _movePrice(address pool, bool zeroForOne, uint160 target, address token0, address token1) private {
        // En fazla bakiyenin YARISI: saldırgan araya derin WETH likiditesi koyarsa tüm token'ı satıp
        // likiditesiz kalmayalım (aksi halde mint revert eder ve token hiç graduate olamaz = DoS).
        // Normal durumda (boş pool) fiyatı oynatmak bedavadır; yarısı fazlasıyla yeter.
        uint256 amountIn = IERC20(zeroForOne ? token0 : token1).balanceOf(address(this)) / 2;
        // forge-lint: disable-next-line(missing-events-access-control) -- tx içi geçici (transient) kilit
        activePool = pool;
        // Dönen tutarlara gerek yok: sonrasında kalan bakiyeler okunuyor.
        // forge-lint: disable-next-line(unsafe-typecast,unused-return) -- amountIn bir ERC20 bakiyesi (< 2^255)
        IUniswapV3Pool(pool).swap(address(this), zeroForOne, int256(amountIn), target, "");
        activePool = address(0);
    }
}
