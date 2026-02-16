// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HouseVaultTest is Test {
    MockUSDC usdc;
    HouseVault vault;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address engine = makeAddr("engine");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        vault.setEngine(engine);

        // Fund alice and bob
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);

        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ── Deposit / Withdraw ───────────────────────────────────────────────

    function test_deposit_mintsShares() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1000e6, alice);

        assertEq(shares, 1000e6); // 1:1 on first deposit
        assertEq(vault.balanceOf(alice), 1000e6);
        assertEq(vault.totalAssets(), 1000e6);
    }

    function test_deposit_secondDepositor() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(bob);
        uint256 shares = vault.deposit(500e6, bob);

        assertEq(shares, 500e6); // Still 1:1 (no yield yet)
        assertEq(vault.totalAssets(), 1500e6);
    }

    function test_withdraw_returnsAssets() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(alice);
        uint256 assets = vault.withdraw(500e6, alice);

        assertEq(assets, 500e6);
        assertEq(usdc.balanceOf(alice), 9500e6); // started with 10k, deposited 1k, withdrew 500
    }

    function test_withdraw_revertsIfInsufficientFreeLiquidity() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        // Reserve 900 of 1000
        vm.prank(engine);
        vault.reservePayout(50e6); // maxPayout = 5% of 1000 = 50

        // Free = 1000 - 50 = 950, trying to withdraw all 1000 shares
        vm.prank(alice);
        vm.expectRevert("HouseVault: insufficient free liquidity");
        vault.withdraw(1000e6, alice);
    }

    function test_deposit_revertsOnZero() public {
        vm.prank(alice);
        vm.expectRevert("HouseVault: zero deposit");
        vault.deposit(0, alice);
    }

    // ── Reserve / Release / Pay ──────────────────────────────────────────

    function test_reservePayout() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(engine);
        vault.reservePayout(50e6);

        assertEq(vault.totalReserved(), 50e6);
        assertEq(vault.freeLiquidity(), 950e6);
    }

    function test_releasePayout() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(engine);
        vault.reservePayout(50e6);

        vm.prank(engine);
        vault.releasePayout(50e6);

        assertEq(vault.totalReserved(), 0);
        assertEq(vault.freeLiquidity(), 1000e6);
    }

    function test_payWinner() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(engine);
        vault.reservePayout(50e6);

        uint256 bobBalBefore = usdc.balanceOf(bob);
        vm.prank(engine);
        vault.payWinner(bob, 50e6);

        assertEq(usdc.balanceOf(bob), bobBalBefore + 50e6);
        assertEq(vault.totalReserved(), 0);
        assertEq(vault.totalAssets(), 950e6);
    }

    // ── Utilization cap ──────────────────────────────────────────────────

    function test_reservePayout_revertsIfExceedsCap() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);

        // maxUtilization = 80%, so max reservable = 80
        // maxPayout = 5% of 100 = 5
        // Try to reserve 6 (exceeds maxPayout)
        vm.prank(engine);
        vm.expectRevert("HouseVault: exceeds max payout");
        vault.reservePayout(6e6);
    }

    function test_reservePayout_revertsIfUtilizationExceeded() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);

        // maxPayout = 5, reserve 5 many times
        for (uint256 i = 0; i < 16; i++) {
            vm.prank(engine);
            vault.reservePayout(5e6);
        }
        // totalReserved = 80, which equals maxReservable (80% of 100)
        // Next should fail
        vm.prank(engine);
        vm.expectRevert("HouseVault: utilization cap exceeded");
        vault.reservePayout(5e6);
    }

    // ── Max payout ───────────────────────────────────────────────────────

    function test_maxPayout_5percent() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);
        assertEq(vault.maxPayout(), 50e6); // 5% of 1000
    }

    // ── Pause ────────────────────────────────────────────────────────────

    function test_pause_blocksDeposit() public {
        vault.pause();
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(100e6, alice);
    }

    function test_pause_blocksWithdraw() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);

        vault.pause();
        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(50e6, alice);
    }

    // ── Access Control ───────────────────────────────────────────────────

    function test_onlyEngine_reservePayout() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);

        vm.prank(alice);
        vm.expectRevert("HouseVault: caller is not engine");
        vault.reservePayout(50e6);
    }

    function test_onlyEngine_releasePayout() public {
        vm.prank(alice);
        vm.expectRevert("HouseVault: caller is not engine");
        vault.releasePayout(1);
    }

    function test_onlyEngine_payWinner() public {
        vm.prank(alice);
        vm.expectRevert("HouseVault: caller is not engine");
        vault.payWinner(alice, 1);
    }
}
