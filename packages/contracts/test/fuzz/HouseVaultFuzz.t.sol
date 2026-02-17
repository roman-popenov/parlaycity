// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HouseVaultFuzzTest is Test {
    MockUSDC usdc;
    HouseVault vault;

    address engine = makeAddr("engine");
    address alice = makeAddr("alice");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        vault.setEngine(engine);
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

    /// @notice Deposit-then-withdraw roundtrip should return nearly all assets.
    ///         Max loss is 1 wei per operation from rounding.
    function testFuzz_depositWithdraw_roundtrip(uint256 amount) public {
        amount = bound(amount, 1e6, 100_000e6);

        _mintBulk(alice, amount);
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        uint256 returned = vault.withdraw(shares, alice);
        vm.stopPrank();

        // Rounding loss should be at most 1 wei
        assertApproxEqAbs(returned, amount, 1, "roundtrip loss exceeds 1 wei");
        // Vault should be empty (or 1 wei dust)
        assertLe(vault.totalAssets(), 1, "vault dust exceeds 1 wei");
    }

    /// @notice After any deposit, share price should never decrease (no value extraction).
    ///         Two sequential depositors should each get fair shares.
    function testFuzz_sharePrice_nonDecreasing(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1e6, 10_000e6);
        a2 = bound(a2, 1e6, 10_000e6);

        // First deposit (establishes price)
        usdc.mint(alice, a1);
        vm.startPrank(alice);
        usdc.approve(address(vault), a1);
        vault.deposit(a1, alice);
        vm.stopPrank();

        uint256 priceAfterFirst = vault.convertToAssets(1e6); // price of 1 share

        // Second deposit
        address bob = makeAddr("bob");
        usdc.mint(bob, a2);
        vm.startPrank(bob);
        usdc.approve(address(vault), a2);
        vault.deposit(a2, bob);
        vm.stopPrank();

        uint256 priceAfterSecond = vault.convertToAssets(1e6);

        // Share price should not decrease from a deposit
        assertGe(priceAfterSecond, priceAfterFirst, "share price decreased after deposit");
    }

    /// @notice Injecting yield (direct USDC transfer) increases share price.
    ///         After yield, withdrawing should return more than deposited.
    function testFuzz_yieldInjection_increasesSharePrice(uint256 deposit, uint256 yield_) public {
        deposit = bound(deposit, 1e6, 10_000e6);
        // Yield must exceed (supply+1)/(total+1) per share to register after
        // integer division floor in convertToAssets. Use deposit/1e6 as safe minimum.
        yield_ = bound(yield_, deposit / 1e6 + 1, 5_000e6);

        usdc.mint(alice, deposit);
        vm.startPrank(alice);
        usdc.approve(address(vault), deposit);
        uint256 shares = vault.deposit(deposit, alice);
        vm.stopPrank();

        uint256 valueBefore = vault.convertToAssets(shares);

        // Simulate yield by transferring USDC directly to vault
        usdc.mint(address(vault), yield_);

        uint256 valueAfter = vault.convertToAssets(shares);
        assertGt(valueAfter, valueBefore, "yield did not increase share value");
    }

    /// @notice convertToShares and convertToAssets are inverses (within rounding).
    function testFuzz_shareConversion_roundtrip(uint256 assets) public {
        assets = bound(assets, 1e6, 10_000e6);

        // Seed vault so conversion isn't 1:1 trivially
        usdc.mint(alice, 5000e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), 5000e6);
        vault.deposit(5000e6, alice);
        vm.stopPrank();

        // Inject some yield to skew ratio
        usdc.mint(address(vault), 500e6);

        uint256 shares = vault.convertToShares(assets);
        uint256 assetsBack = vault.convertToAssets(shares);

        // Rounding down on both conversions means we lose at most 1 wei per conversion
        assertLe(assets - assetsBack, 2, "roundtrip conversion loss exceeds 2 wei");
    }

    /// @notice reservePayout always respects both maxPayout and utilization cap.
    function testFuzz_reservePayout_respectsCaps(uint256 deposit, uint256 amount) public {
        deposit = bound(deposit, 10e6, 10_000e6);
        amount = bound(amount, 1, deposit);

        usdc.mint(alice, deposit);
        vm.startPrank(alice);
        usdc.approve(address(vault), deposit);
        vault.deposit(deposit, alice);
        vm.stopPrank();

        uint256 mp = vault.maxPayout();
        uint256 mr = vault.maxReservable();
        uint256 fl = vault.freeLiquidity();

        vm.prank(engine);
        if (amount <= mp && amount <= mr && amount <= fl) {
            vault.reservePayout(amount);
            assertEq(vault.totalReserved(), amount);
            assertLe(vault.totalReserved(), vault.totalAssets(), "reserved > totalAssets");
        } else {
            vm.expectRevert();
            vault.reservePayout(amount);
        }
    }

    /// @notice Multiple depositors withdraw proportionally after yield injection.
    function testFuzz_multiDepositor_fairWithdrawal(uint256 a1, uint256 a2, uint256 yield_) public {
        a1 = bound(a1, 1e6, 5_000e6);
        a2 = bound(a2, 1e6, 5_000e6);
        yield_ = bound(yield_, 0, 1_000e6);

        address bob = makeAddr("bob");

        usdc.mint(alice, a1);
        vm.startPrank(alice);
        usdc.approve(address(vault), a1);
        uint256 s1 = vault.deposit(a1, alice);
        vm.stopPrank();

        usdc.mint(bob, a2);
        vm.startPrank(bob);
        usdc.approve(address(vault), a2);
        uint256 s2 = vault.deposit(a2, bob);
        vm.stopPrank();

        // Inject yield
        if (yield_ > 0) usdc.mint(address(vault), yield_);

        // Both withdraw
        vm.prank(alice);
        uint256 r1 = vault.withdraw(s1, alice);
        vm.prank(bob);
        uint256 r2 = vault.withdraw(s2, bob);

        // Each should get at least their original deposit (yield is profit).
        // Max rounding loss per withdrawal = share price = totalAssets / totalSupply.
        uint256 sharePrice = (a1 + a2 + yield_) / (a1 + a2);
        assertGe(r1, a1 - sharePrice - 1, "alice lost principal");
        assertGe(r2, a2 - sharePrice - 1, "bob lost principal");

        // Combined withdrawal should be close to total deposited + yield.
        // Each convertToAssets call rounds down by up to 1 share-price of assets.
        // With 2 withdrawals: max rounding loss = 2 * sharePrice.
        uint256 totalDeposited = a1 + a2 + yield_;
        uint256 totalReturned = r1 + r2;
        uint256 tolerance = 2 * sharePrice + 2;
        assertApproxEqAbs(totalReturned, totalDeposited, tolerance, "total returned diverges from total deposited + yield");
    }
}
