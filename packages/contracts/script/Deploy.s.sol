// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {DCAVault, ISwapRouter02} from "../src/DCAVault.sol";
import {Constants, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {FeeVault} from "../src/FeeVault.sol";
import {Graduator} from "../src/Graduator.sol";
import {LPLocker} from "../src/LPLocker.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {INonfungiblePositionManager, IWETH9} from "../src/interfaces/IUniswapV3.sol";

struct Deployment {
    FeeVault feeVault;
    BondingCurve curve;
    LPLocker locker;
    Graduator graduator;
    TokenFactory factory;
    DCAVault dca;
}

library DeployLib {
    /// owner: admin (mainnet'te Safe multisig), treasury: protokolün token-tarafı fee'leri.
    function deploy(address owner, address treasury, IWETH9 weth, INonfungiblePositionManager npm, ISwapRouter02 router)
        internal
        returns (Deployment memory d)
    {
        d.feeVault = new FeeVault(owner);
        d.curve = new BondingCurve(d.feeVault);
        d.locker = new LPLocker(npm, weth, d.feeVault, treasury);
        d.graduator = new Graduator(address(d.curve), d.locker, weth, npm, d.feeVault);
        d.factory = new TokenFactory(owner, d.curve, d.feeVault, npm, address(weth));
        d.curve.initialize(address(d.factory), address(d.graduator));
        d.locker.initialize(address(d.graduator));
        d.dca = new DCAVault(owner, d.curve, router, address(weth));
    }
}

/// Kullanım: forge script script/Deploy.s.sol --rpc-url robinhood --broadcast
/// Gerekli env: OWNER, TREASURY (ve imzalayan anahtar: --ledger / --account)
contract Deploy is Script {
    function run() external returns (Deployment memory d) {
        address owner = vm.envAddress("OWNER");
        address treasury = vm.envAddress("TREASURY");
        require(block.chainid == RH.CHAIN_ID, "sadece Robinhood mainnet");
        require(Constants.GRADUATION_ETH == 4.2 ether, "mainnet varsayilan profille derlenmeli");

        vm.startBroadcast();
        d = DeployLib.deploy(
            owner,
            treasury,
            IWETH9(RH.WETH),
            INonfungiblePositionManager(RH.UNI_V3_POSITION_MANAGER),
            ISwapRouter02(RH.UNI_SWAP_ROUTER_02)
        );
        vm.stopBroadcast();

        console.log("FeeVault     ", address(d.feeVault));
        console.log("BondingCurve ", address(d.curve));
        console.log("LPLocker     ", address(d.locker));
        console.log("Graduator    ", address(d.graduator));
        console.log("TokenFactory ", address(d.factory));
        console.log("DCAVault     ", address(d.dca));
    }
}
