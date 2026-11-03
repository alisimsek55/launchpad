// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Constants} from "../src/Constants.sol";

contract ConstantsTest is Test {
    function test_SupplySplitAddsUp() public pure {
        assertEq(Constants.CURVE_SUPPLY + Constants.LP_SUPPLY, Constants.TOTAL_SUPPLY);
    }

    function test_FeeSplitAddsUp() public pure {
        assertEq(Constants.PROTOCOL_FEE_BPS + Constants.CREATOR_FEE_BPS, Constants.TRADE_FEE_BPS);
    }

    /// k sabit kalmalı: x0 * y0 == (x0 + E) * (y0 - T)
    function test_CurveInvariantHoldsAtGraduation() public pure {
        uint256 kStart = Constants.VIRTUAL_ETH * Constants.VIRTUAL_TOKEN;
        uint256 kEnd = (Constants.VIRTUAL_ETH + Constants.GRADUATION_ETH)
            * (Constants.VIRTUAL_TOKEN - Constants.CURVE_SUPPLY);
        assertApproxEqRel(kStart, kEnd, 1e6); // 1e-12 hassasiyet (y0 yuvarlaması)
    }

    /// Curve'ün son fiyatı Uniswap açılış fiyatına eşit olmalı:
    /// (x0 + E) / (y0 - T) == E / LP_SUPPLY
    function test_GraduationPriceMatchesPoolPrice() public pure {
        uint256 lhs = (Constants.VIRTUAL_ETH + Constants.GRADUATION_ETH) * Constants.LP_SUPPLY;
        uint256 rhs = Constants.GRADUATION_ETH * (Constants.VIRTUAL_TOKEN - Constants.CURVE_SUPPLY);
        assertApproxEqRel(lhs, rhs, 1e6);
    }

    function test_DevBuyCapIsFivePercent() public pure {
        assertEq(Constants.MAX_DEV_BUY * 20, Constants.TOTAL_SUPPLY);
    }
}
