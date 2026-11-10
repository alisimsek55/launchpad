// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {DeployLib, Deployment} from "./Deploy.s.sol";
import {ISwapRouter02} from "../src/DCAVault.sol";
import {Constants as C} from "../src/Constants.sol";
import {INonfungiblePositionManager, IWETH9} from "../src/interfaces/IUniswapV3.sol";

/// Robinhood Chain TESTNET (46630) deploy'u. Testnet'te Uniswap v3 olmadığı için önce resmi npm
/// artefaktlarından (aynı bytecode → aynı pool init code hash) kendi Uniswap v3'ümüzü kurar,
/// sonra protokolü deploy edip packages/shared/deployments/testnet.json'u yazar.
///
///   FOUNDRY_PROFILE=testnet forge script script/DeployTestnet.s.sol --rpc-url robinhood_testnet --broadcast --account <keystore>
/// (testnet profili ETH miktarlarını 1/1000 yapar: graduation 0.0042 ETH, bkz. src/params/testnet)
///
/// Owner, treasury ve DCA keeper'ı deploy eden adrestir (testnet demo). KEEPER env'i verilirse o adres
/// de keeper olarak yetkilendirilir (GitHub Actions'taki keeper cüzdanı).
contract DeployTestnet is Script {
    uint256 constant TESTNET_CHAIN_ID = 46630;
    address constant TESTNET_WETH = 0x7943e237c7F95DA44E0301572D358911207852Fa; // const.md

    string constant FACTORY_ART = "node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json";
    string constant NPM_ART =
        "node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json";
    string constant QUOTER_ART = "node_modules/@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json";
    string constant ROUTER_ART =
        "node_modules/@uniswap/swap-router-contracts/artifacts/contracts/SwapRouter02.sol/SwapRouter02.json";

    function run() external {
        require(block.chainid == TESTNET_CHAIN_ID, "sadece Robinhood testnet (46630)");
        require(C.GRADUATION_ETH == 0.0042 ether, "FOUNDRY_PROFILE=testnet ile calistir");
        // Arbitrum Orbit: block.number L1 bloğu; L2 bloğunu RPC'den al
        bytes memory raw = vm.rpc("eth_blockNumber", "[]");
        uint256 startBlock = uint256(bytes32(raw)) >> (256 - raw.length * 8);
        address keeper = vm.envOr("KEEPER", address(0));

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        // 1) Uniswap v3 (fee tier'lar 500/3000/10000 factory constructor'ında açılır)
        address factory = vm.deployCode(FACTORY_ART);
        // Token descriptor sadece NFT tokenURI içindir; testnet'te gerekmiyor
        address npm = vm.deployCode(NPM_ART, abi.encode(factory, TESTNET_WETH, address(0)));
        address router = vm.deployCode(ROUTER_ART, abi.encode(address(0), factory, npm, TESTNET_WETH));
        address quoter = vm.deployCode(QUOTER_ART, abi.encode(factory, TESTNET_WETH));

        // 2) Protokol
        Deployment memory d = DeployLib.deploy(
            deployer, deployer, IWETH9(TESTNET_WETH), INonfungiblePositionManager(npm), ISwapRouter02(router)
        );
        d.dca.setKeeper(deployer, true);
        if (keeper != address(0) && keeper != deployer) d.dca.setKeeper(keeper, true);
        vm.stopBroadcast();

        console.log("UniswapV3Factory", factory);
        console.log("PositionManager ", npm);
        console.log("SwapRouter02    ", router);
        console.log("QuoterV2        ", quoter);
        console.log("TokenFactory    ", address(d.factory));
        console.log("DCAVault        ", address(d.dca));

        string memory k = "testnet";
        vm.serializeString(k, "network", "testnet");
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeString(k, "rpcUrl", "https://rpc.testnet.chain.robinhood.com");
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeAddress(k, "tokenFactory", address(d.factory));
        vm.serializeAddress(k, "bondingCurve", address(d.curve));
        vm.serializeAddress(k, "graduator", address(d.graduator));
        vm.serializeAddress(k, "lpLocker", address(d.locker));
        vm.serializeAddress(k, "feeVault", address(d.feeVault));
        vm.serializeAddress(k, "dcaVault", address(d.dca));
        vm.serializeAddress(k, "weth", TESTNET_WETH);
        vm.serializeAddress(k, "uniV3Factory", factory);
        vm.serializeAddress(k, "uniPositionManager", npm);
        vm.serializeAddress(k, "uniSwapRouter02", router);
        vm.serializeAddress(k, "uniQuoterV2", quoter);
        // Ağa göre değişen curve parametreleri (wei, string: JS number hassasiyeti yetmez)
        vm.serializeString(k, "virtualEth", vm.toString(C.VIRTUAL_ETH));
        vm.serializeString(k, "graduationEth", vm.toString(C.GRADUATION_ETH));
        string memory json = vm.serializeString(k, "launchFee", vm.toString(C.LAUNCH_FEE));
        vm.writeJson(json, vm.envOr("DEPLOYMENT_OUT", string("../shared/deployments/testnet.json")));
    }
}
