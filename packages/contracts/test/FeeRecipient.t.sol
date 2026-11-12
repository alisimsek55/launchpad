// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseTest} from "./Base.t.sol";
import {Constants as C} from "../src/Constants.sol";
import {DCAVault} from "../src/DCAVault.sol";
import {FeeVault} from "../src/FeeVault.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {TokenFactory} from "../src/TokenFactory.sol";

/// payable receive'i olmayan bir sözleşme (ör. bazı multisig/kasa sözleşmeleri gibi).
contract NoReceiveCreator {
    function launch(TokenFactory factory) external payable returns (address) {
        return factory.createToken{value: msg.value}("Contract Token", "CTOK", "ipfs://meta", 0);
    }

    function claim(FeeVault vault) external returns (uint256) {
        return vault.claimCreatorFees();
    }

    function claimTo(FeeVault vault, address payable to) external returns (uint256) {
        return vault.claimCreatorFees(to);
    }

    function createPlan(DCAVault dca, address token) external payable returns (uint256) {
        return dca.createPlan{value: msg.value}(token, msg.value, 1 hours, 1, 0);
    }

    function cancel(DCAVault dca, uint256 id) external {
        dca.cancelPlan(id);
    }

    function cancelTo(DCAVault dca, uint256 id, address payable to) external {
        dca.cancelPlan(id, to);
    }
}

/// ETH çekimlerinde alıcı seçilebilmeli: creator fee'si (FeeVault) ve DCA plan iadesi (DCAVault).
contract FeeRecipientTest is BaseTest {
    NoReceiveCreator internal c;
    address payable internal treasuryOfC = payable(makeAddr("treasuryOfC"));

    function setUp() public override {
        super.setUp();
        c = new NoReceiveCreator();
        vm.deal(address(c), 10 ether);
    }

    function test_ContractCreatorClaimsToRecipient() public {
        LaunchToken t = LaunchToken(c.launch{value: C.LAUNCH_FEE}(d.factory));
        vm.warp(block.timestamp + C.SNIPER_WINDOW);
        _buy(alice, t, 1 ether);
        assertEq(d.feeVault.creatorBalance(address(c)), 0.005 ether);

        // Eski yol: msg.sender ETH alamıyor → revert
        vm.expectRevert();
        c.claim(d.feeVault);

        vm.expectRevert(FeeVault.ZeroAddress.selector);
        c.claimTo(d.feeVault, payable(address(0)));

        assertEq(c.claimTo(d.feeVault, treasuryOfC), 0.005 ether);
        assertEq(treasuryOfC.balance, 0.005 ether);
        assertEq(d.feeVault.creatorBalance(address(c)), 0);

        vm.expectRevert(FeeVault.NothingToClaim.selector);
        c.claimTo(d.feeVault, treasuryOfC);
    }

    /// Başkası bir creator'ın fee'sini kendi adresine çekemez (bakiye msg.sender'a göre).
    function test_RecipientClaimOnlyOwnBalance() public {
        LaunchToken t = _launchAndSettle();
        _buy(alice, t, 1 ether);
        vm.prank(bob);
        vm.expectRevert(FeeVault.NothingToClaim.selector);
        d.feeVault.claimCreatorFees(payable(bob));

        uint256 before = bob.balance;
        vm.prank(creator);
        d.feeVault.claimCreatorFees(payable(bob));
        assertEq(bob.balance - before, 0.005 ether);
    }

    function test_ContractPlanOwnerCancelsToRecipient() public {
        LaunchToken t = _launchAndSettle();
        uint256 id = c.createPlan{value: 0.3 ether}(d.dca, address(t));

        vm.expectRevert();
        c.cancel(d.dca, id);

        vm.expectRevert(DCAVault.ZeroAddress.selector);
        c.cancelTo(d.dca, id, payable(address(0)));

        vm.prank(alice);
        vm.expectRevert(DCAVault.NotOwner.selector);
        d.dca.cancelPlan(id, payable(alice));

        c.cancelTo(d.dca, id, treasuryOfC);
        assertEq(treasuryOfC.balance, 0.3 ether);
        assertEq(address(d.dca).balance, 0);
    }
}
