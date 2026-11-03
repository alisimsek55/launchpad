// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Constants as C} from "./Constants.sol";
import {FeeVault} from "./FeeVault.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {INonfungiblePositionManager} from "./interfaces/IUniswapV3.sol";
import {PriceMath} from "./libraries/PriceMath.sol";

/// @notice Yeni token'ları oluşturur. Pause sadece YENİ launch'ları durdurur;
/// alım/satım ve claim'ler hiçbir zaman durdurulamaz.
contract TokenFactory is Ownable2Step, Pausable, ReentrancyGuard {
    BondingCurve public immutable curve;
    FeeVault public immutable feeVault;
    INonfungiblePositionManager public immutable positionManager;
    address public immutable weth;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        address pool,
        uint256 timestamp
    );

    error InsufficientLaunchFee();
    error InvalidName();
    error InvalidSymbol();
    error ZeroAddress();

    constructor(
        address owner_,
        BondingCurve curve_,
        FeeVault feeVault_,
        INonfungiblePositionManager positionManager_,
        address weth_
    ) Ownable(owner_) {
        if (
            address(curve_) == address(0) || address(feeVault_) == address(0) || address(positionManager_) == address(0)
                || weth_ == address(0)
        ) revert ZeroAddress();
        curve = curve_;
        feeVault = feeVault_;
        positionManager = positionManager_;
        weth = weth_;
    }

    /// msg.value = launch fee + (isteğe bağlı) creator'ın ilk alımı.
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint256 minDevTokensOut
    ) external payable nonReentrant whenNotPaused returns (address token) {
        if (msg.value < C.LAUNCH_FEE) revert InsufficientLaunchFee();
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert InvalidSymbol();

        token = address(new LaunchToken(name, symbol, address(curve)));

        // Pool'u şimdiden hedef graduation fiyatıyla oluştur; adresi token'a bildir ki
        // graduation'a kadar pool'a transfer engellensin.
        bool tokenIsToken0 = token < weth;
        (address token0, address token1) = tokenIsToken0 ? (token, weth) : (weth, token);
        address pool = positionManager.createAndInitializePoolIfNecessary(
            token0, token1, C.UNI_FEE_TIER, PriceMath.targetSqrtPriceX96(tokenIsToken0)
        );
        LaunchToken(token).setPool(pool);

        curve.register(token, msg.sender);
        feeVault.depositFees{value: C.LAUNCH_FEE}(address(0), C.LAUNCH_FEE, 0);
        // Pool adresi harici çağrıdan geliyor; çağrılanlar kendi sözleşmelerimiz + Uniswap NPM, akış nonReentrant.
        // forge-lint: disable-next-line(reentrancy-events)
        emit TokenCreated(token, msg.sender, name, symbol, metadataURI, pool, block.timestamp);

        uint256 devEth = msg.value - C.LAUNCH_FEE;
        if (devEth > 0) curve.creatorBuy{value: devEth}(token, msg.sender, minDevTokensOut);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
