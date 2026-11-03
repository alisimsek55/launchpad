// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Constants as C} from "./Constants.sol";

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

/// @notice Periyodik alım (DCA). Kullanıcı ETH yatırıp plan açar; keeper zamanı gelince alım yapar.
/// Token curve'deyse BondingCurve'den, graduate olduysa Uniswap v3'ten alınır; token'lar doğrudan
/// plan sahibine gider. v1'de execute sadece izinli keeper'lara açıktır (bkz. notes.md §11).
contract DCAVault is Ownable2Step, ReentrancyGuard {
    using SafeCast for uint256;

    struct Plan {
        address owner;
        address token;
        uint128 ethPerBuy;
        uint128 balance; // planda kalan ETH
        uint32 interval; // saniye
        uint40 lastExecuted;
        uint32 executions;
        /// Token başına ödenecek en yüksek fiyat (ETH, 1e18 ölçekli). 0 = sınır yok.
        uint256 maxPrice;
    }

    uint32 public constant MIN_INTERVAL = 5 minutes;
    uint32 public constant MAX_BUYS = 1_000;

    BondingCurve public immutable curve;
    ISwapRouter02 public immutable router;
    address public immutable weth;

    uint256 public nextPlanId = 1;
    mapping(uint256 planId => Plan) public plans;
    mapping(address owner => uint256[]) private planIdsOf;
    mapping(address keeper => bool) public isKeeper;

    event DCAPlanCreated(
        uint256 indexed planId,
        address indexed owner,
        address indexed token,
        uint256 ethPerBuy,
        uint256 interval,
        uint256 count,
        uint256 maxPrice
    );
    event DCAExecuted(uint256 indexed planId, uint256 ethIn, uint256 tokenOut, bool viaUniswap);
    event DCAPlanCancelled(uint256 indexed planId, uint256 refund);
    event KeeperSet(address indexed keeper, bool allowed);

    error InvalidPlan();
    error NotKeeper();
    error NotOwner();
    error TooEarly();
    error PlanFinished();
    error ZeroAddress();

    constructor(address owner_, BondingCurve curve_, ISwapRouter02 router_, address weth_) Ownable(owner_) {
        if (address(curve_) == address(0) || address(router_) == address(0) || weth_ == address(0)) {
            revert ZeroAddress();
        }
        curve = curve_;
        router = router_;
        weth = weth_;
    }

    // ---------------------------------------------------------------- kullanıcı

    /// msg.value = ethPerBuy * count. İlk alım hemen yapılabilir (lastExecuted = 0).
    function createPlan(address token, uint256 ethPerBuy, uint32 interval, uint32 count, uint256 maxPrice)
        external
        payable
        nonReentrant
        returns (uint256 planId)
    {
        // forge-lint: disable-next-line(unused-return) -- sadece creator alanı gerekli
        (,,,, address creator,,) = curve.curves(token);
        if (creator == address(0)) revert InvalidPlan(); // sadece launchpad token'ları
        if (ethPerBuy == 0 || count == 0 || count > MAX_BUYS || interval < MIN_INTERVAL) revert InvalidPlan();
        if (msg.value != ethPerBuy * count) revert InvalidPlan();

        planId = nextPlanId++;
        plans[planId] = Plan({
            owner: msg.sender,
            token: token,
            ethPerBuy: ethPerBuy.toUint128(),
            balance: msg.value.toUint128(),
            interval: interval,
            lastExecuted: 0,
            executions: 0,
            maxPrice: maxPrice
        });
        planIdsOf[msg.sender].push(planId);
        emit DCAPlanCreated(planId, msg.sender, token, ethPerBuy, interval, count, maxPrice);
    }

    function cancelPlan(uint256 planId) external nonReentrant {
        Plan storage p = plans[planId];
        if (p.owner != msg.sender) revert NotOwner();
        uint256 refund = p.balance;
        p.balance = 0;
        emit DCAPlanCancelled(planId, refund);
        if (refund > 0) Address.sendValue(payable(msg.sender), refund);
    }

    // ---------------------------------------------------------------- keeper

    /// minTokensOut: keeper'ın güncel teklif + slippage ile hesapladığı alt sınır.
    /// Kullanıcının maxPrice'ı ayrıca zincir üzerinde uygulanır.
    function execute(uint256 planId, uint256 minTokensOut) external nonReentrant returns (uint256 tokensOut) {
        if (!isKeeper[msg.sender]) revert NotKeeper();
        Plan storage p = plans[planId];
        if (p.owner == address(0)) revert InvalidPlan();
        if (p.balance == 0) revert PlanFinished();
        // forge-lint: disable-next-line(block-timestamp) -- saat/gün ölçeğinde aralık; birkaç sn sapma önemsiz
        if (p.lastExecuted != 0 && block.timestamp < uint256(p.lastExecuted) + p.interval) revert TooEarly();

        // Son alım: iadelerden kalan küsurat da harcanır
        uint256 ethIn = p.balance < p.ethPerBuy ? p.balance : p.ethPerBuy;
        if (p.maxPrice > 0) {
            uint256 userMin = (ethIn * 1e18) / p.maxPrice;
            if (userMin > minTokensOut) minTokensOut = userMin;
        }

        p.balance -= ethIn.toUint128();
        p.lastExecuted = block.timestamp.toUint40();
        p.executions += 1;

        uint256 before = address(this).balance;
        // forge-lint: disable-next-line(unused-return) -- sadece graduated alanı gerekli
        (,,,,,, bool graduated) = curve.curves(p.token);
        if (graduated) {
            tokensOut = router.exactInputSingle{value: ethIn}(
                ISwapRouter02.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: p.token,
                    fee: C.UNI_FEE_TIER,
                    recipient: p.owner,
                    amountIn: ethIn,
                    amountOutMinimum: minTokensOut,
                    sqrtPriceLimitX96: 0
                })
            );
        } else {
            tokensOut = curve.buy{value: ethIn}(p.token, minTokensOut, block.timestamp, p.owner);
        }
        // Curve, eşiği aşan alımda fazla ETH'yi iade eder: plana geri yaz.
        uint256 refunded = address(this).balance - (before - ethIn);
        if (refunded > 0) p.balance += refunded.toUint128();

        // Alınan miktar harici çağrının sonucu; execute nonReentrant ve sadece izinli keeper çağırabilir.
        // forge-lint: disable-next-line(reentrancy-events)
        emit DCAExecuted(planId, ethIn - refunded, tokensOut, graduated);
    }

    // ---------------------------------------------------------------- görünümler

    function planIds(address owner) external view returns (uint256[] memory) {
        return planIdsOf[owner];
    }

    /// Keeper için: plan şu an çalıştırılabilir mi?
    function isDue(uint256 planId) external view returns (bool) {
        Plan storage p = plans[planId];
        if (p.owner == address(0) || p.balance == 0) return false;
        // forge-lint: disable-next-line(block-timestamp)
        return p.lastExecuted == 0 || block.timestamp >= uint256(p.lastExecuted) + p.interval;
    }

    // ---------------------------------------------------------------- admin

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        // forge-lint: disable-next-line(missing-events-access-control) -- KeeperSet hemen ardından yayınlanıyor
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    /// Curve iadeleri için (sadece curve ETH gönderebilir)
    receive() external payable {
        if (msg.sender != address(curve)) revert InvalidPlan();
    }
}
