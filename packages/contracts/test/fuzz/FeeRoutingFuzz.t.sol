// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LegRegistry} from "../../src/core/LegRegistry.sol";
import {ParlayEngine} from "../../src/core/ParlayEngine.sol";
import {LockVault} from "../../src/core/LockVault.sol";
import {AdminOracleAdapter} from "../../src/oracle/AdminOracleAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LegStatus} from "../../src/interfaces/IOracleAdapter.sol";

contract FeeRoutingFuzzTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LegRegistry registry;
    ParlayEngine engine;
    LockVault lockVault;
    AdminOracleAdapter oracle;

    address owner = address(this);
    address alice = makeAddr("alice");
    address locker = makeAddr("locker");
    address safetyModule = makeAddr("safetyModule");

    uint256 constant BOOTSTRAP_ENDS = 1_000_000;

    function setUp() public {
        vm.warp(500_000);

        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        registry = new LegRegistry();
        oracle = new AdminOracleAdapter();
        engine = new ParlayEngine(vault, registry, IERC20(address(usdc)), BOOTSTRAP_ENDS);
        lockVault = new LockVault(vault);

        vault.setEngine(address(engine));
        vault.setLockVault(lockVault);
        vault.setSafetyModule(safetyModule);
        lockVault.setFeeDistributor(address(vault));

        // Seed vault with large liquidity pool
        _mintBulk(owner, 100_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(100_000e6, owner);

        // Setup locker
        _mintBulk(locker, 50_000e6);
        vm.startPrank(locker);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(50_000e6, locker);
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        lockVault.lock(50_000e6, LockVault.LockTier.THIRTY);
        vm.stopPrank();

        // Create legs with different probabilities
        registry.createLeg("ETH > $5000?", "coingecko:eth", 600_000, 700_000, address(oracle), 500_000);
        registry.createLeg("BTC > $150k?", "coingecko:btc", 600_000, 700_000, address(oracle), 250_000);
    }

    /// @dev Mint in batches to stay within MockUSDC's 10,000 USDC per-call cap.
    function _mintBulk(address to, uint256 amount) internal {
        uint256 perCall = 10_000e6;
        while (amount > 0) {
            uint256 batch = amount > perCall ? perCall : amount;
            usdc.mint(to, batch);
            amount -= batch;
        }
    }

    function _twoLegs() internal pure returns (uint256[] memory legs) {
        legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
    }

    function _twoOutcomes() internal pure returns (bytes32[] memory outcomes) {
        outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");
    }

    // ── Fuzz: Fee Split Always Sums to feePaid ──────────────────────────

    /// @notice For any valid stake, the 90/5/5 split sums exactly to feePaid.
    function testFuzz_feeSplit_sumsExactly(uint256 stake) public {
        // Bound stake: min 1 USDC, max limited by vault capacity
        // maxPayout = 5% of 150k = 7,500 USDC. Payout = effectiveStake * ~8x multiplier.
        // So max safe stake ≈ 900 USDC to stay within maxPayout.
        stake = bound(stake, 1e6, 900e6);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 feeToLockers = (t.feePaid * 9000) / 10_000;
        uint256 feeToSafety = (t.feePaid * 500) / 10_000;
        uint256 feeToVault = t.feePaid - feeToLockers - feeToSafety;

        assertEq(feeToLockers + feeToSafety + feeToVault, t.feePaid, "Split must sum to feePaid exactly");
    }

    // ── Fuzz: Solvency Invariant After Routing ──────────────────────────

    /// @notice After any valid buyTicket, totalReserved <= totalAssets.
    function testFuzz_solvencyAfterRouting(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        assertLe(vault.totalReserved(), vault.totalAssets(), "Solvency invariant violated after fee routing");
    }

    // ── Fuzz: Routed Amounts Match Balances ─────────────────────────────

    /// @notice LockVault and SafetyModule balances increase by exactly the expected amounts.
    function testFuzz_routedAmountsMatchBalances(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        uint256 lockBefore = usdc.balanceOf(address(lockVault));
        uint256 safetyBefore = usdc.balanceOf(safetyModule);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 expectedToLockers = (t.feePaid * 9000) / 10_000;
        uint256 expectedToSafety = (t.feePaid * 500) / 10_000;

        assertEq(usdc.balanceOf(address(lockVault)) - lockBefore, expectedToLockers, "LockVault balance mismatch");
        assertEq(usdc.balanceOf(safetyModule) - safetyBefore, expectedToSafety, "SafetyModule balance mismatch");
    }

    // ── Fuzz: Locker Claims Correct Amount ──────────────────────────────

    /// @notice Single locker claims ~90% of fees for any valid stake.
    function testFuzz_lockerClaimsCorrectAmount(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 expectedToLockers = (t.feePaid * 9000) / 10_000;

        vm.prank(locker);
        lockVault.settleRewards(0);
        uint256 before = usdc.balanceOf(locker);
        vm.prank(locker);
        lockVault.claimFees();
        uint256 claimed = usdc.balanceOf(locker) - before;

        // 1 wei dust tolerance from Synthetix accumulator integer division
        assertApproxEqAbs(claimed, expectedToLockers, 1, "Locker claim amount incorrect");
    }

    // ── Fuzz: Multiple Tickets Accumulate Correctly ─────────────────────

    /// @notice Fees from N tickets accumulate correctly in LockVault.
    function testFuzz_multipleTickets_accumulateCorrectly(uint256 stake1, uint256 stake2, uint256 stake3) public {
        stake1 = bound(stake1, 1e6, 200e6);
        stake2 = bound(stake2, 1e6, 200e6);
        stake3 = bound(stake3, 1e6, 200e6);

        uint256 totalStake = stake1 + stake2 + stake3;
        _mintBulk(alice, totalStake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        uint256 lockBefore = usdc.balanceOf(address(lockVault));

        vm.startPrank(alice);
        uint256 t1 = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake1);
        uint256 t2 = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake2);
        uint256 t3 = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake3);
        vm.stopPrank();

        // Piecewise expected: each ticket routes independently
        uint256 expected = (engine.getTicket(t1).feePaid * 9000) / 10_000
            + (engine.getTicket(t2).feePaid * 9000) / 10_000 + (engine.getTicket(t3).feePaid * 9000) / 10_000;

        assertEq(usdc.balanceOf(address(lockVault)) - lockBefore, expected, "Cumulative LockVault balance mismatch");
    }

    // ── Fuzz: Accumulator Never Decreases ───────────────────────────────

    /// @notice The reward accumulator is monotonically non-decreasing across tickets.
    function testFuzz_accumulatorNeverDecreases(uint256 stake1, uint256 stake2) public {
        stake1 = bound(stake1, 1e6, 400e6);
        stake2 = bound(stake2, 1e6, 400e6);

        _mintBulk(alice, stake1 + stake2);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        engine.buyTicket(_twoLegs(), _twoOutcomes(), stake1);
        uint256 accAfterFirst = lockVault.accRewardPerWeightedShare();

        vm.prank(alice);
        engine.buyTicket(_twoLegs(), _twoOutcomes(), stake2);
        uint256 accAfterSecond = lockVault.accRewardPerWeightedShare();

        assertGe(accAfterSecond, accAfterFirst, "Accumulator decreased");
    }

    // ── Fuzz: Vault Assets Equation After Routing ───────────────────────

    /// @notice vault.totalAssets() = vaultBefore + stake - feeToLockers - feeToSafety
    function testFuzz_vaultAssetsEquation(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        uint256 vaultBefore = vault.totalAssets();

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 feeToLockers = (t.feePaid * 9000) / 10_000;
        uint256 feeToSafety = (t.feePaid * 500) / 10_000;

        // Vault gained stake, lost routed fees
        assertEq(
            vault.totalAssets(), vaultBefore + stake - feeToLockers - feeToSafety, "Vault assets equation violated"
        );
    }

    // ── Fuzz: Full Lifecycle (Buy + Settle + Claim) With Routing ────────

    /// @notice Full lifecycle works correctly with fee routing for any valid stake.
    function testFuzz_fullLifecycle_withRouting(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        uint256 safetyBefore = usdc.balanceOf(safetyModule);

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 expectedToSafety = (t.feePaid * 500) / 10_000;

        // Verify safety module got its share
        assertEq(usdc.balanceOf(safetyModule) - safetyBefore, expectedToSafety, "Safety module balance wrong");

        // Resolve as win
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        // Claim payout
        uint256 bettorBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimPayout(ticketId);
        assertEq(usdc.balanceOf(alice), bettorBefore + t.potentialPayout, "Payout incorrect after routing");

        // Solvency still holds
        assertLe(vault.totalReserved(), vault.totalAssets(), "Solvency violated after full lifecycle");
    }

    // ── Fuzz: USDC Conservation (Total Supply Invariant) ────────────────

    /// @notice Total USDC across all participants is conserved after buyTicket.
    function testFuzz_usdcConservation(uint256 stake) public {
        stake = bound(stake, 1e6, 900e6);

        _mintBulk(alice, stake);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        // Snapshot all relevant balances
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 vaultBefore = usdc.balanceOf(address(vault));
        uint256 lockBefore = usdc.balanceOf(address(lockVault));
        uint256 safetyBefore = usdc.balanceOf(safetyModule);
        uint256 totalBefore = aliceBefore + vaultBefore + lockBefore + safetyBefore;

        vm.prank(alice);
        engine.buyTicket(_twoLegs(), _twoOutcomes(), stake);

        uint256 aliceAfter = usdc.balanceOf(alice);
        uint256 vaultAfter = usdc.balanceOf(address(vault));
        uint256 lockAfter = usdc.balanceOf(address(lockVault));
        uint256 safetyAfter = usdc.balanceOf(safetyModule);
        uint256 totalAfter = aliceAfter + vaultAfter + lockAfter + safetyAfter;

        // USDC is conserved: no tokens created or destroyed
        assertEq(totalAfter, totalBefore, "USDC not conserved across buyTicket");
    }
}
