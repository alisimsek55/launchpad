// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Ağa göre değişen ETH miktarları — TESTNET (`FOUNDRY_PROFILE=testnet`).
/// Faucet günde 0.01 test ETH verdiği için ETH miktarları mainnet'in 1/1000'i: graduation
/// tek bir faucet isteğiyle bile görülebilsin. Oranlar aynı olduğu için fiyat eğrisinin şekli,
/// fee yüzdeleri ve sniper koruması mainnet ile birebir aynıdır.
library CurveParams {
    uint256 internal constant VIRTUAL_ETH = 0.0014 ether;
    uint256 internal constant GRADUATION_ETH = 0.0042 ether;
    uint256 internal constant LAUNCH_FEE = 0.0000005 ether;
}
