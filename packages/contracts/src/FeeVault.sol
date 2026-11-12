// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Protokol ve creator fee'lerinin biriktiği kasa. Pull pattern: sahipleri kendileri çeker.
contract FeeVault is Ownable2Step, ReentrancyGuard {
    uint256 public protocolBalance;
    mapping(address creator => uint256) public creatorBalance;

    event FeesDeposited(address indexed creator, uint256 protocolAmount, uint256 creatorAmount);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    error AmountMismatch();
    error NothingToClaim();
    error InsufficientBalance();
    error ZeroAddress();

    constructor(address owner_) Ownable(owner_) {}

    /// Herkes yatırabilir (zararsız). creator == address(0) ise tamamı protokole yazılır.
    function depositFees(address creator, uint256 protocolAmount, uint256 creatorAmount) external payable {
        if (msg.value != protocolAmount + creatorAmount) revert AmountMismatch();
        if (creator == address(0)) {
            protocolBalance += msg.value;
        } else {
            protocolBalance += protocolAmount;
            creatorBalance[creator] += creatorAmount;
        }
        emit FeesDeposited(creator, protocolAmount, creatorAmount);
    }

    /// Fee'yi çağırana (creator) öder. Creator, payable receive'i olmayan bir sözleşmeyse
    /// `claimCreatorFees(recipient)` kullanmalıdır.
    function claimCreatorFees() external returns (uint256 amount) {
        return _claimCreatorFees(payable(msg.sender));
    }

    /// Creator'ın biriken fee'sini kendi seçtiği alıcıya gönderir (ör. ETH alamayan creator sözleşmeleri için).
    function claimCreatorFees(address payable recipient) external returns (uint256 amount) {
        if (recipient == address(0)) revert ZeroAddress();
        return _claimCreatorFees(recipient);
    }

    function _claimCreatorFees(address payable recipient) private nonReentrant returns (uint256 amount) {
        amount = creatorBalance[msg.sender];
        if (amount == 0) revert NothingToClaim();
        creatorBalance[msg.sender] = 0;
        // Event imzası değişmedi (indexer/subgraph uyumu): creator = msg.sender.
        emit CreatorFeesClaimed(msg.sender, amount);
        // forge-lint: disable-next-line(arbitrary-send-eth) -- creator yalnızca kendi bakiyesini kendi seçtiği adrese çeker
        Address.sendValue(recipient, amount);
    }

    function withdrawProtocolFees(address payable to, uint256 amount) external nonReentrant onlyOwner {
        if (amount > protocolBalance) revert InsufficientBalance();
        protocolBalance -= amount;
        emit ProtocolFeesWithdrawn(to, amount);
        // forge-lint: disable-next-line(arbitrary-send-eth) -- sadece owner (multisig), kendi seçtiği adrese
        Address.sendValue(to, amount);
    }
}
