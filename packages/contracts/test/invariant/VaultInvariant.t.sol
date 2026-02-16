// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title VaultHandler
/// @notice Handler contract for invariant testing. Randomly calls deposit,
///         withdraw, reservePayout, and releasePayout.
contract VaultHandler is Test {
    MockUSDC public usdc;
    HouseVault public vault;

    address[] public actors;
    uint256 public depositCount;
    uint256 public withdrawCount;
    uint256 public reserveCount;
    uint256 public releaseCount;

    constructor(MockUSDC _usdc, HouseVault _vault) {
        usdc = _usdc;
        vault = _vault;

        // Create actors
        for (uint256 i = 0; i < 3; i++) {
            address actor = makeAddr(string(abi.encodePacked("actor", i)));
            actors.push(actor);
            usdc.mint(actor, 10_000e6);
            vm.prank(actor);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorIndex, uint256 amount) external {
        actorIndex = bound(actorIndex, 0, actors.length - 1);
        address actor = actors[actorIndex];
        amount = bound(amount, 1, usdc.balanceOf(actor));
        if (amount == 0) return;

        vm.prank(actor);
        vault.deposit(amount, actor);
        depositCount++;
    }

    function withdraw(uint256 actorIndex, uint256 shares) external {
        actorIndex = bound(actorIndex, 0, actors.length - 1);
        address actor = actors[actorIndex];
        uint256 balance = vault.balanceOf(actor);
        if (balance == 0) return;

        shares = bound(shares, 1, balance);
        uint256 assets = vault.convertToAssets(shares);
        if (assets == 0 || assets > vault.freeLiquidity()) return;

        vm.prank(actor);
        vault.withdraw(shares, actor);
        withdrawCount++;
    }

    function reservePayout(uint256 amount) external {
        uint256 maxP = vault.maxPayout();
        uint256 maxR = vault.maxReservable();
        uint256 currentReserved = vault.totalReserved();
        uint256 headroom = maxR > currentReserved ? maxR - currentReserved : 0;

        uint256 cap = maxP < headroom ? maxP : headroom;
        if (cap == 0) return;
        amount = bound(amount, 1, cap);

        // Call as engine
        address engine = vault.engine();
        vm.prank(engine);
        vault.reservePayout(amount);
        reserveCount++;
    }

    function releasePayout(uint256 amount) external {
        uint256 reserved = vault.totalReserved();
        if (reserved == 0) return;
        amount = bound(amount, 1, reserved);

        address engine = vault.engine();
        vm.prank(engine);
        vault.releasePayout(amount);
        releaseCount++;
    }
}

contract VaultInvariantTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    VaultHandler handler;

    address engine = makeAddr("engine");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        vault.setEngine(engine);

        handler = new VaultHandler(usdc, vault);

        // Seed the vault with initial liquidity so invariant tests have something to work with
        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(5_000e6, address(this));

        targetContract(address(handler));
    }

    /// @notice totalReserved must never exceed totalAssets
    function invariant_reservedNeverExceedsTotalAssets() public view {
        assertLe(vault.totalReserved(), vault.totalAssets());
    }

    /// @notice If share supply is zero, totalAssets should also be zero (within dust tolerance).
    ///         If totalAssets is zero, share supply should also be zero.
    function invariant_sharesAndAssetsConsistency() public view {
        if (vault.totalSupply() == 0) {
            // All shares burned => no one has claim => assets should be 0 (or dust from rounding)
            // We allow 1 wei of dust per deposit/withdraw cycle
            assertLe(vault.totalAssets(), handler.depositCount() + handler.withdrawCount());
        }
    }

    /// @notice Free liquidity = totalAssets - totalReserved, should never underflow
    function invariant_freeLiquidityNonNegative() public view {
        // This is guaranteed by the Solidity 0.8 checked math, but let's verify.
        assertGe(vault.totalAssets(), vault.totalReserved());
    }
}
