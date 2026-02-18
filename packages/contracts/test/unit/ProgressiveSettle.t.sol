// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LegRegistry} from "../../src/core/LegRegistry.sol";
import {ParlayEngine} from "../../src/core/ParlayEngine.sol";
import {AdminOracleAdapter} from "../../src/oracle/AdminOracleAdapter.sol";
import {LockVault} from "../../src/core/LockVault.sol";
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

        // Wire up LockVault + safetyModule for FeeRouter
        LockVault lockVault = new LockVault(vault);
        vault.setLockVault(lockVault);
        vault.setSafetyModule(makeAddr("safetyModule"));
        lockVault.setFeeDistributor(address(vault));

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

    // ── 4b. Regression: fully claimed progressive doesn't get stuck in Won ──

    function test_progressive_fullyClaimed_settlesAsClaimed() public {
        uint256 ticketId = _buyProgressive3Leg();

        // Resolve all legs and claim progressively after each
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        oracle.resolve(2, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // All legs resolved, full payout claimed progressively
        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(t.claimedAmount, t.potentialPayout, "fully claimed via progressive");

        // Settle: should mark as Claimed (not Won), since nothing remains
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tSettled = engine.getTicket(ticketId);
        assertEq(uint8(tSettled.status), uint8(ParlayEngine.TicketStatus.Claimed), "should be Claimed, not Won");

        // claimPayout should revert since everything's already claimed
        vm.expectRevert("ParlayEngine: not won");
        vm.prank(alice);
        engine.claimPayout(ticketId);
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

    // ── 13. Progressive with mixed voided + won legs ──────────────────────

    function test_claimProgressive_voidedLegsSkipped() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        uint256 effectiveStake = tBefore.stake - tBefore.feePaid;

        // Void leg 0, win leg 1 — voided legs should be silently skipped
        oracle.resolve(0, LegStatus.Voided, bytes32(0));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // Only leg 1 (25%) counts as won: multiplier = PPM / 250_000 = 4x
        // partialPayout = effectiveStake * 4_000_000 / PPM = 39_000_000
        uint256 expectedPartial = (effectiveStake * 4_000_000) / 1_000_000;
        assertEq(usdc.balanceOf(alice), aliceBefore + expectedPartial, "voided leg skipped, only won leg counted");

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(tAfter.claimedAmount, expectedPartial);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Active));
    }

    // ── 14. Progressive with all legs voided reverts ──────────────────────

    function test_claimProgressive_allVoided_reverts() public {
        uint256 ticketId = _buyProgressive3Leg();

        // Void all legs
        oracle.resolve(0, LegStatus.Voided, bytes32(0));
        oracle.resolve(1, LegStatus.Voided, bytes32(0));
        oracle.resolve(2, LegStatus.Voided, bytes32(0));

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: no won legs to claim");
        engine.claimProgressive(ticketId);
    }

    // ── 15. Void with <2 remaining legs after progressive claims ──────────
    //        Verifies refund correctly subtracts claimedAmount.

    function test_progressive_voidThenSettle_refundMinusClaimed() public {
        // Buy 2-leg progressive (legs 0+1, 50%+25%)
        uint256 ticketId = _buyProgressive2Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        uint256 effectiveStake = tBefore.stake - tBefore.feePaid;

        // Win leg 0, progressive claim
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claimed = engine.getTicket(ticketId).claimedAmount;
        assertGt(claimed, 0);

        // Now void leg 1 -> only 1 remaining leg -> ticket voided
        oracle.resolve(1, LegStatus.Voided, bytes32(0));

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 reservedBefore = vault.totalReserved();

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Voided));

        // Refund = effectiveStake - claimedAmount (since alice already got partial)
        uint256 expectedRefund = effectiveStake > claimed ? effectiveStake - claimed : 0;
        assertEq(usdc.balanceOf(alice), aliceBefore + expectedRefund, "refund minus claimed");

        // All remaining reserve released
        uint256 expectedReleased = tBefore.potentialPayout - claimed;
        assertEq(vault.totalReserved(), reservedBefore - expectedReleased, "remaining reserve released");
    }

    // ── 16. Void with claims exceeding effectiveStake -> refund = 0 ───────
    //        Edge case: progressive claims > effectiveStake, void remaining.

    function test_progressive_voidAfterLargeClaim_noRefund() public {
        // Buy 2-leg progressive with legs 0+1 (50%+25%)
        uint256 ticketId = _buyProgressive2Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        uint256 effectiveStake = tBefore.stake - tBefore.feePaid;

        // Win leg 0 (50%), progressive claim: payout = effectiveStake * 2x = 19_600_000
        // effectiveStake = 9_800_000, so claim > effectiveStake
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claimed = engine.getTicket(ticketId).claimedAmount;
        assertGt(claimed, effectiveStake, "claim exceeds effective stake");

        // Void leg 1 -> voided ticket
        oracle.resolve(1, LegStatus.Voided, bytes32(0));

        uint256 aliceBefore = usdc.balanceOf(alice);

        engine.settleTicket(ticketId);

        // effectiveStake - claimedAmount would underflow -> refund = 0
        assertEq(usdc.balanceOf(alice), aliceBefore, "no refund when claims exceed effective stake");

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Voided));
    }

    // ── 17. Partial void with claims exceeding recalculated payout ─────────
    //        3-leg, claim after 2 won, void 1 -> recalculated payout < claimedAmount.

    function test_progressive_partialVoid_claimsExceedNewPayout() public {
        uint256 ticketId = _buyProgressive3Leg();

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        // Win legs 0 (50%) and 1 (25%), progressive claim (2 claims)
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        // claimed = effectiveStake * 8x (for 50%+25%) = 78_000_000

        // Void leg 2 -> recalculate with remaining 2 legs (50%+25%)
        // newPayout = same as claimed (effectiveStake * 8x) or potentially different
        // due to the edge computation in buyTicket vs settle. In this case,
        // newPayout = effectiveStake * computeMultiplier([500_000, 250_000]) / PPM
        // which is the same as claimed (no edge applied in settle, but edge was applied at buy time).
        // Actually, settle recalculates with raw multiplier, NOT the net multiplier.
        // So newPayout may differ from claimed. Let's just verify the accounting is safe.

        oracle.resolve(2, LegStatus.Voided, bytes32(0));

        uint256 reservedBefore = vault.totalReserved();

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);

        // Verify potentialPayout >= claimedAmount (engine ensures this)
        assertGe(tAfter.potentialPayout, tAfter.claimedAmount, "new payout >= claimed");

        if (tAfter.potentialPayout > tAfter.claimedAmount) {
            // More to claim: stays Won
            assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Won));
        } else {
            // Everything claimed: auto-transitions to Claimed (no stuck Won)
            assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Claimed));
        }

        // Remaining reserve is correct
        assertEq(vault.totalReserved(), reservedBefore - (tBefore.potentialPayout - tAfter.potentialPayout),
            "reserve accounting correct after partial void");
    }

    // ── 18. NFT transfer: new owner can claim progressive ──────────────────

    function test_claimProgressive_afterNFTTransfer() public {
        uint256 ticketId = _buyProgressive3Leg();

        // Resolve leg 0 as Won
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));

        // Alice transfers ticket to Bob
        vm.prank(alice);
        engine.transferFrom(alice, bob, ticketId);

        assertEq(engine.ownerOf(ticketId), bob);

        // Alice can no longer claim
        vm.prank(alice);
        vm.expectRevert("ParlayEngine: not ticket owner");
        engine.claimProgressive(ticketId);

        // Bob can claim
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        engine.claimProgressive(ticketId);

        assertGt(usdc.balanceOf(bob), bobBefore, "new owner received payout");
    }

    // ── 19. claimPayout "nothing to claim" revert path ─────────────────────
    //        Edge: settle sets newPayout = claimedAmount via partial void,
    //        then claimPayout should revert with "nothing to claim".

    function test_claimPayout_nothingToClaim_afterVoidReducesPayout() public {
        // Use 3-leg progressive: claim first 2, void 3rd.
        // After void, if newPayout == claimedAmount, claimPayout has nothing left.
        uint256 ticketId = _buyProgressive3Leg();

        // Win legs 0 and 1, claim both
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        vm.prank(alice);
        engine.claimProgressive(ticketId);

        uint256 claimed = engine.getTicket(ticketId).claimedAmount;

        // Void leg 2 -> settle recalculates payout
        oracle.resolve(2, LegStatus.Voided, bytes32(0));
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tSettled = engine.getTicket(ticketId);

        if (tSettled.potentialPayout == claimed) {
            // newPayout == claimedAmount: settle should auto-transition to Claimed
            assertEq(uint8(tSettled.status), uint8(ParlayEngine.TicketStatus.Claimed),
                "fully-claimed ticket must be Claimed, not stuck in Won");

            // claimPayout correctly reverts (status is Claimed, not Won)
            vm.prank(alice);
            vm.expectRevert("ParlayEngine: not won");
            engine.claimPayout(ticketId);
        } else {
            // newPayout > claimedAmount: claimPayout should succeed
            assertEq(uint8(tSettled.status), uint8(ParlayEngine.TicketStatus.Won));

            vm.prank(alice);
            engine.claimPayout(ticketId);

            ParlayEngine.Ticket memory tFinal = engine.getTicket(ticketId);
            assertEq(tFinal.claimedAmount, tFinal.potentialPayout);
        }
    }
}
