// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Constants as C} from "./Constants.sol";
import {FeeVault} from "./FeeVault.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {LPLocker} from "./LPLocker.sol";
import {INonfungiblePositionManager, IUniswapV3Pool, IWETH9} from "./interfaces/IUniswapV3.sol";
import {PriceMath} from "./libraries/PriceMath.sol";
import {TickMath} from "./libraries/TickMath.sol";

/// Pool'un tick bitmap'i (hangi tick'lerde likidite sınırı var). Ortak arayüze dokunmamak için burada.
interface IUniswapV3PoolTicks {
    function tickBitmap(int16 wordPosition) external view returns (uint256);
}

/// @notice Curve'den gelen ETH ve token'larla Uniswap v3'te full-range likidite açar ve
/// LP NFT'sini LPLocker'a kilitler. Normalde tümü curve'ün son alım tx'i içinde, atomik olarak.
///
/// Pool launch'ta hedef fiyatla kurulur ve izinsizdir: biri likiditesiz pool'da fiyatı itip hedef ile
/// itilmiş fiyat arasına binlerce dar WETH pozisyonu koyabilir. Düzeltme swap'ı bu tick'lerin hepsini
/// geçmek zorunda olduğundan tek seferde yapılırsa blok gas limitini aşar ve graduation sonsuza kadar
/// kilitlenir. Bu yüzden her çağrı en fazla MAX_TICK_CROSSINGS initialize tick geçer; hedefe
/// varılamazsa varlıklar burada token başına ayrılmış olarak bekler (GraduationPending) ve herkes
/// `continueGraduation` ile bir sonraki sınırlı adımı tetikleyebilir.
contract Graduator is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// Bir çağrıda düzeltme swap'ının geçebileceği en fazla initialize tick.
    /// Ölçüm (test/GraduationDos.t.sol): tick geçişi ~38k gas => 200 tick ~8M gas; Arbitrum'un 32M tx
    /// limitinin çok altında, son alımın kalan işleriyle birlikte de güvenli pay bırakır.
    uint256 public constant MAX_TICK_CROSSINGS = 200;

    /// Hedefe ulaşamamış graduation'ın bu sözleşmede bekleyen varlıkları.
    /// Token tarafı = bu sözleşmenin o token bakiyesi (token başına ayrı ERC20, karışmaz).
    /// WETH ise tüm bekleyenler için ortak bakiyede durduğundan token başına ayrıca sayılır.
    struct Pending {
        address creator; // != 0 ise bekleyen graduation var
        uint128 weth; // bu graduation'a ait WETH
        uint128 tokenBudget; // düzeltmede satılabilecek kalan token (başlangıç bakiyesinin yarısı)
        uint128 wethBudget; // düzeltmede harcanabilecek kalan WETH (başlangıç WETH'inin yarısı)
    }

    address public immutable curve;
    LPLocker public immutable locker;
    IWETH9 public immutable weth;
    INonfungiblePositionManager public immutable positionManager;
    FeeVault public immutable feeVault;

    mapping(address token => Pending) public pending;

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
    /// Fiyat bu çağrıda hedefe getirilemedi (çok sayıda saldırgan tick'i); `continueGraduation` bekleniyor.
    event GraduationPending(address indexed token, address indexed pool, uint160 sqrtPriceX96);

    error OnlyCurve();
    error UnauthorizedCallback();
    error ZeroAddress();
    error OnlyWeth();
    error NotPending();

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

    function graduate(address token, address creator) external payable nonReentrant {
        if (msg.sender != curve) revert OnlyCurve();
        weth.deposit{value: msg.value}();
        uint256 tokens = IERC20(token).balanceOf(address(this));
        Pending memory g = Pending({
            creator: creator,
            weth: msg.value.toUint128(),
            // En fazla bakiyenin YARISI: saldırgan araya derin likidite koyarsa tüm varlığı satıp
            // likiditesiz kalmayalım (aksi halde mint revert eder ve token hiç graduate olamaz = DoS).
            // Normal durumda (boş pool) fiyatı oynatmak bedavadır; yarısı fazlasıyla yeter.
            tokenBudget: (tokens / 2).toUint128(),
            wethBudget: (msg.value / 2).toUint128()
        });
        _advanceOrPend(token, g);
    }

    /// Bekleyen graduation'ı bir sınırlı adım ilerletir; hedefe varılırsa (ya da bütçe biterse) LP'yi açar.
    /// Herkes çağırabilir: varlıklar sadece hedefe doğru swap'a ve kilitli LP'ye gidebilir.
    function continueGraduation(address token) external nonReentrant {
        Pending memory g = pending[token];
        if (g.creator == address(0)) revert NotPending();
        delete pending[token]; // bitmezse _advanceOrPend geri yazar
        _advanceOrPend(token, g);
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

    function _advanceOrPend(address token, Pending memory g) private {
        address pool = LaunchToken(token).pool();
        bool tokenIsToken0 = token < address(weth);
        if (_movePrice(pool, tokenIsToken0, g)) {
            _finish(token, pool, tokenIsToken0, g);
        } else {
            pending[token] = g;
            // forge-lint: disable-next-line(unused-return) -- sadece fiyat gerekli
            (uint160 price,,,,,,) = IUniswapV3Pool(pool).slot0();
            // Fiyat swap'tan sonra okunuyor; graduate'i curve (nonReentrant), continue'yu nonReentrant çağırır.
            // forge-lint: disable-next-line(reentrancy-events)
            emit GraduationPending(token, pool, price);
        }
    }

    /// Fiyatı hedefe doğru en fazla MAX_TICK_CROSSINGS tick geçerek çeker. LP açılabilecekse true:
    /// fiyat hedefte ya da o yöndeki bütçe bitti (derin likidite; LP mevcut fiyattan açılır).
    function _movePrice(address pool, bool tokenIsToken0, Pending memory g) private returns (bool) {
        uint160 target = PriceMath.targetSqrtPriceX96(tokenIsToken0);
        // forge-lint: disable-next-line(unused-return) -- fiyat ve tick yeterli
        (uint160 current, int24 tick,,,,,) = IUniswapV3Pool(pool).slot0();
        if (current == target) return true;

        // Her swap hedefe doğrudur: fiyat yüksekken token'ı hedeften pahalıya satar, düşükken hedeften
        // ucuza alırız. Graduation öncesi pool'a token aktarılamadığından saldırgan sadece WETH koyabilir,
        // yani pratikte hep "fiyat yüksek, token sat" yönü; diğer yön yalnızca bekleme sırasında olabilir.
        bool zeroForOne = current > target;
        bool sellToken = zeroForOne == tokenIsToken0; // zeroForOne'da token0 verilir
        uint256 budget = sellToken ? g.tokenBudget : g.wethBudget;
        if (budget == 0) return true;

        uint160 limit = _crossingLimit(pool, tick, target, zeroForOne);
        // forge-lint: disable-next-line(missing-events-access-control) -- tx içi geçici (transient) kilit
        activePool = pool;
        // budget uint128; pending yazımından önceki dış çağrı: tüm giriş noktaları nonReentrant
        // forge-lint: disable-next-line(unsafe-typecast,reentrancy-no-eth)
        (int256 a0, int256 a1) = IUniswapV3Pool(pool).swap(address(this), zeroForOne, int256(budget), limit, "");
        activePool = address(0);

        // Pool açısından: pozitif = bizden pool'a giden, negatif = bize gelen
        (int256 tokenDelta, int256 wethDelta) = tokenIsToken0 ? (a0, a1) : (a1, a0);
        // forge-lint: disable-start(unsafe-typecast) -- işaretler swap yönünden belli (exact input)
        if (sellToken) {
            g.tokenBudget -= uint256(tokenDelta).toUint128();
            g.weth += uint256(-wethDelta).toUint128();
            budget = g.tokenBudget;
        } else {
            g.wethBudget -= uint256(wethDelta).toUint128();
            g.weth -= uint256(wethDelta).toUint128();
            budget = g.wethBudget;
        }
        // forge-lint: disable-end(unsafe-typecast)

        // forge-lint: disable-next-line(unused-return) -- sadece fiyat gerekli
        (current,,,,,,) = IUniswapV3Pool(pool).slot0();
        // Hedefe varılmadı ama bütçe kaldı => tick sınırında durduk, sonraki adım gerekiyor
        return current == target || budget == 0;
    }

    function _finish(address token, address pool, bool tokenIsToken0, Pending memory g) private {
        uint256 tokens = IERC20(token).balanceOf(address(this));
        (address token0, address token1, uint256 amount0, uint256 amount1) = tokenIsToken0
            ? (token, address(weth), tokens, uint256(g.weth))
            : (address(weth), token, uint256(g.weth), tokens);
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
        locker.register(positionId, token, g.creator);

        (uint256 ethUsed, uint256 tokenUsed) = tokenIsToken0 ? (used1, used0) : (used0, used1);
        // Yuvarlama artıkları: token yakılır, bu graduation'ın WETH artığı protokole gider
        // (başka bekleyen graduation'ların WETH'ine dokunulmaz).
        uint256 leftoverToken = IERC20(token).balanceOf(address(this));
        if (leftoverToken > 0) IERC20(token).safeTransfer(C.DEAD, leftoverToken);
        uint256 leftoverWeth = g.weth - ethUsed;
        if (leftoverWeth > 0) {
            weth.withdraw(leftoverWeth);
            feeVault.depositFees{value: leftoverWeth}(address(0), leftoverWeth, 0);
        }

        // forge-lint: disable-next-line(unused-return) -- sadece fiyat gerekli
        (uint160 finalPrice,,,,,,) = IUniswapV3Pool(pool).slot0();
        // Graduated, final pool fiyatını içerdiği için sonda yayınlanır; tüm giriş noktaları nonReentrant.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Graduated(token, pool, positionId, ethUsed, tokenUsed, finalPrice);
    }

    /// Hedefe giderken geçilecek initialize tick'leri pool'un bitmap'inden sayar ve swap'ın fiyat
    /// sınırını MAX_TICK_CROSSINGS'inci tick'e koyar (daha azsa hedefin kendisi). Swap, pool'un kendi
    /// döngüsüyle aynı tick'leri geçer: aşağı giderken mevcut sıkıştırılmış tick dahil, yukarı giderken hariç.
    /// Tarama hedefi geçince durur; tam aralık 1% tier'da ~35 bitmap kelimesi olduğundan sınırlıdır.
    function _crossingLimit(address pool, int24 tick, uint160 target, bool zeroForOne)
        private
        view
        returns (uint160 limit)
    {
        int256 s = C.UNI_TICK_SPACING;
        // Pool'daki gibi aşağı yuvarlanmış "sıkıştırılmış" tick (tick / spacing); k * s bilinçli olarak
        // tick'i spacing'e yuvarlar (bölme-sonra-çarpma uyarıları bu yüzden kapalı)
        int256 k = int256(tick) / s;
        if (tick < 0 && int256(tick) % s != 0) k--;
        uint256 count = 0;
        if (zeroForOne) {
            while (true) {
                int256 w = k >> 8;
                // Taranacak kısmın en üst tick'i bile hedefin altındaysa geçilecek tick kalmadı
                // forge-lint: disable-next-line(divide-before-multiply)
                if (_sqrtAt(k * s) < target) return target;
                uint256 word = _word(pool, w);
                uint256 bit = uint256(k & 0xff);
                if (bit < 255) word &= (uint256(1) << (bit + 1)) - 1; // bit dahil, altındakiler
                while (word != 0) {
                    uint256 b = Math.log2(word); // en yüksek bit = en yakın tick
                    // forge-lint: disable-next-line(unsafe-typecast) -- b < 256
                    uint160 p = _sqrtAt((w * 256 + int256(b)) * s);
                    if (p < target) return target;
                    if (++count == MAX_TICK_CROSSINGS) return p;
                    word ^= uint256(1) << b;
                }
                k = w * 256 - 1;
            }
        } else {
            k += 1;
            while (true) {
                int256 w = k >> 8;
                // forge-lint: disable-next-line(divide-before-multiply)
                if (_sqrtAt(k * s) > target) return target;
                uint256 word = _word(pool, w);
                uint256 bit = uint256(k & 0xff);
                word &= ~((uint256(1) << bit) - 1); // bit dahil, üstündekiler
                while (word != 0) {
                    uint256 b = Math.log2(word & (~word + 1)); // en düşük bit = en yakın tick
                    // forge-lint: disable-next-line(unsafe-typecast) -- b < 256
                    uint160 p = _sqrtAt((w * 256 + int256(b)) * s);
                    if (p > target) return target;
                    if (++count == MAX_TICK_CROSSINGS) return p;
                    word ^= uint256(1) << b;
                }
                k = (w + 1) * 256;
            }
        }
        // Buraya gelinmez: döngüler en geç hedefin kelimesinde return eder (hedef geçerli tick aralığında)
        limit = target;
    }

    function _word(address pool, int256 w) private view returns (uint256) {
        // Döngüdeki tek dış çağrı: kendi pool'umuzun view'ı, en fazla ~35 kelime
        // |w| <= 18 (±887272 / 200 / 256)
        // forge-lint: disable-next-line(calls-loop,unsafe-typecast)
        return IUniswapV3PoolTicks(pool).tickBitmap(int16(w));
    }

    /// Geçerli aralığa kırpılmış tick'in fiyatı (kelime sınırları aralık dışına taşabilir)
    function _sqrtAt(int256 t) private pure returns (uint160) {
        if (t < TickMath.MIN_TICK) t = TickMath.MIN_TICK;
        if (t > TickMath.MAX_TICK) t = TickMath.MAX_TICK;
        // forge-lint: disable-next-line(unsafe-typecast) -- yukarıda int24 aralığına kırpıldı
        return TickMath.getSqrtRatioAtTick(int24(t));
    }
}
