// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @notice Ağa göre değişen ETH miktarları — MAINNET (varsayılan Foundry profili).
/// Diğer tüm parametreler (arz, oranlar, fee yüzdeleri) Constants.sol'da ve ağdan bağımsız.
library CurveParams {
    uint256 internal constant VIRTUAL_ETH = 1.4 ether;
    uint256 internal constant GRADUATION_ETH = 4.2 ether;
    uint256 internal constant LAUNCH_FEE = 0.0005 ether;
}
