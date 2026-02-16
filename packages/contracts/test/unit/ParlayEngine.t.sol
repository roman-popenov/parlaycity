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

contract ParlayEngineTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LegRegistry registry;
    ParlayEngine engine;
    AdminOracleAdapter oracle;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant BOOTSTRAP_ENDS = 1_000_000; // timestamp

    function setUp() public {
        // Set block.timestamp before bootstrapEndsAt to test FAST mode
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

        // Create legs: cutoff at ts=600_000, resolve at ts=700_000
        _createLeg("ETH > $5000?", 500_000); // 50%
        _createLeg("BTC > $150k?", 250_000); // 25%
        _createLeg("SOL > $300?", 200_000); // 20%
        _createLeg("DOGE > $1?", 100_000); // 10%
        _createLeg("AVAX > $100?", 333_333); // ~33%
        _createLeg("Extra leg", 500_000); // 50% - legId 5
    }

    function _createLeg(string memory question, uint256 probPPM) internal returns (uint256) {
        return registry.createLeg(question, "source", 600_000, 700_000, address(oracle), probPPM);
    }

    // ── Buy Ticket Happy Path ────────────────────────────────────────────

    function test_buyTicket_happyPath() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0; // 50%
        legs[1] = 1; // 25%

        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(t.buyer, alice);
        assertEq(t.stake, 10e6);
        assertEq(t.legIds.length, 2);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Active));
        assertGt(t.potentialPayout, 0);
        assertGt(t.multiplierX1e6, 0);
        assertGt(t.feePaid, 0);

        // Should be FAST mode (timestamp < bootstrapEndsAt)
        assertEq(uint8(t.mode), uint8(ParlayEngine.SettlementMode.FAST));

        // Ticket should be an NFT owned by alice
        assertEq(engine.ownerOf(ticketId), alice);
    }

    function test_buyTicket_optimisticMode() public {
        // Warp past bootstrap
        vm.warp(BOOTSTRAP_ENDS + 1);

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        // Need to re-create legs since cutoff must be in the future
        uint256 leg0 = registry.createLeg("Q1", "s", block.timestamp + 1000, block.timestamp + 2000, address(oracle), 500_000);
        uint256 leg1 = registry.createLeg("Q2", "s", block.timestamp + 1000, block.timestamp + 2000, address(oracle), 250_000);

        uint256[] memory newLegs = new uint256[](2);
        newLegs[0] = leg0;
        newLegs[1] = leg1;

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(newLegs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.mode), uint8(ParlayEngine.SettlementMode.OPTIMISTIC));
    }

    // ── Validations ──────────────────────────────────────────────────────

    function test_buyTicket_revertsOnSingleLeg() public {
        uint256[] memory legs = new uint256[](1);
        legs[0] = 0;
        bytes32[] memory outcomes = new bytes32[](1);
        outcomes[0] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: need >= 2 legs");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    function test_buyTicket_revertsOnTooManyLegs() public {
        uint256[] memory legs = new uint256[](6);
        bytes32[] memory outcomes = new bytes32[](6);
        for (uint256 i = 0; i < 6; i++) {
            legs[i] = i;
            outcomes[i] = keccak256("yes");
        }

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: too many legs");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    function test_buyTicket_revertsOnDuplicateLegs() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 0; // duplicate

        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: duplicate leg");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    function test_buyTicket_revertsOnCutoffPassed() public {
        vm.warp(600_001); // past cutoff

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: cutoff passed");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    function test_buyTicket_revertsOnInsufficientStake() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: stake too low");
        engine.buyTicket(legs, outcomes, 0.5e6); // less than 1 USDC
    }

    function test_buyTicket_revertsOnLengthMismatch() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](3);

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: length mismatch");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    // ── Settlement ───────────────────────────────────────────────────────

    function test_settleTicket_allWins() public {
        // Buy ticket
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        // Resolve legs as Won
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));

        // Settle
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Won));
    }

    function test_settleTicket_withLoss() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);
        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);
        uint256 reservedBefore = vault.totalReserved();

        // One leg lost
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Lost, keccak256("no"));

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Lost));
        // Reservation should have been released
        assertEq(vault.totalReserved(), reservedBefore - tBefore.potentialPayout);
    }

    // ── Claim ────────────────────────────────────────────────────────────

    function test_claimPayout() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 expectedPayout = t.potentialPayout;

        uint256 aliceBalBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimPayout(ticketId);

        assertEq(usdc.balanceOf(alice), aliceBalBefore + expectedPayout);
        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Claimed));
    }

    function test_claimPayout_revertsIfNotWon() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: not won");
        engine.claimPayout(ticketId);
    }

    function test_claimPayout_revertsIfNotOwner() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        vm.prank(bob);
        vm.expectRevert("ParlayEngine: not ticket owner");
        engine.claimPayout(ticketId);
    }

    // ── Deactivated Leg ──────────────────────────────────────────────────

    function test_buyTicket_revertsOnDeactivatedLeg() public {
        registry.deactivateLeg(0);

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert("ParlayEngine: leg not active");
        engine.buyTicket(legs, outcomes, 10e6);
    }

    // ── Extended Tests (Phase 4) ──────────────────────────────────────────

    function test_settleTicket_partialVoid() public {
        // 3 legs: 2 won, 1 voided
        uint256[] memory legs = new uint256[](3);
        legs[0] = 0;
        legs[1] = 1;
        legs[2] = 2;
        bytes32[] memory outcomes = new bytes32[](3);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");
        outcomes[2] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);
        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        oracle.resolve(2, LegStatus.Voided, bytes32(0));

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Won));
        assertTrue(t.potentialPayout <= tBefore.potentialPayout, "recalculated payout <= original");
    }

    function test_settleTicket_allVoided_ticketVoided() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Voided, bytes32(0));
        oracle.resolve(1, LegStatus.Voided, bytes32(0));

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Voided));
        assertEq(vault.totalReserved(), 0);
    }

    function test_settleTicket_alreadySettled_reverts() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Lost, keccak256("no"));

        engine.settleTicket(ticketId);
        vm.expectRevert("ParlayEngine: not active");
        engine.settleTicket(ticketId);
    }

    function test_buyTicket_feeCalculation() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        // baseFee=100bps + perLegFee=50bps*2 = 200bps = 2%
        // feePaid = 2% of 10 USDC = 0.2 USDC = 200000
        assertEq(t.feePaid, 200_000);
    }

    function test_buyTicket_pauseBlocksBuy() public {
        engine.pause();

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        vm.expectRevert();
        engine.buyTicket(legs, outcomes, 10e6);
    }

    function test_setBaseFee_boundsCheck() public {
        engine.setBaseFee(2000);
        assertEq(engine.baseFee(), 2000);

        vm.expectRevert("ParlayEngine: baseFee too high");
        engine.setBaseFee(2001);
    }

    function test_setPerLegFee_boundsCheck() public {
        engine.setPerLegFee(500);
        assertEq(engine.perLegFee(), 500);

        vm.expectRevert("ParlayEngine: perLegFee too high");
        engine.setPerLegFee(501);
    }

    function test_setMinStake_boundsCheck() public {
        engine.setMinStake(5e6);
        assertEq(engine.minStake(), 5e6);

        vm.expectRevert("ParlayEngine: minStake too low");
        engine.setMinStake(0.5e6);
    }

    function test_setMaxLegs_boundsCheck() public {
        engine.setMaxLegs(10);
        assertEq(engine.maxLegs(), 10);

        vm.expectRevert("ParlayEngine: invalid maxLegs");
        engine.setMaxLegs(11);

        vm.expectRevert("ParlayEngine: invalid maxLegs");
        engine.setMaxLegs(1);
    }
}
