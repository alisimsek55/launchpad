// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RobinhoodMainnet as RH, Constants} from "../src/Constants.sol";

interface IPeriphery {
    function factory() external view returns (address);
    function WETH9() external view returns (address);
}

interface IUniV3Factory {
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);
}

/// Mainnet fork testi: adreslerin zincirdeki gerçek kontratlarla eşleştiğini doğrular.

contract AddressesForkTest is Test {
    function setUp() public {
        vm.createSelectFork("robinhood", 105_259_296);
    }

    function test_ChainId() public view {
        assertEq(block.chainid, RH.CHAIN_ID);
    }

    function test_PositionManagerWiring() public view {
        assertEq(IPeriphery(RH.UNI_V3_POSITION_MANAGER).factory(), RH.UNI_V3_FACTORY);
        assertEq(IPeriphery(RH.UNI_V3_POSITION_MANAGER).WETH9(), RH.WETH);
    }

    function test_SwapRouterWiring() public view {
        assertEq(IPeriphery(RH.UNI_SWAP_ROUTER_02).factory(), RH.UNI_V3_FACTORY);
        assertEq(IPeriphery(RH.UNI_SWAP_ROUTER_02).WETH9(), RH.WETH);
    }

    function test_OnePercentFeeTierEnabled() public view {
        assertEq(
            IUniV3Factory(RH.UNI_V3_FACTORY).feeAmountTickSpacing(Constants.UNI_FEE_TIER), Constants.UNI_TICK_SPACING
        );
    }
}
