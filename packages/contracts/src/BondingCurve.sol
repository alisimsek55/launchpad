// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Constants as C} from "./Constants.sol";
import {FeeVault} from "./FeeVault.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {PriceMath} from "./libraries/PriceMath.sol";

interface IGraduator {
    function graduate(address token, address creator) external payable;
}

/// @notice Tüm token'ların bonding curve'lerini tutan tek (singleton) sözleşme.
/// Model: sanal rezervli constant product, x * y = k. Ayrıntılar: notes.md §9.
/// Yuvarlama her zaman curve lehinedir; bu yüzden k hiçbir işlemde azalmaz.
contract BondingCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    struct Curve {
        uint128 virtualEth; // x
        uint128 virtualToken; // y
        uint128 realEth; // curve'de duran gerçek ETH (graduation'da Uniswap'e taşınır)
        uint128 tokensSold; // curve'den çıkmış gerçek token
        address creator;
        uint40 launchTime;
        bool graduated;
    }

    FeeVault public immutable feeVault;
    address private immutable deployer;

    address public factory;
    IGraduator public graduator;

    mapping(address token => Curve) public curves;

    /// ethAmount: curve'e giren/çıkan ETH (fee hariç); fiyat = ethAmount / tokenAmount.
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 protocolFee,
        uint256 creatorFee,
        uint256 virtualEth,
        uint256 virtualToken,
        uint256 realEth,
        uint256 timestamp
    );

    error AlreadyInitialized();
    error OnlyFactory();
    error UnknownToken();
    error AlreadyGraduated();
    error Expired();
    error ZeroAmount();
    error Slippage();
    error DevBuyTooLarge();
    error ZeroAddress();

    event Initialized(address factory, address graduator);

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    constructor(FeeVault feeVault_) {
        if (address(feeVault_) == address(0)) revert ZeroAddress();
        feeVault = feeVault_;
        deployer = msg.sender;
    }

    /// Deploy sırasında bir kez çağrılır (döngüsel bağımlılık nedeniyle constructor'da verilemiyor).
    function initialize(address factory_, address graduator_) external {
        if (msg.sender != deployer || factory != address(0)) revert AlreadyInitialized();
        if (factory_ == address(0) || graduator_ == address(0)) revert ZeroAddress();
        factory = factory_;
        graduator = IGraduator(graduator_);
        emit Initialized(factory_, graduator_);
    }

    function register(address token, address creator) external onlyFactory {
        curves[token] = Curve({
            virtualEth: C.VIRTUAL_ETH.toUint128(),
            virtualToken: C.VIRTUAL_TOKEN.toUint128(),
            realEth: 0,
            tokensSold: 0,
            creator: creator,
            launchTime: block.timestamp.toUint40(),
            graduated: false
        });
    }

    // ---------------------------------------------------------------- işlemler

    function buy(address token, uint256 minTokensOut, uint256 deadline, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        // forge-lint: disable-next-line(block-timestamp) -- deadline kontrolü; birkaç sn sapma önemsiz
        if (block.timestamp > deadline) revert Expired();
        Curve storage c = _active(token);
        uint256 feeBps = PriceMath.buyFeeBps(block.timestamp - c.launchTime);
        tokensOut = _buy(token, c, feeBps, minTokensOut, recipient, type(uint256).max);
    }

    /// Creator'ın launch tx'indeki ilk alımı: sniper fee'si yok, üst sınır MAX_DEV_BUY.
    function creatorBuy(address token, address recipient, uint256 minTokensOut)
        external
        payable
        nonReentrant
        onlyFactory
        returns (uint256 tokensOut)
    {
        Curve storage c = _active(token);
        tokensOut = _buy(token, c, C.TRADE_FEE_BPS, minTokensOut, recipient, C.MAX_DEV_BUY);
    }

    function sell(address token, uint256 tokenIn, uint256 minEthOut, uint256 deadline, address recipient)
        external
        nonReentrant
        returns (uint256 ethOut)
    {
        // forge-lint: disable-next-line(block-timestamp) -- deadline kontrolü; birkaç sn sapma önemsiz
        if (block.timestamp > deadline) revert Expired();
        if (tokenIn == 0) revert ZeroAmount();
        Curve storage c = _active(token);

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenIn);

        uint256 x = c.virtualEth;
        uint256 y = c.virtualToken;
        uint256 newY = y + tokenIn;
        uint256 newX = Math.mulDiv(x, y, newY, Math.Rounding.Ceil);
        uint256 ethFromCurve = x - newX;
        if (ethFromCurve > c.realEth) ethFromCurve = c.realEth; // savunma; matematiksel olarak olmamalı

        uint256 fee = (ethFromCurve * C.TRADE_FEE_BPS) / C.BPS;
        ethOut = ethFromCurve - fee;
        if (ethOut < minEthOut) revert Slippage();

        c.virtualEth = newX.toUint128();
        c.virtualToken = newY.toUint128();
        c.realEth -= ethFromCurve.toUint128();
        c.tokensSold -= tokenIn.toUint128();

        _settleFeesAndEmit(token, c, msg.sender, false, ethFromCurve, tokenIn, fee);

        // forge-lint: disable-next-line(arbitrary-send-eth) -- satıcının kendi seçtiği alıcı, son adım, nonReentrant
        Address.sendValue(payable(recipient), ethOut);
    }

    // ---------------------------------------------------------------- görünümler

    function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee) {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.graduated) revert AlreadyGraduated();
        uint256 feeBps = PriceMath.buyFeeBps(block.timestamp - c.launchTime);
        fee = (ethIn * feeBps) / C.BPS;
        tokensOut =
            c.virtualToken - Math.mulDiv(c.virtualEth, c.virtualToken, c.virtualEth + ethIn - fee, Math.Rounding.Ceil);
        uint256 remaining = C.CURVE_SUPPLY - c.tokensSold;
        if (tokensOut > remaining) tokensOut = remaining;
    }

    function quoteSell(address token, uint256 tokenIn) external view returns (uint256 ethOut, uint256 fee) {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.graduated) revert AlreadyGraduated();
        uint256 ethFromCurve =
            c.virtualEth - Math.mulDiv(c.virtualEth, c.virtualToken, c.virtualToken + tokenIn, Math.Rounding.Ceil);
        fee = (ethFromCurve * C.TRADE_FEE_BPS) / C.BPS;
        ethOut = ethFromCurve - fee;
    }

    function currentBuyFeeBps(address token) external view returns (uint256) {
        return PriceMath.buyFeeBps(block.timestamp - curves[token].launchTime);
    }

    // ---------------------------------------------------------------- iç

    function _active(address token) private view returns (Curve storage c) {
        c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.graduated) revert AlreadyGraduated();
    }

    function _buy(
        address token,
        Curve storage c,
        uint256 feeBps,
        uint256 minTokensOut,
        address recipient,
        uint256 maxTokens
    ) private returns (uint256 tokensOut) {
        uint256 ethIn = msg.value;
        if (ethIn == 0) revert ZeroAmount();

        uint256 x = c.virtualEth;
        uint256 y = c.virtualToken;
        uint256 remaining = C.CURVE_SUPPLY - c.tokensSold;

        uint256 fee = (ethIn * feeBps) / C.BPS;
        uint256 ethToCurve = ethIn - fee;
        tokensOut = y - Math.mulDiv(x, y, x + ethToCurve, Math.Rounding.Ceil);
        if (tokensOut > maxTokens) revert DevBuyTooLarge();

        // Eşiği aşan son alım: kalan token'la sınırlanır, fazla ETH iade edilir.
        uint256 refund = 0;
        if (tokensOut >= remaining) {
            tokensOut = remaining;
            ethToCurve = Math.mulDiv(x, y, y - remaining, Math.Rounding.Ceil) - x;
            uint256 gross = Math.mulDiv(ethToCurve, C.BPS, C.BPS - feeBps, Math.Rounding.Ceil);
            if (gross > ethIn) gross = ethIn;
            fee = gross - ethToCurve;
            refund = ethIn - gross;
        }
        if (tokensOut < minTokensOut) revert Slippage();

        uint256 newX = x + ethToCurve;
        uint256 newY = y - tokensOut;
        c.virtualEth = newX.toUint128();
        c.virtualToken = newY.toUint128();
        c.realEth += ethToCurve.toUint128();
        c.tokensSold += tokensOut.toUint128();

        IERC20(token).safeTransfer(recipient, tokensOut);
        _settleFeesAndEmit(token, c, recipient, true, ethToCurve, tokensOut, fee);

        if (c.tokensSold == C.CURVE_SUPPLY) _graduate(token, c);
        // forge-lint: disable-next-line(arbitrary-send-eth) -- fazla ETH ödeyene iade, son adım, nonReentrant
        if (refund > 0) Address.sendValue(payable(msg.sender), refund);
    }

    function _graduate(address token, Curve storage c) private {
        c.graduated = true;
        LaunchToken(token).markGraduated();
        IERC20(token).safeTransfer(address(graduator), IERC20(token).balanceOf(address(this)));
        // forge-lint: disable-next-line(arbitrary-send-eth) -- alıcı sabit, initialize ile atanan kendi Graduator sözleşmemiz
        graduator.graduate{value: c.realEth}(token, c.creator);
    }

    /// Fee, protokol ve creator arasında %50 / %50 bölünür (sniper fee'si dahil).
    function _settleFeesAndEmit(
        address token,
        Curve storage c,
        address trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 fee
    ) private {
        uint256 protocolFee = (fee * C.PROTOCOL_FEE_BPS) / C.TRADE_FEE_BPS;
        uint256 creatorFee = fee - protocolFee;
        // Event fee kasasına yapılan çağrıdan önce. Öncesindeki tek harici çağrı kendi LaunchToken'ımıza
        // (hook yok) ve tüm akış nonReentrant.
        // forge-lint: disable-start(reentrancy-events)
        emit Trade(
            token,
            trader,
            isBuy,
            ethAmount,
            tokenAmount,
            protocolFee,
            creatorFee,
            c.virtualEth,
            c.virtualToken,
            c.realEth,
            block.timestamp
        );
        // forge-lint: disable-end(reentrancy-events)
        if (fee > 0) feeVault.depositFees{value: fee}(c.creator, protocolFee, creatorFee);
    }
}
