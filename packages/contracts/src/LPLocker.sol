// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Constants as C} from "./Constants.sol";
import {FeeVault} from "./FeeVault.sol";
import {INonfungiblePositionManager, IWETH9} from "./interfaces/IUniswapV3.sol";

/// @notice Graduation LP NFT'lerini sonsuza kadar tutar. Likidite çekme veya NFT transfer
/// fonksiyonu YOKTUR; sadece birikmiş Uniswap fee'leri toplanıp %70/%30 dağıtılır.
contract LPLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 positionId;
        address creator;
    }

    INonfungiblePositionManager public immutable positionManager;
    IWETH9 public immutable weth;
    FeeVault public immutable feeVault;
    address public immutable treasury; // protokolün token-tarafı fee payı buraya gider
    address private immutable deployer;

    address public graduator;
    mapping(address token => Position) public positions;

    event PositionLocked(address indexed token, uint256 positionId, address indexed creator);
    event LPFeesCollected(address indexed token, uint256 ethAmount, uint256 tokenAmount);

    error AlreadyInitialized();
    error OnlyGraduator();
    error UnknownToken();
    error OnlyWeth();
    error ZeroAddress();

    event Initialized(address graduator);

    constructor(INonfungiblePositionManager positionManager_, IWETH9 weth_, FeeVault feeVault_, address treasury_) {
        if (
            address(positionManager_) == address(0) || address(weth_) == address(0) || address(feeVault_) == address(0)
                || treasury_ == address(0)
        ) revert ZeroAddress();
        positionManager = positionManager_;
        weth = weth_;
        feeVault = feeVault_;
        treasury = treasury_;
        deployer = msg.sender;
    }

    function initialize(address graduator_) external {
        if (msg.sender != deployer || graduator != address(0)) revert AlreadyInitialized();
        if (graduator_ == address(0)) revert ZeroAddress();
        graduator = graduator_;
        emit Initialized(graduator_);
    }

    function register(uint256 positionId, address token, address creator) external {
        if (msg.sender != graduator) revert OnlyGraduator();
        positions[token] = Position(positionId, creator);
        emit PositionLocked(token, positionId, creator);
    }

    /// Herkes çağırabilir; fee'ler her zaman doğru alıcılara gider.
    function collect(address token) external nonReentrant returns (uint256 ethAmount, uint256 tokenAmount) {
        Position memory p = positions[token];
        if (p.creator == address(0)) revert UnknownToken();

        (uint256 amount0, uint256 amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: p.positionId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        (tokenAmount, ethAmount) = token < address(weth) ? (amount0, amount1) : (amount1, amount0);

        if (ethAmount > 0) {
            weth.withdraw(ethAmount);
            uint256 protocolPart = (ethAmount * C.PROTOCOL_FEE_BPS) / C.TRADE_FEE_BPS;
            feeVault.depositFees{value: ethAmount}(p.creator, protocolPart, ethAmount - protocolPart);
        }
        if (tokenAmount > 0) {
            uint256 protocolPart = (tokenAmount * C.PROTOCOL_FEE_BPS) / C.TRADE_FEE_BPS;
            IERC20(token).safeTransfer(treasury, protocolPart);
            IERC20(token).safeTransfer(p.creator, tokenAmount - protocolPart);
        }
        // Tutarlar collect çağrısından geliyor; tüm akış nonReentrant.
        // forge-lint: disable-next-line(reentrancy-events)
        emit LPFeesCollected(token, ethAmount, tokenAmount);
    }

    /// WETH.withdraw için
    receive() external payable {
        if (msg.sender != address(weth)) revert OnlyWeth();
    }
}
