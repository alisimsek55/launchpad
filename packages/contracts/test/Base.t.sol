// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeployLib, Deployment} from "../script/Deploy.s.sol";
import {ISwapRouter02} from "../src/DCAVault.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {INonfungiblePositionManager, IUniswapV3Pool, IWETH9} from "../src/interfaces/IUniswapV3.sol";
import {PriceMath} from "../src/libraries/PriceMath.sol";

/// Tüm testler Robinhood Chain mainnet fork'u üzerinde çalışır (testnet'te Uniswap yok).
/// Public RPC arşiv node değil (eski blokların state'i yok), bu yüzden en son bloktan fork alınır.
/// Sonuçlar bloktan bağımsızdır: sözleşmeler her testte sıfırdan deploy edilir.
abstract contract BaseTest is Test {
    Deployment internal d;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public virtual {
        vm.createSelectFork("robinhood");
        d = DeployLib.deploy(
            owner,
            treasury,
            IWETH9(RH.WETH),
            INonfungiblePositionManager(RH.UNI_V3_POSITION_MANAGER),
            ISwapRouter02(RH.UNI_SWAP_ROUTER_02)
        );
        vm.deal(creator, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _launch() internal returns (LaunchToken) {
        vm.prank(creator);
        return LaunchToken(d.factory.createToken{value: C.LAUNCH_FEE}("Test Token", "TEST", "ipfs://meta", 0));
    }

    /// Launch + sniper penceresinin dışına çık (normal %1 fee).
    function _launchAndSettle() internal returns (LaunchToken t) {
        t = _launch();
        vm.warp(block.timestamp + C.SNIPER_WINDOW);
    }

    function _buy(address who, LaunchToken t, uint256 eth) internal returns (uint256) {
        vm.prank(who);
        return d.curve.buy{value: eth}(address(t), 0, block.timestamp, who);
    }

    function _sell(address who, LaunchToken t, uint256 amount) internal returns (uint256 ethOut) {
        vm.startPrank(who);
        t.approve(address(d.curve), amount);
        ethOut = d.curve.sell(address(t), amount, 0, block.timestamp, who);
        vm.stopPrank();
    }

    function _state(LaunchToken t)
        internal
        view
        returns (uint256 virtualEth, uint256 virtualToken, uint256 realEth, uint256 tokensSold, bool graduated)
    {
        (uint128 x, uint128 y, uint128 r, uint128 s,,, bool g) = d.curve.curves(address(t));
        return (x, y, r, s, g);
    }

    function _sqrtPrice(LaunchToken t) internal view returns (uint160 p) {
        (p,,,,,,) = IUniswapV3Pool(t.pool()).slot0();
    }

    function _target(LaunchToken t) internal pure returns (uint160) {
        return PriceMath.targetSqrtPriceX96(address(t) < RH.WETH);
    }
}
