// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {MockYieldAdapter} from "../../src/yield/MockYieldAdapter.sol";
import {IYieldAdapter} from "../../src/interfaces/IYieldAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockYieldAdapterTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    MockYieldAdapter adapter;

    address owner = address(this);
    address alice = makeAddr("alice");
    address engine = makeAddr("engine");

    function _mintBulk(address to, uint256 amount) internal {
        uint256 perCall = 10_000e6;
        while (amount > 0) {
            uint256 batch = amount > perCall ? perCall : amount;
            usdc.mint(to, batch);
            amount -= batch;
        }
    }

    function setUp() public {
        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        adapter = new MockYieldAdapter(IERC20(address(usdc)), address(vault));

        vault.setEngine(engine);
        vault.setYieldAdapter(IYieldAdapter(address(adapter)));

        // Fund alice, deposit to vault
        _mintBulk(alice, 10_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vault.deposit(10_000e6, alice);

        // Fund owner for simulate yield
        _mintBulk(owner, 10_000e6);
        usdc.approve(address(adapter), type(uint256).max);
    }

    // ── Deploy / Withdraw ─────────────────────────────────────────────────

    function test_deployIdle() public {
        uint256 deployable = vault.safeDeployable();
        assertTrue(deployable > 0, "should have deployable balance");

        vault.deployIdle(5_000e6);

        assertEq(adapter.balance(), 5_000e6);
        assertEq(vault.localBalance(), 5_000e6);
        assertEq(vault.totalAssets(), 10_000e6); // unchanged
    }

    function test_recallFromAdapter() public {
        vault.deployIdle(5_000e6);
        vault.recallFromAdapter(2_000e6);

        assertEq(adapter.balance(), 3_000e6);
        assertEq(vault.localBalance(), 7_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
    }

    function test_emergencyRecall() public {
        vault.deployIdle(5_000e6);
        vault.emergencyRecall();

        assertEq(adapter.balance(), 0);
        assertEq(vault.localBalance(), 10_000e6);
    }

    // ── Simulated Yield ───────────────────────────────────────────────────

    function test_simulateYield_increasesTotalAssets() public {
        vault.deployIdle(5_000e6);

        // Simulate 500 USDC yield
        adapter.simulateYield(500e6);

        assertEq(adapter.balance(), 5_500e6);
        assertEq(vault.totalAssets(), 10_500e6);
    }

    function test_simulateYield_increasesSharePrice() public {
        vault.deployIdle(5_000e6);

        uint256 sharePriceBefore = vault.convertToAssets(1e6);
        adapter.simulateYield(1000e6);
        uint256 sharePriceAfter = vault.convertToAssets(1e6);

        assertTrue(sharePriceAfter > sharePriceBefore, "share price should increase");
    }

    // ── SafeDeployable ────────────────────────────────────────────────────

    function test_safeDeployable_respectsBuffer() public {
        // Buffer = 25% of 10k = 2.5k. So deployable = 10k - 2.5k = 7.5k
        uint256 deployable = vault.safeDeployable();
        assertEq(deployable, 7_500e6);
    }

    function test_safeDeployable_respectsReserved() public {
        // Reserve some payout
        vm.prank(engine);
        vault.reservePayout(500e6); // maxPayout = 5% of 10k = 500

        // Reserved = 500, buffer = 2500. Max(500, 2500) = 2500
        // deployable = 10k - 2.5k = 7.5k (buffer dominates)
        assertEq(vault.safeDeployable(), 7_500e6);
    }

    function test_deployIdle_exceedsSafeDeployable_reverts() public {
        uint256 deployable = vault.safeDeployable();
        vm.expectRevert("HouseVault: exceeds safe deployable");
        vault.deployIdle(deployable + 1);
    }

    function test_deployIdle_noAdapter_reverts() public {
        // Deploy a fresh vault without adapter
        HouseVault freshVault = new HouseVault(IERC20(address(usdc)));
        vm.expectRevert("HouseVault: no adapter");
        freshVault.deployIdle(1000e6);
    }

    // ── Deposit/Withdraw still work with deployed capital ─────────────────

    function test_deposit_withDeployedCapital() public {
        vault.deployIdle(5_000e6);

        // New depositor
        usdc.mint(address(0xBEEF), 5_000e6);
        vm.startPrank(address(0xBEEF));
        usdc.approve(address(vault), type(uint256).max);
        uint256 shares = vault.deposit(5_000e6, address(0xBEEF));
        vm.stopPrank();

        // totalAssets was 10k, totalSupply was 10k, so 1:1
        assertEq(shares, 5_000e6);
        assertEq(vault.totalAssets(), 15_000e6);
    }

    function test_withdraw_withDeployedCapital() public {
        vault.deployIdle(5_000e6);
        // Local = 5k, reserved = 0, freeLiquidity = 5k

        vm.prank(alice);
        uint256 assets = vault.withdraw(2_000e6, alice);

        assertEq(assets, 2_000e6);
        assertEq(vault.localBalance(), 3_000e6);
    }

    function test_freeLiquidity_onlyCountsLocal() public {
        vault.deployIdle(5_000e6);

        // freeLiquidity should only count local balance
        assertEq(vault.freeLiquidity(), 5_000e6);
        assertEq(vault.totalAssets(), 10_000e6);
    }

    // ── Reservations only count local ─────────────────────────────────────

    function test_reserveAfterDeploy_usesLocalOnly() public {
        vault.deployIdle(5_000e6);
        // Local = 5k. MaxPayout = 5% of 10k = 500

        vm.prank(engine);
        vault.reservePayout(500e6);
        assertEq(vault.freeLiquidity(), 4_500e6);
    }
}
