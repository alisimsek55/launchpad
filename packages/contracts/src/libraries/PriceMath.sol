// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Constants} from "../Constants.sol";

library PriceMath {
    /// Graduation fiyatının (GRADUATION_ETH / LP_SUPPLY) Uniswap v3 sqrtPriceX96 karşılığı.
    /// v3 fiyatı her zaman token1/token0 cinsindendir; bu yüzden sonuç token sıralamasına bağlıdır.
    function targetSqrtPriceX96(bool tokenIsToken0) internal pure returns (uint160) {
        uint256 ratioX192 = tokenIsToken0
            ? Math.mulDiv(Constants.GRADUATION_ETH, 1 << 192, Constants.LP_SUPPLY)
            : Math.mulDiv(Constants.LP_SUPPLY, 1 << 192, Constants.GRADUATION_ETH);
        // forge-lint: disable-next-line(unsafe-typecast) -- ratio < 2^218 => sqrt < 2^109, uint160'a sığar
        return uint160(Math.sqrt(ratioX192));
    }

    /// Launch'tan bu yana geçen süreye göre alım fee'si: %20'den %1'e lineer düşüş (60 sn).
    function buyFeeBps(uint256 secondsSinceLaunch) internal pure returns (uint256) {
        if (secondsSinceLaunch >= Constants.SNIPER_WINDOW) return Constants.TRADE_FEE_BPS;
        uint256 range = Constants.SNIPER_FEE_START_BPS - Constants.TRADE_FEE_BPS;
        return Constants.SNIPER_FEE_START_BPS - (range * secondsSinceLaunch) / Constants.SNIPER_WINDOW;
    }
}
