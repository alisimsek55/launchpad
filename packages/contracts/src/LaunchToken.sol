// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Constants} from "./Constants.sol";

/// @notice Sade ERC-20: sabit arz, owner/mint/vergi yok.
/// Graduation'a kadar Uniswap pool adresine transfer engellenir; böylece kimse pool'a
/// erkenden token likiditesi ekleyip graduation fiyatını manipüle edemez.
contract LaunchToken is ERC20 {
    address public immutable factory;
    address public immutable curve;

    // Aynı slot'ta: her transferde tek SLOAD
    address public pool;
    bool public graduated;

    error OnlyFactory();
    error OnlyCurve();
    error PoolAlreadySet();
    error TransferToPoolBeforeGraduation();
    error ZeroAddress();

    constructor(string memory name_, string memory symbol_, address curve_) ERC20(name_, symbol_) {
        if (curve_ == address(0)) revert ZeroAddress();
        factory = msg.sender;
        curve = curve_;
        _mint(curve_, Constants.TOTAL_SUPPLY);
    }

    function setPool(address pool_) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (pool != address(0)) revert PoolAlreadySet();
        if (pool_ == address(0)) revert ZeroAddress();
        pool = pool_;
    }

    function markGraduated() external {
        if (msg.sender != curve) revert OnlyCurve();
        graduated = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!graduated && to == pool && to != address(0)) revert TransferToPoolBeforeGraduation();
        super._update(from, to, value);
    }
}
