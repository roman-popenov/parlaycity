// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {HouseVault} from "../src/core/HouseVault.sol";
import {LegRegistry} from "../src/core/LegRegistry.sol";
import {ParlayEngine} from "../src/core/ParlayEngine.sol";
import {AdminOracleAdapter} from "../src/oracle/AdminOracleAdapter.sol";
import {LockVault} from "../src/core/LockVault.sol";
import {MockYieldAdapter} from "../src/yield/MockYieldAdapter.sol";
import {IYieldAdapter} from "../src/interfaces/IYieldAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LegStatus} from "../src/interfaces/IOracleAdapter.sol";

/// @notice Full lifecycle integration test: deploy, deposit, bet, settle, claim, withdraw.
contract IntegrationTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LegRegistry registry;
    ParlayEngine engine;
    AdminOracleAdapter oracle;
    LockVault lockVault;
    MockYieldAdapter yieldAdapter;

    address owner = address(this);
    address lp = makeAddr("lp");
    address bettor = makeAddr("bettor");

    function setUp() public {
        vm.warp(100_000);

        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        registry = new LegRegistry();
        oracle = new AdminOracleAdapter();
        engine = new ParlayEngine(vault, registry, IERC20(address(usdc)), 1_000_000);
        lockVault = new LockVault(vault);
        yieldAdapter = new MockYieldAdapter(IERC20(address(usdc)), address(vault));

        vault.setEngine(address(engine));
        vault.setYieldAdapter(IYieldAdapter(address(yieldAdapter)));

        // Fund LP: deposit 10k USDC to vault
        usdc.mint(lp, 10_000e6);
        vm.startPrank(lp);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000e6, lp);
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        vm.stopPrank();

        // Fund bettor
        usdc.mint(bettor, 1_000e6);
        vm.prank(bettor);
        usdc.approve(address(engine), type(uint256).max);

        // Create 3 legs
        registry.createLeg("ETH > 5k?", "src", 200_000, 300_000, address(oracle), 500_000);
        registry.createLeg("BTC > 150k?", "src", 200_000, 300_000, address(oracle), 250_000);
        registry.createLeg("SOL > 300?", "src", 200_000, 300_000, address(oracle), 200_000);
    }

    // ── Lifecycle 1: Win and Claim ────────────────────────────────────────

    function test_lifecycle_winAndClaim() public {
        uint256 vaultBefore = vault.totalAssets();

        // Buy 2-leg parlay
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(bettor);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertTrue(t.potentialPayout > 0, "payout > 0");
        assertTrue(vault.totalReserved() > 0, "reserved > 0");

        // Resolve both legs as won
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));

        engine.settleTicket(ticketId);
        assertEq(uint8(engine.getTicket(ticketId).status), uint8(ParlayEngine.TicketStatus.Won));

        // Claim payout
        uint256 bettorBefore = usdc.balanceOf(bettor);
        vm.prank(bettor);
        engine.claimPayout(ticketId);

        assertEq(usdc.balanceOf(bettor), bettorBefore + t.potentialPayout);
        assertEq(uint8(engine.getTicket(ticketId).status), uint8(ParlayEngine.TicketStatus.Claimed));

        // Vault balance = initial + stake - payout (house lost)
        assertEq(vault.totalAssets(), vaultBefore + 10e6 - t.potentialPayout);
        assertEq(vault.totalReserved(), 0);

        // LP withdraws shares
        uint256 lpShares = vault.balanceOf(lp);
        vm.prank(lp);
        uint256 assets = vault.withdraw(lpShares, lp);
        assertTrue(assets > 0, "LP gets assets back");
    }

    // ── Lifecycle 2: Loss (house wins) ────────────────────────────────────

    function test_lifecycle_loss_houseWins() public {
        uint256 vaultBefore = vault.totalAssets();

        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(bettor);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        // One leg lost
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Lost, keccak256("no"));

        engine.settleTicket(ticketId);
        assertEq(uint8(engine.getTicket(ticketId).status), uint8(ParlayEngine.TicketStatus.Lost));

        // Vault balance increased by full stake (house wins)
        assertEq(vault.totalAssets(), vaultBefore + 10e6);
        assertEq(vault.totalReserved(), 0);
    }

    // ── Lifecycle 3: Partial void ─────────────────────────────────────────

    function test_lifecycle_partialVoid() public {
        uint256[] memory legs = new uint256[](3);
        legs[0] = 0;
        legs[1] = 1;
        legs[2] = 2;
        bytes32[] memory outcomes = new bytes32[](3);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");
        outcomes[2] = keccak256("yes");

        vm.prank(bettor);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        ParlayEngine.Ticket memory tBefore = engine.getTicket(ticketId);

        // 2 won, 1 voided
        oracle.resolve(0, LegStatus.Won, keccak256("yes"));
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        oracle.resolve(2, LegStatus.Voided, bytes32(0));

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory tAfter = engine.getTicket(ticketId);
        // Should be Won with recalculated (lower) payout
        assertEq(uint8(tAfter.status), uint8(ParlayEngine.TicketStatus.Won));
        assertTrue(tAfter.potentialPayout <= tBefore.potentialPayout, "payout should decrease or stay same");
    }

    // ── Lifecycle 4: All voided ───────────────────────────────────────────

    function test_lifecycle_allVoided() public {
        uint256[] memory legs = new uint256[](2);
        legs[0] = 0;
        legs[1] = 1;
        bytes32[] memory outcomes = new bytes32[](2);
        outcomes[0] = keccak256("yes");
        outcomes[1] = keccak256("yes");

        vm.prank(bettor);
        uint256 ticketId = engine.buyTicket(legs, outcomes, 10e6);

        oracle.resolve(0, LegStatus.Voided, bytes32(0));
        oracle.resolve(1, LegStatus.Voided, bytes32(0));

        engine.settleTicket(ticketId);

        ParlayEngine.Ticket memory t = engine.getTicket(ticketId);
        assertEq(uint8(t.status), uint8(ParlayEngine.TicketStatus.Voided));
        assertEq(vault.totalReserved(), 0);
    }

    // ── Lock + Yield Integration ──────────────────────────────────────────

    function test_lockVault_integration() public {
        // LP locks half their vUSDC
        vm.prank(lp);
        uint256 posId = lockVault.lock(5_000e6, LockVault.LockTier.THIRTY);

        assertEq(lockVault.totalLockedShares(), 5_000e6);
        assertEq(vault.balanceOf(address(lockVault)), 5_000e6);
        assertEq(vault.balanceOf(lp), 5_000e6); // 10k - 5k locked

        // Warp and unlock
        vm.warp(block.timestamp + 31 days);
        vm.prank(lp);
        lockVault.unlock(posId);

        assertEq(vault.balanceOf(lp), 10_000e6); // all back
    }

    function test_yieldAdapter_integration() public {
        // Deploy idle funds to yield adapter
        vault.deployIdle(5_000e6);
        assertEq(vault.totalAssets(), 10_000e6); // unchanged
        assertEq(vault.localBalance(), 5_000e6);
        assertEq(yieldAdapter.balance(), 5_000e6);

        // Simulate yield
        usdc.mint(owner, 500e6);
        usdc.approve(address(yieldAdapter), 500e6);
        yieldAdapter.simulateYield(500e6);

        assertEq(vault.totalAssets(), 10_500e6);

        // Share price increased
        assertTrue(vault.convertToAssets(1e6) > 1e6, "share price > 1");

        // Recall everything
        vault.emergencyRecall();
        assertEq(vault.localBalance(), 10_500e6);
        assertEq(yieldAdapter.balance(), 0);
    }
}
