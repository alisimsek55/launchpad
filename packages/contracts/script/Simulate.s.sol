// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DeployLib, Deployment} from "./Deploy.s.sol";
import {ISwapRouter02} from "../src/DCAVault.sol";
import {Constants as C, RobinhoodMainnet as RH} from "../src/Constants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {INonfungiblePositionManager, IWETH9} from "../src/interfaces/IUniswapV3.sol";

/// SADECE YEREL: anvil mainnet fork'unda deploy + örnek işlemler (indexer/subgraph uçtan uca testi için).
/// Anvil'in herkese açık test anahtarlarını kullanır; gerçek ağda çalışmaz (anvil bakiyesi kontrolü).
///   anvil --fork-url https://rpc.mainnet.chain.robinhood.com
///   forge script script/Simulate.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract Simulate is Script {
    // anvil varsayılan hesapları 0-3: herkese açık test cümlesinden türetilir
    string constant ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
    uint256 PK0;
    uint256 PK1;
    uint256 PK2;
    uint256 PK3;

    function run() external {
        PK0 = vm.deriveKey(ANVIL_MNEMONIC, 0);
        PK1 = vm.deriveKey(ANVIL_MNEMONIC, 1);
        PK2 = vm.deriveKey(ANVIL_MNEMONIC, 2);
        PK3 = vm.deriveKey(ANVIL_MNEMONIC, 3);
        require(block.chainid == RH.CHAIN_ID, "fork degil");
        // Fork chain id'yi korur; anvil'de olduğumuzu test hesabının 10k ETH bakiyesinden anlarız.
        require(vm.addr(PK0).balance >= 1_000 ether, "sadece yerel anvil");
        // Bu herkese açık test adresleri mainnet'te EIP-7702 ile "sweeper" sözleşmesine bağlı:
        // gelen ETH'yi botlara aktarıyor. Fork bu kodu kopyalar; yerelde temizle.
        for (uint256 i; i < 4; i++) {
            vm.rpc(
                "anvil_setCode",
                string.concat('["', vm.toString(vm.addr(vm.deriveKey(ANVIL_MNEMONIC, uint32(i)))), '","0x"]')
            );
        }

        address deployer = vm.addr(PK0);
        // Arbitrum Orbit: block.number L1 blok numarasını döndürür; L2 bloğunu RPC'den al.
        bytes memory raw = vm.rpc("eth_blockNumber", "[]");
        uint256 startBlock = uint256(bytes32(raw)) >> (256 - raw.length * 8);
        vm.startBroadcast(PK0);
        Deployment memory d = DeployLib.deploy(
            deployer,
            deployer,
            IWETH9(RH.WETH),
            INonfungiblePositionManager(RH.UNI_V3_POSITION_MANAGER),
            ISwapRouter02(RH.UNI_SWAP_ROUTER_02)
        );
        // Yerel keeper: deployer (apps/keeper yerelde bu hesapla çalışır)
        d.dca.setKeeper(deployer, true);
        // Token A: dev buy ile
        LaunchToken a =
            LaunchToken(d.factory.createToken{value: C.LAUNCH_FEE + 0.05 ether}("Alpha", "ALPHA", "ipfs://a", 0));
        // Token B: graduate olacak
        LaunchToken b = LaunchToken(d.factory.createToken{value: C.LAUNCH_FEE}("Beta", "BETA", "ipfs://b", 0));
        vm.stopBroadcast();

        _buy(PK1, d, a, 0.3 ether);
        _buy(PK2, d, a, 0.1 ether);
        _buy(PK3, d, a, 0.02 ether);
        // PK2 yarısını satar
        vm.startBroadcast(PK2);
        uint256 half = a.balanceOf(vm.addr(PK2)) / 2;
        a.approve(address(d.curve), half);
        d.curve.sell(address(a), half, 0, block.timestamp + 1 hours, vm.addr(PK2));
        // PK2, PK3'e token gönderir (curve dışı transfer)
        a.transfer(vm.addr(PK3), 1_000e18);
        vm.stopBroadcast();

        _buy(PK1, d, b, 1 ether);
        _buy(PK3, d, b, 6 ether); // graduation

        console.log("TOKEN_FACTORY_ADDRESS", address(d.factory));
        console.log("BONDING_CURVE_ADDRESS", address(d.curve));
        console.log("GRADUATOR_ADDRESS", address(d.graduator));
        console.log("TOKEN_A", address(a));
        console.log("TOKEN_B", address(b));
        _writeDeployment(d, startBlock);
    }

    /// web, api ve indexer'ın okuduğu packages/shared/deployments/local.json
    function _writeDeployment(Deployment memory d, uint256 startBlock) internal {
        string memory k = "deployment";
        vm.serializeString(k, "network", "local");
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeString(k, "rpcUrl", "http://127.0.0.1:8545");
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeAddress(k, "tokenFactory", address(d.factory));
        vm.serializeAddress(k, "bondingCurve", address(d.curve));
        vm.serializeAddress(k, "graduator", address(d.graduator));
        vm.serializeAddress(k, "lpLocker", address(d.locker));
        vm.serializeAddress(k, "feeVault", address(d.feeVault));
        vm.serializeAddress(k, "dcaVault", address(d.dca));
        vm.serializeAddress(k, "weth", RH.WETH);
        vm.serializeAddress(k, "uniV3Factory", RH.UNI_V3_FACTORY);
        vm.serializeAddress(k, "uniPositionManager", RH.UNI_V3_POSITION_MANAGER);
        vm.serializeAddress(k, "uniSwapRouter02", RH.UNI_SWAP_ROUTER_02);
        string memory json = vm.serializeAddress(k, "uniQuoterV2", RH.UNI_QUOTER_V2);
        vm.writeJson(json, "../shared/deployments/local.json");
    }

    function _buy(uint256 pk, Deployment memory d, LaunchToken t, uint256 eth) internal {
        vm.startBroadcast(pk);
        d.curve.buy{value: eth}(address(t), 0, block.timestamp + 1 hours, vm.addr(pk));
        vm.stopBroadcast();
    }
}
