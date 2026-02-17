// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {OptimisticOracleAdapter} from "../../src/oracle/OptimisticOracleAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LegStatus} from "../../src/interfaces/IOracleAdapter.sol";

contract OptimisticOracleTest is Test {
    MockUSDC usdc;
    OptimisticOracleAdapter oracle;

    address owner = address(this);
    address proposer = makeAddr("proposer");
    address challenger = makeAddr("challenger");

    uint256 constant LIVENESS = 1800; // 30 min
    uint256 constant BOND = 10e6; // 10 USDC

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new OptimisticOracleAdapter(IERC20(address(usdc)), LIVENESS, BOND);

        usdc.mint(proposer, 1000e6);
        usdc.mint(challenger, 1000e6);

        vm.prank(proposer);
        usdc.approve(address(oracle), type(uint256).max);
        vm.prank(challenger);
        usdc.approve(address(oracle), type(uint256).max);
    }

    // ── Propose ──────────────────────────────────────────────────────────

    function test_propose() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        (,,,,OptimisticOracleAdapter.ProposalState state,,,,) = oracle.proposals(1);
        assertEq(uint8(state), uint8(OptimisticOracleAdapter.ProposalState.Proposed));

        // Bond should have been taken
        assertEq(usdc.balanceOf(proposer), 990e6);

        // Not yet finalized
        assertFalse(oracle.canResolve(1));
    }

    function test_propose_revertsIfAlreadyProposed() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.prank(proposer);
        vm.expectRevert("OptimisticOracle: proposal exists");
        oracle.propose(1, LegStatus.Lost, keccak256("no"));
    }

    function test_propose_revertsOnUnresolved() public {
        vm.prank(proposer);
        vm.expectRevert("OptimisticOracle: cannot propose Unresolved");
        oracle.propose(1, LegStatus.Unresolved, bytes32(0));
    }

    // ── Finalize ─────────────────────────────────────────────────────────

    function test_finalize_afterLiveness() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        // Advance past liveness
        vm.warp(block.timestamp + LIVENESS);

        oracle.finalize(1);

        assertTrue(oracle.canResolve(1));
        (LegStatus status, bytes32 outcome) = oracle.getStatus(1);
        assertEq(uint8(status), uint8(LegStatus.Won));
        assertEq(outcome, keccak256("yes"));

        // Bond returned to proposer
        assertEq(usdc.balanceOf(proposer), 1000e6);
    }

    function test_finalize_revertsBeforeLiveness() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.warp(block.timestamp + LIVENESS - 1);

        vm.expectRevert("OptimisticOracle: liveness not expired");
        oracle.finalize(1);
    }

    // ── Challenge ────────────────────────────────────────────────────────

    function test_challenge() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.prank(challenger);
        oracle.challenge(1);

        (,,,,OptimisticOracleAdapter.ProposalState state, address ch,,,) = oracle.proposals(1);
        assertEq(uint8(state), uint8(OptimisticOracleAdapter.ProposalState.Challenged));
        assertEq(ch, challenger);

        // Both bonds in contract
        assertEq(usdc.balanceOf(address(oracle)), 2 * BOND);
    }

    function test_challenge_revertsAfterLiveness() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.warp(block.timestamp + LIVENESS);

        vm.prank(challenger);
        vm.expectRevert("OptimisticOracle: liveness expired");
        oracle.challenge(1);
    }

    function test_challenge_cannotSelfChallenge() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.prank(proposer);
        vm.expectRevert("OptimisticOracle: cannot self-challenge");
        oracle.challenge(1);
    }

    // ── Dispute Resolution ───────────────────────────────────────────────

    function test_resolveDispute_proposerCorrect() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.prank(challenger);
        oracle.challenge(1);

        // Owner sides with proposer
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);

        assertTrue(oracle.canResolve(1));
        (LegStatus status,) = oracle.getStatus(1);
        assertEq(uint8(status), uint8(LegStatus.Won));

        // Proposer gets both bonds
        assertEq(usdc.balanceOf(proposer), 990e6 + 2 * BOND); // 990 + 20 = 1010
        // Challenger lost their bond
        assertEq(usdc.balanceOf(challenger), 990e6); // started 1000, bonded 10
    }

    function test_resolveDispute_challengerCorrect() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.prank(challenger);
        oracle.challenge(1);

        // Owner sides with challenger
        oracle.resolveDispute(1, LegStatus.Lost, keccak256("no"), false);

        (LegStatus status,) = oracle.getStatus(1);
        assertEq(uint8(status), uint8(LegStatus.Lost));

        // Challenger gets both bonds
        assertEq(usdc.balanceOf(challenger), 990e6 + 2 * BOND); // 1010
        // Proposer lost their bond
        assertEq(usdc.balanceOf(proposer), 990e6);
    }

    function test_resolveDispute_revertsIfNotChallenged() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.expectRevert("OptimisticOracle: not challenged");
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);
    }

    function test_resolveDispute_onlyOwner() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.prank(challenger);
        oracle.challenge(1);

        vm.prank(proposer);
        vm.expectRevert();
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);
    }

    // ── Slashing ─────────────────────────────────────────────────────────

    function test_bondSnapshot_usesOriginalBond() public {
        // Propose with bond=10
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        // Owner changes bond after proposal
        oracle.setBondAmount(50e6);

        // Challenge pays the proposer's snapshotted bond (10), not the current global (50)
        vm.prank(challenger);
        oracle.challenge(1);

        // Challenger should have paid 10 USDC (proposer's bond), not 50
        assertEq(usdc.balanceOf(challenger), 990e6);

        // Owner resolves: proposer wins -> gets proposerBond + challengerBond = 10 + 10 = 20
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);
        assertEq(usdc.balanceOf(proposer), 990e6 + 10e6 + 10e6); // 1010
    }

    function test_challenge_bondMatchesProposerAfterIncrease() public {
        // Propose with bond=10
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        // Admin raises bond to 50
        oracle.setBondAmount(50e6);

        // Challenger still pays 10 (snapshotted), contract holds exactly 20
        vm.prank(challenger);
        oracle.challenge(1);
        assertEq(usdc.balanceOf(address(oracle)), 20e6);

        // Challenger wins — gets full 20 (no stuck funds)
        oracle.resolveDispute(1, LegStatus.Lost, keccak256("no"), false);
        assertEq(usdc.balanceOf(challenger), 990e6 + 20e6); // 1010
        assertEq(usdc.balanceOf(address(oracle)), 0);
    }

    function test_challenge_bondMatchesProposerAfterDecrease() public {
        // Propose with bond=10
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        // Admin lowers bond to 1
        oracle.setBondAmount(1e6);

        // Challenger still pays 10 (snapshotted from proposer), not 1
        vm.prank(challenger);
        oracle.challenge(1);
        assertEq(usdc.balanceOf(challenger), 990e6);
        assertEq(usdc.balanceOf(address(oracle)), 20e6);

        // Proposer wins — gets exact 20 (no shortfall)
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);
        assertEq(usdc.balanceOf(proposer), 990e6 + 20e6); // 1010
        assertEq(usdc.balanceOf(address(oracle)), 0);
    }

    function test_bondSnapshot_finalizeReturnsOriginalBond() public {
        vm.prank(proposer);
        oracle.propose(2, LegStatus.Won, keccak256("yes"));

        // Owner changes bond
        oracle.setBondAmount(100e6);

        vm.warp(block.timestamp + LIVENESS);
        oracle.finalize(2);

        // Proposer gets back their original 10 USDC bond
        assertEq(usdc.balanceOf(proposer), 1000e6);
    }

    // ── Slashing ─────────────────────────────────────────────────────────

    function test_livenessSnapshot_usesOriginalWindow() public {
        vm.prank(proposer);
        oracle.propose(3, LegStatus.Won, keccak256("yes"));

        // Shorten liveness window after proposal
        oracle.setLivenessWindow(60); // 1 minute instead of 30 min

        // Advance 2 minutes — past new global window but before original 30 min
        vm.warp(block.timestamp + 120);

        // Should NOT be finalizable yet (proposal was made under 30 min window)
        vm.expectRevert("OptimisticOracle: liveness not expired");
        oracle.finalize(3);

        // Challenge should still be possible (within original 30 min window)
        vm.prank(challenger);
        oracle.challenge(3);
    }

    function test_slashing_loserBondGoesToWinner() public {
        uint256 proposerBefore = usdc.balanceOf(proposer);
        uint256 challengerBefore = usdc.balanceOf(challenger);

        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.prank(challenger);
        oracle.challenge(1);

        // Proposer wins
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);

        uint256 proposerAfter = usdc.balanceOf(proposer);
        uint256 challengerAfter = usdc.balanceOf(challenger);

        // Proposer net gain = +BOND (they get their bond back + challenger's bond)
        assertEq(proposerAfter, proposerBefore + BOND);
        // Challenger net loss = -BOND
        assertEq(challengerAfter, challengerBefore - BOND);
    }

    // ── Edge Cases ────────────────────────────────────────────────────────

    function test_finalize_alreadyFinalized_reverts() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));

        vm.warp(block.timestamp + LIVENESS);
        oracle.finalize(1);

        // Second finalize should revert (state is now Finalized, not Proposed)
        vm.expectRevert("OptimisticOracle: not proposed");
        oracle.finalize(1);
    }

    function test_challenge_nonExistentProposal_reverts() public {
        // No proposal made for legId 99
        vm.prank(challenger);
        vm.expectRevert("OptimisticOracle: not proposed");
        oracle.challenge(99);
    }

    function test_resolveDispute_alreadyResolved_reverts() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.prank(challenger);
        oracle.challenge(1);

        // Resolve once
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);

        // Resolve again — state is Finalized, not Challenged
        vm.expectRevert("OptimisticOracle: not challenged");
        oracle.resolveDispute(1, LegStatus.Won, keccak256("yes"), true);
    }

    function test_propose_afterFinalization_reverts() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.warp(block.timestamp + LIVENESS);
        oracle.finalize(1);

        // Propose again on same legId — already finalized
        vm.prank(proposer);
        vm.expectRevert("OptimisticOracle: already finalized");
        oracle.propose(1, LegStatus.Lost, keccak256("no"));
    }

    function test_getStatus_whileChallenged_returnsUnresolved() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.prank(challenger);
        oracle.challenge(1);

        // During dispute, leg should not be resolvable
        assertFalse(oracle.canResolve(1));
        (LegStatus status, bytes32 outcome) = oracle.getStatus(1);
        assertEq(uint8(status), uint8(LegStatus.Unresolved));
        assertEq(outcome, bytes32(0));
    }

    function test_resolveDispute_cannotResolveAsUnresolved() public {
        vm.prank(proposer);
        oracle.propose(1, LegStatus.Won, keccak256("yes"));
        vm.prank(challenger);
        oracle.challenge(1);

        vm.expectRevert("OptimisticOracle: cannot resolve as Unresolved");
        oracle.resolveDispute(1, LegStatus.Unresolved, bytes32(0), true);
    }
}
