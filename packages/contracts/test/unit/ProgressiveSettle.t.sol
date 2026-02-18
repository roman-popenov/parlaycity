// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LegRegistry} from "../../src/core/LegRegistry.sol";
import {ParlayEngine} from "../../src/core/ParlayEngine.sol";
import {AdminOracleAdapter} from "../../src/oracle/AdminOracleAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LegStatus} from "../../src/interfaces/IOracleAdapter.sol";

contract ProgressiveSettleTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LegRegistry registry;
    ParlayEngine engine;
    AdminOracleAdapter oracle;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant BOOTSTRAP_ENDS = 1_000_000;

    function setUp() public {
        vm.warp(500_000);

        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        registry = new LegRegistry();
        oracle = new AdminOracleAdapter();
        engine = new ParlayEngine(vault, registry, IERC20(address(usdc)), BOOTSTRAP_ENDS);

        vault.setEngine(address(engine));

        // Seed vault with liquidity
        usdc.mint(owner, 10_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000e6, owner);

        // Fund alice
        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        // Fund bob (for ownership tests)
        usdc.mint(bob, 1_000e6);
        vm.prank(bob);
        usdc.approve(address(engine), type(uint256).max);

        // Create legs: cutoff at ts=600_000, resolve at ts=700_000
        _createLeg("ETH > $5000?", 500_000); // leg 0: 50%
        _createLeg("BTC > $150k?", 250_000); // leg 1: 25%
        _createLeg("SOL > $300?", 200_000); // leg 2: 20%
    }

    function _createLeg(string memory question, uint256 probPPM) internal returns (uint256) {
        return registry.createLeg(question, "source", 600_000, 700_000, address(oracle), probPPM);
    }

    // Helper: buy a 2-leg progressive ticket (legs 0+1, 50%+25%) with 10 USDC stake
    function _buyProgressive2Leg() internal returns (uint256 ticketId) {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0; // 50%
        legs[1] = 1; // 25%

        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        ticketId = engine.buyTicketWithMode(legs, outcomes, 10e6, ParlayEngine.PayoutMode.PROGRESSIVE);
    }

    // Helper: buy a 3-leg progressive ticket (legs 0+1+2, 50%+25%+20%) with 10 USDC stake
    function _buyProgressive3Leg() internal returns (uint256 ticketId) {
        uint256[] memory legs = new uint256[](3);
        legs[0] = 0; // 50%
        legs[1] = 1; // 25%
        legs[2] = 2; // 20%

        bytes32[] memory outcomes = new bytes32[](3);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");
        outcomes[2] = keccak256("yes");

        vm.prank(alice);
        ticketId = engine.buyTicketWithMode(legs, outcomes, 10e6, ParlayEngine.PayoutMode.PROGRESSIVE);
    }

    // ── 1. Buy progressive ticket ──────────────────────────────────────────

    function test_buyTicketWithMode_progressive() public {
        uint256 ticketId = _buyProgressive2Leg();

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.payoutMode), uint8(ParlayEngine.PayoutMode.PROGRESSIVE));
        assertEq(t.claimedAmount, 0);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Active));
        assertEq(t.buyer, alice);
        assertEq(t.stake, 10e6);

        // Fee for 2 legs: baseFee(100bps) + perLegFee(50bps*2) = 200bps = 2%
        assertEq(t.feePaid, 200_000);
        // effectiveStake = 9_800_000, multiplier for 50%+25% = 8x
        // potentialPayout = 9_800_000 * 8_000_000 / 1_000_000 = 78_400_000
        assertEq(t.potentialPayout, 78_400_000);
    }

    // ── 2. Claim progressive after one won leg ─────────────────────────────

    function test_claimProgressive_afterOneWon() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        // 3-leg fee: 100 + 50*3 = 250 bps = 2.5%
        // feePaid = 10_000_000 * 250 / 10_000 = 250_000
        // effectiveStake = 9_750_000
        uint256 effectiveStake = tBefore.stake - tBefore.feePaid;
        assertEq(effectiveStake, 9_750_000);

        // Resolve leg 0 (50%) as Won
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // After leg 0 (50%) wins: partialMultiplier = 1e6 / 500_000 * 1e6 = 2_000_000
        // partialPayout = 9_750_000 * 2_000_000 / 1_000_000 = 19_500_000
        uint256 expectedPartial = 19_500_000;
        assertEq(usdc.balanceOf(alice), aliceBefore + expectedPartial);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(tAfter.claimedAmount, expectedPartial);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Active));
    }

    // ── 3. Claim progressive after two won legs ────────────────────────────

    function test_claimProgressive_afterTwoWon() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        uint256 effectiveStake = tBefore.stake - tBefore.feePaid;

        // Resolve leg 0 (50%) as Won, claim first
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 firstClaim = 19_500_000; // effectiveStake * 2x

        // Resolve leg 1 (25%) as Won, claim again
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // After legs 0+1 (50%+25%) won: multiplier = 1e6/500_000 * 1e6/250_000 = 2 * 4 = 8x
        // partialPayout = 9_750_000 * 8_000_000 / 1_000_000 = 78_000_000
        uint256 cumulativePayout = (effectiveStake * 8_000_000) / 1_000_000;
        uint256 secondClaim = cumulativePayout - firstClaim;

        assertEq(usdc.balanceOf(alice), aliceBefore + secondClaim);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(tAfter.claimedAmount, cumulativePayout);
    }

    // ── 4. All won, progressive claim, then settle + claimPayout remainder ─

    function test_claimProgressive_allWon_thenSettle() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        // Resolve leg 0, progressive claim
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 firstClaimed = engine.getTicket(ticketId).claimedAmount;

        // Resolve remaining legs
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        oracle.resolve(2, LegStatus.Won, keccak256("yes"));

        // Settle ticket (all legs resolved)
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tSettled = engine.getTicket(ticketId);
        assertEq(uint8(tSettled.status), uint8(ParlayEngine.TicketStatus.Won));

        // Claim remaining payout
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimPayout(ticketId);

        uint256 remaining = tSettled.potentialPayout - firstClaimed;
        assertEq(usdc.balanceOf(alice), aliceBefore + remaining);

        ParlayEngine.Ticket memory tFinal = engine.getTicket(ticketId);
        assertEq(uint8(tFinal.status), uint8(ParlayEngine.TicketStatus.Claimed));
    }

    // ── 5. Progressive claim detects loss ──────────────────────────────────

    function test_claimProgressive_detectsLoss() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        // Resolve leg 0 as Won, progressive claim
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claimed = engine.getTicket(ticketId).claimedAmount;
        uint256 reservedBefore = vault.totalReserved();

        // Resolve leg 1 as Lost
        oracle.resolve(1, LegStatus.Lost, keccak256("no"));

        vm.prank(alice);
        engine.claimProgressive(ticketId);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Lost));

        // Remaining reserve should have been released
        uint256 expectedRelease = tBefore.potentialPayout - claimed;
        assertEq(vault.totalReserved(), reservedBefore - expectedRelease);
    }

    // ── 6. Classic ticket can't use claimProgressive ───────────────────────

    function test_claimProgressive_notProgressive_reverts() public {
        // Buy classic ticket
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: not progressive");
        engine.claimProgressive(ticketId);
    }

    // ── 7. No won legs reverts ─────────────────────────────────────────────

    function test_claimProgressive_noWonLegs_reverts() public {
        uint256 ticketId = _buyProgressive3Leg();

        // No legs resolved yet
        vm.prank(alice);
        vm.expectRevert("ParlayEngine: no won legs to claim");
        engine.claimProgressive(ticketId);
    }

    // ── 8. Not owner reverts ───────────────────────────────────────────────

    function test_claimProgressive_notOwner_reverts() public {
        uint256 ticketId = _buyProgressive3Leg();

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));

        vm.prank(bob);
        vm.expectRevert("ParlayEngine: not ticket owner");
        engine.claimProgressive(ticketId);
    }

    // ── 9. Nothing new to claim reverts ────────────────────────────────────

    function test_claimProgressive_nothingNew_reverts() public {
        uint256 ticketId = _buyProgressive3Leg();

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));

        // First claim succeeds
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // Second call with same state reverts
        vm.prank(alice);
        vm.expectRevert("ParlayEngine: nothing to claim");
        engine.claimProgressive(ticketId);
    }

    // ── 10. Classic tickets still work (regression) ────────────────────────

    function test_classicTicket_settleAndClaim_unchanged() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.payoutMode), uint8(ParlayEngine.PayoutMode.CLASSIC));
        assertEq(t.claimedAmount, 0);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tSettled = engine.getTicket(ticketId);
        assertEq(uint8(tSettled.status), uint8(ParlayEngine.TicketStatus.Won));

        uint256 expectedPayout = tSettled.potentialPayout;
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimPayout(ticketId);

        assertEq(usdc.balanceOf(alice), aliceBefore + expectedPayout);
        ParlayEngine.Ticket memory tClaimed = engine.getTicket(ticketId);
        assertEq(uint8(tClaimed.status), uint8(ParlayEngine.TicketStatus.Claimed));
    }

    // ── 11. Progressive settleTicket loss releases remaining reserve ───────

    function test_progressive_settleTicket_loss_releasesRemaining() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        // Progressive claim after leg 0 wins
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claimed = engine.getTicket(ticketId).claimedAmount;

        // Resolve remaining: leg 1 wins, leg 2 loses
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        oracle.resolve(2, LegStatus.Lost, keccak256("no"));

        uint256 reservedBefore = vault.totalReserved();

        // settleTicket (all resolved, one lost)
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Lost));

        // Should release exactly potentialPayout - claimedAmount
        uint256 expectedRelease = tBefore.potentialPayout - claimed;
        assertEq(vault.totalReserved(), reservedBefore - expectedRelease);
    }

    // ── 12. Vault accounting throughout progressive lifecycle ──────────────

    function test_progressive_vaultAccounting() public {
        uint256 vaultReservedStart = vault.totalReserved();
        assertEq(vaultReservedStart, 0);

        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 potentialPayout = t.potentialPayout;

        // After buy: totalReserved == potentialPayout
        assertEq(vault.totalReserved(), potentialPayout);

        // Resolve leg 0, progressive claim
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claim1 = engine.getTicket(ticketId).claimedAmount;

        // vault.payWinner decreases totalReserved
        assertEq(vault.totalReserved(), potentialPayout - claim1);

        // Resolve leg 1, progressive claim
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claim2 = engine.getTicket(ticketId).claimedAmount;
        assertEq(vault.totalReserved(), potentialPayout - claim2);

        // Resolve leg 2, settle
        oracle.resolve(2, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        // After settlement (Won), remaining reserve stays until claimPayout
        assertEq(vault.totalReserved(), potentialPayout - claim2);

        // Final claim
        vm.prank(alice);
        engine.claimPayout(ticketId);

        // All reserves released
        assertEq(vault.totalReserved(), 0);
    }
}
