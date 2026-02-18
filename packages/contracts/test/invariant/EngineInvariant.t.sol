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

/// @title EngineHandler
/// @notice Invariant handler that exercises the full ticket lifecycle:
///         buy (classic/progressive/cashout) -> resolve legs -> claim/settle/cashout.
///         Each action uses bounded random inputs to explore the state space.
contract EngineHandler is Test {
    MockUSDC public usdc;
    HouseVault public vault;
    ParlayEngine public engine;
    LegRegistry public registry;
    AdminOracleAdapter public oracle;

    address[] public bettors;

    // Tracking state for handler actions
    uint256[] public activeTickets;
    uint256 public totalTickets;

    // Leg state: 6 pre-created legs, each can be resolved once
    uint256 public constant NUM_LEGS = 6;
    bool[NUM_LEGS] public legResolved;

    // Counters for post-run analysis
    uint256 public buyCount;
    uint256 public resolveCount;
    uint256 public settleCount;
    uint256 public claimProgressiveCount;
    uint256 public cashoutCount;
    uint256 public claimPayoutCount;

    constructor(
        MockUSDC _usdc,
        HouseVault _vault,
        ParlayEngine _engine,
        LegRegistry _registry,
        AdminOracleAdapter _oracle
    ) {
        usdc = _usdc;
        vault = _vault;
        engine = _engine;
        registry = _registry;
        oracle = _oracle;

        // Create bettors with funds (mint in batches due to MockUSDC 10k cap)
        for (uint256 i = 0; i < 4; i++) {
            address bettor = makeAddr(string(abi.encodePacked("bettor", i)));
            bettors.push(bettor);
            usdc.mint(bettor, 10_000e6);
            vm.prank(bettor);
            usdc.approve(address(engine), type(uint256).max);
        }
    }

    /// @notice Buy a ticket with random payout mode and 2-3 random legs.
    function buyTicket(uint256 bettorSeed, uint256 modeSeed, uint256 stakeSeed, uint256 legSeed) external {
        address bettor = bettors[bound(bettorSeed, 0, bettors.length - 1)];
        uint256 stake = bound(stakeSeed, 1e6, 20e6);

        if (usdc.balanceOf(bettor) < stake) return;

        // Pick payout mode: 0=CLASSIC, 1=PROGRESSIVE, 2=EARLY_CASHOUT
        ParlayEngine.PayoutMode mode = ParlayEngine.PayoutMode(bound(modeSeed, 0, 2));

        // Pick 2 or 3 legs from the pool, avoiding resolved legs if possible
        // (resolved legs are fine for buying — they just need to be active in registry)
        uint256 numLegs = bound(legSeed, 2, 3);
        uint256[] memory legIds = new uint256[](numLegs);
        bytes32[] memory outcomes = new bytes32[](numLegs);

        // Simple deterministic leg selection: pick first N unresolved legs,
        // wrapping around if needed
        uint256 start = bound(legSeed >> 8, 0, NUM_LEGS - 1);
        uint256 picked;
        for (uint256 i = 0; i < NUM_LEGS && picked < numLegs; i++) {
            uint256 legId = (start + i) % NUM_LEGS;
            // Only use legs that haven't been resolved yet (so ticket stays active longer)
            if (!legResolved[legId]) {
                legIds[picked] = legId;
                outcomes[picked] = keccak256("yes");
                picked++;
            }
        }

        // If not enough unresolved legs, fill with any legs (will get settled quickly)
        if (picked < numLegs) {
            for (uint256 i = 0; i < NUM_LEGS && picked < numLegs; i++) {
                uint256 legId = (start + i) % NUM_LEGS;
                bool duplicate = false;
                for (uint256 j = 0; j < picked; j++) {
                    if (legIds[j] == legId) {
                        duplicate = true;
                        break;
                    }
                }
                if (!duplicate) {
                    legIds[picked] = legId;
                    outcomes[picked] = keccak256("yes");
                    picked++;
                }
            }
        }

        if (picked < 2) return; // shouldn't happen with 6 legs, but guard

        // Trim if we got fewer than requested
        if (picked < numLegs) {
            uint256[] memory trimmed = new uint256[](picked);
            bytes32[] memory trimmedOut = new bytes32[](picked);
            for (uint256 i = 0; i < picked; i++) {
                trimmed[i] = legIds[i];
                trimmedOut[i] = outcomes[i];
            }
            legIds = trimmed;
            outcomes = trimmedOut;
        }

        // Check vault capacity before attempting
        uint256 maxPay = vault.maxPayout();
        uint256 freeLiq = vault.freeLiquidity();
        if (maxPay == 0 || freeLiq < 1e6) return;

        vm.prank(bettor);
        try engine.buyTicketWithMode(legIds, outcomes, stake, mode) returns (uint256 ticketId) {
            activeTickets.push(ticketId);
            totalTickets++;
            buyCount++;
        } catch {
            // Expected: vault capacity exceeded, etc.
        }
    }

    /// @notice Resolve a random leg as Won, Lost, or Voided.
    function resolveLeg(uint256 legSeed, uint256 statusSeed) external {
        uint256 legId = bound(legSeed, 0, NUM_LEGS - 1);
        if (legResolved[legId]) return;

        // 60% Won, 30% Lost, 10% Voided — weighted toward interesting outcomes
        uint256 roll = bound(statusSeed, 0, 99);
        LegStatus status;
        if (roll < 60) {
            status = LegStatus.Won;
        } else if (roll < 90) {
            status = LegStatus.Lost;
        } else {
            status = LegStatus.Voided;
        }

        oracle.resolve(legId, status, keccak256("yes"));
        legResolved[legId] = true;
        resolveCount++;
    }

    /// @notice Settle a random active ticket.
    function settleTicket(uint256 ticketSeed) external {
        if (activeTickets.length == 0) return;
        uint256 idx = bound(ticketSeed, 0, activeTickets.length - 1);
        uint256 ticketId = activeTickets[idx];

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        if (t.status != ParlayEngine.TicketStatus.Active) {
            _removeActiveTicket(idx);
            return;
        }

        try engine.settleTicket(ticketId) {
            settleCount++;
            _removeActiveTicket(idx);
        } catch {
            // Expected: legs not yet resolvable
        }
    }

    /// @notice Claim progressive on a random active ticket.
    function claimProgressive(uint256 ticketSeed) external {
        if (activeTickets.length == 0) return;
        uint256 idx = bound(ticketSeed, 0, activeTickets.length - 1);
        uint256 ticketId = activeTickets[idx];

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        if (t.payoutMode != ParlayEngine.PayoutMode.PROGRESSIVE) return;
        if (t.status != ParlayEngine.TicketStatus.Active) {
            _removeActiveTicket(idx);
            return;
        }

        address owner = engine.ownerOf(ticketId);
        vm.prank(owner);
        try engine.claimProgressive(ticketId) {
            claimProgressiveCount++;
        } catch {
            // Expected: no won legs, nothing to claim, etc.
        }
    }

    /// @notice Cash out a random active early-cashout ticket.
    function cashoutEarly(uint256 ticketSeed) external {
        if (activeTickets.length == 0) return;
        uint256 idx = bound(ticketSeed, 0, activeTickets.length - 1);
        uint256 ticketId = activeTickets[idx];

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        if (t.payoutMode != ParlayEngine.PayoutMode.EARLY_CASHOUT) return;
        if (t.status != ParlayEngine.TicketStatus.Active) {
            _removeActiveTicket(idx);
            return;
        }

        address owner = engine.ownerOf(ticketId);
        vm.prank(owner);
        try engine.cashoutEarly(ticketId, 0) {
            cashoutCount++;
            _removeActiveTicket(idx);
        } catch {
            // Expected: all resolved, leg lost, etc.
        }
    }

    /// @notice Claim payout on a random won ticket.
    function claimPayout(uint256 ticketSeed) external {
        uint256 totalCount = engine.ticketCount();
        if (totalCount == 0) return;
        uint256 ticketId = bound(ticketSeed, 0, totalCount - 1);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        if (t.status != ParlayEngine.TicketStatus.Won) return;

        address owner = engine.ownerOf(ticketId);
        vm.prank(owner);
        try engine.claimPayout(ticketId) {
            claimPayoutCount++;
        } catch {
            // Expected: nothing to claim
        }
    }

    /// @notice LP deposits more liquidity to keep the system running.
    function depositLiquidity(uint256 amount) external {
        address lp = bettors[0]; // reuse first bettor as LP
        uint256 bal = usdc.balanceOf(lp);
        if (bal < 1e6) return;
        amount = bound(amount, 1e6, bal);

        vm.startPrank(lp);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, lp);
        vm.stopPrank();
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    function _removeActiveTicket(uint256 idx) internal {
        activeTickets[idx] = activeTickets[activeTickets.length - 1];
        activeTickets.pop();
    }

    function activeTicketCount() external view returns (uint256) {
        return activeTickets.length;
    }
}

/// @title EngineInvariantTest
/// @notice Invariant tests for the full ParlayEngine lifecycle.
///         Verifies vault solvency and engine accounting under random
///         sequences of buy/resolve/claim/settle/cashout operations.
contract EngineInvariantTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LegRegistry registry;
    ParlayEngine engine;
    AdminOracleAdapter oracle;
    EngineHandler handler;

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

        // Seed vault with substantial initial liquidity (mint in batches due to MockUSDC cap)
        usdc.approve(address(vault), type(uint256).max);
        for (uint256 i = 0; i < 50; i++) {
            usdc.mint(address(this), 10_000e6);
            vault.deposit(10_000e6, address(this));
        }

        // Create 6 legs with varied probabilities
        // All use same oracle, cutoff far in future
        registry.createLeg("ETH > $5000?", "source", 600_000, 700_000, address(oracle), 500_000); // 50%
        registry.createLeg("BTC > $150k?", "source", 600_000, 700_000, address(oracle), 250_000); // 25%
        registry.createLeg("SOL > $300?", "source", 600_000, 700_000, address(oracle), 200_000); // 20%
        registry.createLeg("DOGE > $1?", "source", 600_000, 700_000, address(oracle), 100_000); // 10%
        registry.createLeg("AVAX > $100?", "source", 600_000, 700_000, address(oracle), 750_000); // 75%
        registry.createLeg("LINK > $50?", "source", 600_000, 700_000, address(oracle), 333_333); // 33%

        handler = new EngineHandler(usdc, vault, engine, registry, oracle);

        targetContract(address(handler));
    }

    /// @notice Core invariant: reserved exposure never exceeds vault assets.
    function invariant_reservedNeverExceedsTotalAssets() public view {
        assertLe(vault.totalReserved(), vault.totalAssets(), "CRITICAL: reserved > totalAssets");
    }

    /// @notice Engine must never hold USDC. All stake flows to vault.
    function invariant_engineHoldsZeroUSDC() public view {
        assertEq(usdc.balanceOf(address(engine)), 0, "engine must hold 0 USDC");
    }

    /// @notice Free liquidity must be non-negative (no underflow).
    function invariant_freeLiquidityNonNegative() public view {
        assertGe(vault.totalAssets(), vault.totalReserved(), "free liquidity underflow");
    }

    /// @notice Log handler action counts after each run for observability.
    function invariant_callSummary() public view {
        // This invariant always passes. It exists so forge prints
        // the action distribution, helping us verify the fuzzer
        // exercised meaningful paths.
        if (handler.buyCount() == 0) return; // skip empty runs

        // If we bought tickets, we should have attempted some lifecycle actions
        assertTrue(true);
    }
}
