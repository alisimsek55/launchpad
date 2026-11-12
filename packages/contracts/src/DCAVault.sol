// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {Constants as C} from "./Constants.sol";
import {LaunchToken} from "./LaunchToken.sol";

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

/// Uniswap v3 pool'unun TWAP (oracle) için gereken kısmı.
interface IUniswapV3PoolOracle {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);

    function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external;
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
    /// Graduation sonrası alımlarda fiyatın karşılaştırıldığı TWAP penceresi (const.md: 5 dakika).
    uint32 public constant TWAP_WINDOW = 5 minutes;
    /// Bir token'a plan açılırken pool'un oracle kapasitesi en az buna çıkarılır. Pencere içinde bundan
    /// fazla swap'lı blok olursa 5 dk geriye bakılamaz (bkz. _checkTwap: TwapUnavailable).
    uint16 public constant ORACLE_CARDINALITY = 60;

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
    error PriceTooHigh();
    error PriceManipulated();
    error TwapUnavailable();

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
        _growOracle(token);
    }

    /// Kalan ETH'yi plan sahibine (çağırana) iade eder.
    function cancelPlan(uint256 planId) external {
        _cancelPlan(planId, payable(msg.sender));
    }

    /// Kalan ETH'yi plan sahibinin seçtiği alıcıya iade eder (ör. ETH alamayan sözleşme sahipleri için).
    function cancelPlan(uint256 planId, address payable recipient) external {
        if (recipient == address(0)) revert ZeroAddress();
        _cancelPlan(planId, recipient);
    }

    function _cancelPlan(uint256 planId, address payable recipient) private nonReentrant {
        Plan storage p = plans[planId];
        if (p.owner != msg.sender) revert NotOwner();
        uint256 refund = p.balance;
        p.balance = 0;
        emit DCAPlanCancelled(planId, refund);
        // forge-lint: disable-next-line(arbitrary-send-eth) -- plan sahibi kendi bakiyesini kendi seçtiği adrese çeker
        if (refund > 0) Address.sendValue(recipient, refund);
    }

    // ---------------------------------------------------------------- keeper

    /// minTokensOut: keeper'ın güncel teklif + slippage ile hesapladığı alt sınır.
    /// Kullanıcının maxPrice'ı ayrıca zincir üzerinde, gerçekten harcanan ETH üzerinden uygulanır.
    /// Graduation sonrası (Uniswap) alımda swap öncesi pool fiyatı 5 dk TWAP'tan en fazla
    /// DCA_TWAP_MAX_DEVIATION_TICKS (≈ %5) pahalı olabilir; keeper fiyatı itip planı kötü fiyattan çalıştıramaz.
    function execute(uint256 planId, uint256 minTokensOut) external nonReentrant returns (uint256 tokensOut) {
        if (!isKeeper[msg.sender]) revert NotKeeper();
        Plan storage p = plans[planId];
        if (p.owner == address(0)) revert InvalidPlan();
        if (p.balance == 0) revert PlanFinished();
        // forge-lint: disable-next-line(block-timestamp) -- saat/gün ölçeğinde aralık; birkaç sn sapma önemsiz
        if (p.lastExecuted != 0 && block.timestamp < uint256(p.lastExecuted) + p.interval) revert TooEarly();

        // Son alım: iadelerden kalan küsurat da harcanır
        uint256 ethIn = p.balance < p.ethPerBuy ? p.balance : p.ethPerBuy;

        p.balance -= ethIn.toUint128();
        p.lastExecuted = block.timestamp.toUint40();
        p.executions += 1;

        uint256 before = address(this).balance;
        // forge-lint: disable-next-line(unused-return) -- sadece graduated alanı gerekli
        (,,,,,, bool graduated) = curve.curves(p.token);
        if (graduated) {
            _checkTwap(p.token, p.maxPrice > 0);
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

        // maxPrice, iade sonrası gerçekten harcanan ETH ile kontrol edilir; yoksa geçerli bir terminal
        // (graduation) alımı, harcanmayıp iade edilen ETH yüzünden reddedilirdi.
        uint256 spent = ethIn - refunded;
        // Gereken token miktarı yukarı yuvarlanır: aşağı yuvarlansaydı tokensOut * maxPrice < spent * 1e18
        // olan (ör. 0 token dönen çok küçük) bir alım sınırdan geçebilirdi.
        if (p.maxPrice > 0 && tokensOut < Math.mulDiv(spent, 1e18, p.maxPrice, Math.Rounding.Ceil)) {
            revert PriceTooHigh();
        }

        // Alınan miktar harici çağrının sonucu; execute nonReentrant ve sadece izinli keeper çağırabilir.
        // forge-lint: disable-next-line(reentrancy-events)
        emit DCAExecuted(planId, spent, tokensOut, graduated);
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

    // ---------------------------------------------------------------- iç

    /// Pool'un oracle kapasitesini ORACLE_CARDINALITY'ye çıkarır (token başına bir kez; sonra no-op).
    /// Pool launch'ta oluşturulduğu için graduation öncesinde de çağrılabilir.
    function _growOracle(address token) private {
        IUniswapV3PoolOracle pool = IUniswapV3PoolOracle(LaunchToken(token).pool());
        // forge-lint: disable-next-line(unused-return) -- sadece observationCardinalityNext gerekli
        (,,,, uint16 next,,) = pool.slot0();
        if (next < ORACLE_CARDINALITY) pool.increaseObservationCardinalityNext(ORACLE_CARDINALITY);
    }

    /// Swap öncesi pool fiyatı, TWAP_WINDOW TWAP'ından token aleyhine DCA_TWAP_MAX_DEVIATION_TICKS'ten fazla
    /// sapmışsa revert eder. Pool'da 5 dk geriye yetecek gözlem yoksa (az kapasite + yakın zamanda swap; aynı
    /// bloktaki manipülasyon dahil) TWAP hesaplanamaz: kullanıcı maxPrice koyduysa ona güvenilir, koymadıysa
    /// TwapUnavailable ile revert edilir (keeper daha sonra tekrar dener).
    function _checkTwap(address token, bool hasMaxPrice) private view {
        IUniswapV3PoolOracle pool = IUniswapV3PoolOracle(LaunchToken(token).pool());
        // forge-lint: disable-next-line(unused-return) -- sadece güncel tick gerekli
        (, int24 spotTick,,,,,) = pool.slot0();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_WINDOW; // secondsAgos[1] = 0 (şimdi)
        int56[] memory cumulatives;
        try pool.observe(secondsAgos) returns (int56[] memory tc, uint160[] memory) {
            cumulatives = tc;
        } catch {
            if (!hasMaxPrice) revert TwapUnavailable();
            return;
        }

        // Uniswap OracleLibrary.consult: ortalama tick, eksi sonsuza doğru yuvarlanır.
        int56 delta = cumulatives[1] - cumulatives[0];
        int56 window = int56(uint56(TWAP_WINDOW));
        int256 twapTick = delta / window;
        if (delta < 0 && delta % window != 0) twapTick--;

        // tick = log_1.0001(token1/token0). Token token0 ise yüksek tick = pahalı token; token1 ise tersi.
        int256 overTwap = token < weth ? int256(spotTick) - twapTick : twapTick - int256(spotTick);
        if (overTwap > C.DCA_TWAP_MAX_DEVIATION_TICKS) revert PriceManipulated();
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
