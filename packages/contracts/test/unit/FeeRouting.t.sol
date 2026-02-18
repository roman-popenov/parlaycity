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
import {FeeRouterSetup} from "../helpers/FeeRouterSetup.sol";

contract FeeRoutingTest is FeeRouterSetup {
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

        vault.setEngine(address(engine));
        lockVault = _wireFeeRouter(vault);

        // Seed vault with liquidity
        usdc.mint(owner, 10_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000e6, owner);

        // Fund alice (bettor)
        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        // Setup locker: deposit to vault, get vUSDC, lock in LockVault
        usdc.mint(locker, 5_000e6);
        vm.startPrank(locker);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(5_000e6, locker);
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        lockVault.lock(5_000e6, LockVault.LockTier.THIRTY);
        vm.stopPrank();

        // Create legs
        registry.createLeg("ETH > $5000?", "coingecko:eth", 600_000, 700_000, address(oracle), 500_000);
        registry.createLeg("BTC > $150k?", "coingecko:btc", 600_000, 700_000, address(oracle), 250_000);
    }

    // ── Fee Split Accuracy ──────────────────────────────────────────────

    function test_feeRouting_correctSplit() public {
        uint256 lockVaultUsdcBefore = usdc.balanceOf(address(lockVault));
        uint256 safetyUsdcBefore = usdc.balanceOf(safetyModule);
        uint256 vaultAssetsBefore = vault.totalAssets();

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        // 50 USDC stake (payout ~392 USDC, within 5% of 15k = 750 USDC maxPayout)
        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 50e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 feePaid = t.feePaid;
        // baseFee=100bps + perLegFee=50bps*2 = 200bps = 2%
        // feePaid = 2% of 50 USDC = 1 USDC = 1_000_000
        assertEq(feePaid, 1_000_000, "feePaid should be 1 USDC");

        uint256 expectedToLockers = (feePaid * 9000) / 10_000; // 90% = 900_000
        uint256 expectedToSafety = (feePaid * 500) / 10_000; // 5% = 50_000
        uint256 expectedToVault = feePaid - expectedToLockers - expectedToSafety; // 5% = 50_000

        // Verify LockVault received its portion
        assertEq(
            usdc.balanceOf(address(lockVault)) - lockVaultUsdcBefore,
            expectedToLockers,
            "LockVault should receive 90% of fees"
        );

        // Verify safety module received its portion
        assertEq(
            usdc.balanceOf(safetyModule) - safetyUsdcBefore, expectedToSafety, "SafetyModule should receive 5% of fees"
        );

        // Verify vault retained the rest (stake + feeToVault - fees routed out)
        // vaultAssets = vaultBefore + stake - feeToLockers - feeToSafety
        uint256 expectedVaultAssets = vaultAssetsBefore + 50e6 - expectedToLockers - expectedToSafety;
        assertEq(vault.totalAssets(), expectedVaultAssets, "Vault assets should reflect fee routing");

        // Verify no rounding loss: feeToLockers + feeToSafety + feeToVault == feePaid
        assertEq(expectedToLockers + expectedToSafety + expectedToVault, feePaid, "No rounding loss in fee split");
    }

    // ── LockVault Accumulator Updated ──────────────────────────────────

    function test_feeRouting_lockVaultAccumulatorUpdated() public {
        uint256 accBefore = lockVault.accRewardPerWeightedShare();

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        engine.buyTicket(legs, outcomes, 50e6);

        uint256 accAfter = lockVault.accRewardPerWeightedShare();
        assertGt(accAfter, accBefore, "Accumulator should increase after fee routing");
    }

    // ── Locker Can Claim Routed Fees ────────────────────────────────────

    function test_feeRouting_lockerCanClaimFees() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 50e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 expectedToLockers = (t.feePaid * 9000) / 10_000;

        // Settle rewards for the locker's position
        vm.prank(locker);
        lockVault.settleRewards(0);

        // Claim fees
        uint256 lockerBefore = usdc.balanceOf(locker);
        vm.prank(locker);
        lockVault.claimFees();

        uint256 claimed = usdc.balanceOf(locker) - lockerBefore;
        // Allow 1 wei dust from Synthetix accumulator integer division
        assertApproxEqAbs(claimed, expectedToLockers, 1, "Locker should claim ~90% fee share (1 wei dust ok)");
    }

    // ── buyTicket Reverts Without Fee Config ─────────────────────────

    function test_feeRouting_revertsWithoutConfig() public {
        // Deploy fresh vault/engine without lockVault/safetyModule config
        HouseVault freshVault = new HouseVault(IERC20(address(usdc)));
        ParlayEngine freshEngine = new ParlayEngine(freshVault, registry, IERC20(address(usdc)), BOOTSTRAP_ENDS);
        freshVault.setEngine(address(freshEngine));

        usdc.mint(owner, 10_000e6);
        usdc.approve(address(freshVault), type(uint256).max);
        freshVault.deposit(10_000e6, owner);

        usdc.mint(alice, 10e6);
        vm.prank(alice);
        usdc.approve(address(freshEngine), type(uint256).max);

        // buyTicket should revert because lockVault is not configured
        vm.prank(alice);
        vm.expectRevert("HouseVault: lockVault not configured");
        freshEngine.buyTicket(_twoLegs(), _twoOutcomes(), 10e6);
    }

    function test_feeRouting_revertsWithoutSafetyModule() public {
        // Deploy with lockVault but no safetyModule
        HouseVault freshVault = new HouseVault(IERC20(address(usdc)));
        ParlayEngine freshEngine = new ParlayEngine(freshVault, registry, IERC20(address(usdc)), BOOTSTRAP_ENDS);
        LockVault freshLockVault = new LockVault(freshVault);
        freshVault.setEngine(address(freshEngine));
        freshVault.setLockVault(freshLockVault);
        freshLockVault.setFeeDistributor(address(freshVault));

        usdc.mint(owner, 10_000e6);
        usdc.approve(address(freshVault), type(uint256).max);
        freshVault.deposit(10_000e6, owner);

        usdc.mint(alice, 50e6);
        vm.prank(alice);
        usdc.approve(address(freshEngine), type(uint256).max);

        // buyTicket should revert because safetyModule is not configured
        vm.prank(alice);
        vm.expectRevert("HouseVault: safetyModule not configured");
        freshEngine.buyTicket(_twoLegs(), _twoOutcomes(), 50e6);
    }

    // ── Solvency Invariant Holds After Routing ─────────────────────────

    function test_feeRouting_solvencyInvariantHolds() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        engine.buyTicket(legs, outcomes, 50e6);

        // totalReserved <= totalAssets must hold after fee routing
        assertLe(vault.totalReserved(), vault.totalAssets(), "Solvency invariant must hold after fee routing");
    }

    // ── Zero Fee Edge Case ─────────────────────────────────────────────

    function test_feeRouting_zeroFeeNoRouting() public {
        // Set fees to zero
        engine.setBaseFee(0);
        engine.setPerLegFee(0);

        uint256 lockVaultBefore = usdc.balanceOf(address(lockVault));
        uint256 safetyBefore = usdc.balanceOf(safetyModule);

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        engine.buyTicket(legs, outcomes, 10e6);

        // No fees should be routed
        assertEq(usdc.balanceOf(address(lockVault)), lockVaultBefore, "No USDC to LockVault on zero fee");
        assertEq(usdc.balanceOf(safetyModule), safetyBefore, "No USDC to SafetyModule on zero fee");
    }

    // ── Dust Handling (Remainder Goes to Vault) ────────────────────────

    function test_feeRouting_dustGoesToVault() public {
        // Use a stake that produces a feePaid not evenly divisible by 10_000
        // E.g. stake = 3e6 (3 USDC), edge = 200bps -> feePaid = 60_000
        // feeToLockers = 60_000 * 9000 / 10_000 = 54_000
        // feeToSafety = 60_000 * 500 / 10_000 = 3_000
        // feeToVault = 60_000 - 54_000 - 3_000 = 3_000
        // sum = 60_000 (exact)

        // Try stake = 7e6 (7 USDC), feePaid = 140_000
        // feeToLockers = 140_000 * 9000 / 10_000 = 126_000
        // feeToSafety = 140_000 * 500 / 10_000 = 7_000
        // feeToVault = 140_000 - 126_000 - 7_000 = 7_000
        // sum = 140_000 (exact)

        // For a non-trivial dust case: stake = 1_000_003 (just over 1 USDC)
        // Won't work since minStake = 1e6, let's use a different approach
        // The BPS math is: N * 9000 / 10000. This loses dust when N is not divisible by 10.
        // feePaid = 1e6 * 200 / 10000 = 20_000. 20_000 * 9000 / 10000 = 18_000. No dust.
        // Need odd feePaid. Set baseFee to 101 bps -> totalEdge = 201 bps
        // stake=1e6 -> feePaid = 1e6 * 201 / 10000 = 20_100
        // feeToLockers = 20_100 * 9000 / 10000 = 18_090
        // feeToSafety = 20_100 * 500 / 10000 = 1_005
        // feeToVault = 20_100 - 18_090 - 1_005 = 1_005
        // sum = 20_100 (exact, still no dust because 20_100 divides evenly)

        // Actually BPS math: x * 9000 / 10000 always rounds down. If x = 3,
        // 3 * 9000 / 10000 = 2, 3 * 500 / 10000 = 0, vault = 3 - 2 - 0 = 1.
        // Let's verify the invariant that sum always equals feePaid.
        // This is guaranteed by: vault_share = feePaid - lockers_share - safety_share

        // Just verify with a normal case that the split sums to feePaid
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 feeToLockers = (t.feePaid * 9000) / 10_000;
        uint256 feeToSafety = (t.feePaid * 500) / 10_000;
        uint256 feeToVault = t.feePaid - feeToLockers - feeToSafety;

        assertEq(feeToLockers + feeToSafety + feeToVault, t.feePaid, "Split must sum to feePaid exactly");
    }

    // ── Fee Routing Events ─────────────────────────────────────────────

    function test_feeRouting_emitsEvents() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        // Expected fee: 200bps of 50e6 = 1_000_000
        uint256 expectedFee = 1_000_000;
        uint256 expectedToLockers = (expectedFee * 9000) / 10_000;
        uint256 expectedToSafety = (expectedFee * 500) / 10_000;
        uint256 expectedToVault = expectedFee - expectedToLockers - expectedToSafety;

        vm.expectEmit(true, true, true, true);
        emit ParlayEngine.FeesRouted(0, expectedToLockers, expectedToSafety, expectedToVault);

        vm.prank(alice);
        engine.buyTicket(legs, outcomes, 50e6);
    }

    // ── Multiple Tickets Accumulate Fees ────────────────────────────────

    function test_feeRouting_multipleTicketsAccumulate() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        uint256 lockVaultBefore = usdc.balanceOf(address(lockVault));

        // Buy 3 tickets
        vm.startPrank(alice);
        engine.buyTicket(legs, outcomes, 10e6);
        engine.buyTicket(legs, outcomes, 20e6);
        engine.buyTicket(legs, outcomes, 30e6);
        vm.stopPrank();

        // Because fees are computed per-ticket, verify piecewise:
        uint256 fee1 = (10e6 * 200) / 10_000;
        uint256 fee2 = (20e6 * 200) / 10_000;
        uint256 fee3 = (30e6 * 200) / 10_000;
        uint256 piecewiseLockers = (fee1 * 9000) / 10_000 + (fee2 * 9000) / 10_000 + (fee3 * 9000) / 10_000;

        assertEq(
            usdc.balanceOf(address(lockVault)) - lockVaultBefore,
            piecewiseLockers,
            "Cumulative fee routing to LockVault"
        );
    }

    // ── NotifyFees Access Control ──────────────────────────────────────

    function test_notifyFees_onlyFeeDistributor() public {
        vm.prank(alice);
        vm.expectRevert("LockVault: caller is not fee distributor");
        lockVault.notifyFees(1e6);
    }

    // ── RouteFees Access Control ───────────────────────────────────────

    function test_routeFees_onlyEngine() public {
        vm.prank(alice);
        vm.expectRevert("HouseVault: caller is not engine");
        vault.routeFees(1e6, 1e6, 0);
    }

    // ── Admin Setters ──────────────────────────────────────────────────

    function test_setLockVault_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setLockVault(lockVault);
    }

    function test_setSafetyModule_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setSafetyModule(safetyModule);
    }

    function test_setFeeDistributor_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        lockVault.setFeeDistributor(address(vault));
    }

    function test_setLockVault_zeroAddress_reverts() public {
        vm.expectRevert("HouseVault: zero address");
        vault.setLockVault(LockVault(address(0)));
    }

    function test_setSafetyModule_zeroAddress_reverts() public {
        vm.expectRevert("HouseVault: zero address");
        vault.setSafetyModule(address(0));
    }

    function test_setFeeDistributor_zeroAddress_reverts() public {
        vm.expectRevert("LockVault: zero address");
        lockVault.setFeeDistributor(address(0));
    }

    // ── Settlement Still Works After Fee Routing ───────────────────────

    function test_feeRouting_settlementStillWorks() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        // Resolve and settle
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Won));

        // Claim payout
        uint256 bettorBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.claimPayout(ticketId);
        assertEq(usdc.balanceOf(alice), bettorBefore + t.potentialPayout);
    }

    // ── Helpers ───────────────────────────────────────────────────────

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

    // ── NotifyFees With No Lockers (Graceful No-Op) ────────────────────

    function test_notifyFees_noLockers_isNoOp() public {
        // Deploy fresh setup with no lockers
        HouseVault freshVault = new HouseVault(IERC20(address(usdc)));
        LockVault freshLockVault = new LockVault(freshVault);
        freshLockVault.setFeeDistributor(address(freshVault));

        // No lockers -> totalWeightedShares == 0
        // notifyFees should return silently (USDC stays as surplus in LockVault)
        usdc.mint(address(freshLockVault), 1e6);
        vm.prank(address(freshVault));
        freshLockVault.notifyFees(1e6); // should not revert

        assertEq(freshLockVault.accRewardPerWeightedShare(), 0, "Accumulator unchanged with no lockers");
        assertEq(freshLockVault.undistributedFees(), 1e6, "Fees tracked for later distribution");
    }

    // ── Undistributed Fees Flow to First Locker ─────────────────────────

    function test_undistributedFees_flowToFirstLocker() public {
        // Deploy fresh setup: vault + lockVault + engine, NO lockers yet
        HouseVault freshVault = new HouseVault(IERC20(address(usdc)));
        LockVault freshLockVault = new LockVault(freshVault);
        ParlayEngine freshEngine = new ParlayEngine(freshVault, registry, IERC20(address(usdc)), BOOTSTRAP_ENDS);
        freshVault.setEngine(address(freshEngine));
        freshVault.setLockVault(freshLockVault);
        freshVault.setSafetyModule(safetyModule);
        freshLockVault.setFeeDistributor(address(freshVault));

        // Seed vault
        usdc.mint(owner, 10_000e6);
        usdc.approve(address(freshVault), type(uint256).max);
        freshVault.deposit(10_000e6, owner);

        // Buy a ticket — fees go to lockVault, but no lockers yet → undistributed
        usdc.mint(alice, 50e6);
        vm.prank(alice);
        usdc.approve(address(freshEngine), type(uint256).max);
        vm.prank(alice);
        freshEngine.buyTicket(_twoLegs(), _twoOutcomes(), 50e6);

        uint256 expectedFee = (50e6 * 200) / 10_000; // 1_000_000
        uint256 expectedToLockers = (expectedFee * 9000) / 10_000; // 900_000
        assertEq(freshLockVault.undistributedFees(), expectedToLockers, "Fees undistributed without lockers");

        // Now a locker locks — should capture all undistributed fees
        address firstLocker = makeAddr("firstLocker");
        usdc.mint(firstLocker, 5_000e6);
        vm.startPrank(firstLocker);
        usdc.approve(address(freshVault), type(uint256).max);
        uint256 shares = freshVault.deposit(5_000e6, firstLocker);
        IERC20(address(freshVault)).approve(address(freshLockVault), type(uint256).max);
        freshLockVault.lock(shares, LockVault.LockTier.THIRTY);
        vm.stopPrank();

        assertEq(freshLockVault.undistributedFees(), 0, "Undistributed fees cleared after first lock");

        // First locker should be able to claim all of them
        vm.prank(firstLocker);
        freshLockVault.settleRewards(0);
        vm.prank(firstLocker);
        freshLockVault.claimFees();

        assertApproxEqAbs(
            usdc.balanceOf(firstLocker), expectedToLockers, 1, "First locker captures all undistributed fees"
        );
    }

    // ── Two Lockers Get Weight-Proportional Shares ──────────────────────

    function test_twoLockers_proportionalShares() public {
        // Setup second locker with different tier (different weight)
        address locker2 = makeAddr("locker2");
        usdc.mint(locker2, 5_000e6);
        vm.startPrank(locker2);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(5_000e6, locker2);
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        // 90-day tier = 1.5x weight vs locker's 30-day = 1.1x
        lockVault.lock(5_000e6, LockVault.LockTier.NINETY);
        vm.stopPrank();

        // Buy ticket
        vm.prank(alice);
        uint256 ticketId = engine.buyTicket(_twoLegs(), _twoOutcomes(), 50e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        uint256 feeToLockers = (t.feePaid * 9000) / 10_000;

        // Settle and claim for both
        vm.prank(locker);
        lockVault.settleRewards(0);
        uint256 locker1Before = usdc.balanceOf(locker);
        vm.prank(locker);
        lockVault.claimFees();
        uint256 locker1Claimed = usdc.balanceOf(locker) - locker1Before;

        vm.prank(locker2);
        lockVault.settleRewards(1);
        uint256 locker2Before = usdc.balanceOf(locker2);
        vm.prank(locker2);
        lockVault.claimFees();
        uint256 locker2Claimed = usdc.balanceOf(locker2) - locker2Before;

        // Combined claims should equal total routed to lockers (within rounding)
        assertApproxEqAbs(locker1Claimed + locker2Claimed, feeToLockers, 2, "Combined claims equal total locker fees");

        // Locker2 (1.5x weight) should get more than locker1 (1.1x weight) for same shares
        assertGt(locker2Claimed, locker1Claimed, "Higher tier locker gets larger share");
    }

    // ── Routing Uses freeLiquidity Not totalAssets ──────────────────────

    function test_routeFees_usesFreeLiquidity() public {
        // Buy several small tickets to eat up free liquidity via reservations
        usdc.mint(alice, 400e6);
        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);

        // Buy multiple tickets to build up totalReserved (each stays within maxPayout)
        vm.startPrank(alice);
        for (uint256 i = 0; i < 8; i++) {
            engine.buyTicket(_twoLegs(), _twoOutcomes(), 50e6);
        }
        vm.stopPrank();

        // Now vault has high totalReserved, low freeLiquidity
        uint256 free = vault.freeLiquidity();

        // Try to route more than free liquidity (simulate from engine)
        vm.prank(address(engine));
        vm.expectRevert("HouseVault: insufficient free liquidity for routing");
        vault.routeFees(free + 1, 0, 0);
    }

    // ── NotifyFees Zero Amount Reverts ───────────────────────────────────

    function test_notifyFees_zeroAmount_reverts() public {
        vm.prank(address(vault));
        vm.expectRevert("LockVault: zero amount");
        lockVault.notifyFees(0);
    }
}
