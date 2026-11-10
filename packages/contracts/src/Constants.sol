// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Ağa göre değişen ETH miktarları: varsayılan profil mainnet, FOUNDRY_PROFILE=testnet testnet değerleri
// (foundry.toml'daki "params/" remapping'i). Bkz. src/params/{mainnet,testnet}/CurveParams.sol
import {CurveParams} from "params/CurveParams.sol";

/// @notice Protokol parametreleri. Kaynak: const.md (değişiklik önce orada yapılır).
library Constants {
    // Token
    uint256 internal constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 internal constant CURVE_SUPPLY = 800_000_000e18; // %80 curve'de satılır
    uint256 internal constant LP_SUPPLY = 200_000_000e18; // %20 graduation'da LP'ye

    // Bonding curve (sanal rezervli constant product: x * y = k)
    uint256 internal constant GRADUATION_ETH = CurveParams.GRADUATION_ETH;
    uint256 internal constant VIRTUAL_ETH = CurveParams.VIRTUAL_ETH; // x0
    // y0 = 3.2e9 / 3 token; wei cinsinden tam sayı olmadığı için yukarı yuvarlandı.
    uint256 internal constant VIRTUAL_TOKEN = 1_066_666_666_666_666_666_666_666_667; // y0

    // Fee'ler (bps, 10_000 = %100)
    uint256 internal constant BPS = 10_000;
    uint256 internal constant TRADE_FEE_BPS = 100; // %1
    uint256 internal constant PROTOCOL_FEE_BPS = 50; // %0.5
    uint256 internal constant CREATOR_FEE_BPS = 50; // %0.5
    uint256 internal constant LAUNCH_FEE = CurveParams.LAUNCH_FEE;

    // MEV koruması
    uint256 internal constant SNIPER_WINDOW = 60; // saniye
    uint256 internal constant SNIPER_FEE_START_BPS = 2_000; // %20 -> lineer düşüş -> %1
    uint256 internal constant MAX_DEV_BUY = 50_000_000e18; // %5

    // Uniswap v3 graduation
    uint24 internal constant UNI_FEE_TIER = 10_000; // %1
    int24 internal constant UNI_TICK_SPACING = 200;
    // Full-range: TickMath.MIN/MAX_TICK (±887272) tick spacing'e (200) yuvarlanmış hali
    int24 internal constant MIN_TICK = -887_200;
    int24 internal constant MAX_TICK = 887_200;

    // Graduation'da artan token'ların yakıldığı adres (OZ ERC20 address(0)'a transferi reddeder)
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
}

/// @notice Robinhood Chain mainnet (4663) adresleri. 2026-11-03'te zincirde doğrulandı, bkz. const.md
library RobinhoodMainnet {
    uint256 internal constant CHAIN_ID = 4663;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant UNI_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address internal constant UNI_V3_POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address internal constant UNI_SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address internal constant UNI_QUOTER_V2 = 0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168; // 6 ondalık!
}
