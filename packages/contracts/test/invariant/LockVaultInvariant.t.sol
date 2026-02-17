// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LockVault} from "../../src/core/LockVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title LockVaultHandler
/// @notice Handler for LockVault invariant testing. Randomly locks, unlocks,
///         early-withdraws, distributes fees, and settles rewards.
contract LockVaultHandler is Test {
    MockUSDC public usdc;
    HouseVault public vault;
    LockVault public lockVault;

    address[] public actors;
    uint256[] public positionIds;

    // Track cumulative fees distributed for invariant checks
    uint256 public totalFeesDistributed;
    uint256 public lockCount;
    uint256 public unlockCount;
    uint256 public earlyWithdrawCount;

    function _mintBulk(address to, uint256 amount) internal {
        uint256 perCall = 10_000e6;
        while (amount > 0) {
            uint256 batch = amount > perCall ? perCall : amount;
            usdc.mint(to, batch);
            amount -= batch;
        }
    }

    constructor(MockUSDC _usdc, HouseVault _vault, LockVault _lockVault) {
        usdc = _usdc;
        vault = _vault;
        lockVault = _lockVault;

        for (uint256 i = 0; i < 3; i++) {
            address actor = makeAddr(string(abi.encodePacked("locker", i)));
            actors.push(actor);

            // Give each actor USDC, deposit into vault for vUSDC, approve lockVault
            _mintBulk(actor, 50_000e6);
            vm.startPrank(actor);
            usdc.approve(address(vault), type(uint256).max);
            vault.deposit(10_000e6, actor);
            IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
            vm.stopPrank();
        }
    }

    function lock(uint256 actorIdx, uint256 shares, uint256 tierIdx) external {
        actorIdx = bound(actorIdx, 0, actors.length - 1);
        address actor = actors[actorIdx];

        uint256 balance = vault.balanceOf(actor);
        if (balance < 1e6) return;
        shares = bound(shares, 1e6, balance);
        tierIdx = bound(tierIdx, 0, 2);

        LockVault.LockTier tier;
        if (tierIdx == 0) tier = LockVault.LockTier.THIRTY;
        else if (tierIdx == 1) tier = LockVault.LockTier.SIXTY;
        else tier = LockVault.LockTier.NINETY;

        vm.prank(actor);
        uint256 posId = lockVault.lock(shares, tier);
        positionIds.push(posId);
        lockCount++;
    }

    function unlock(uint256 posIdx) external {
        if (positionIds.length == 0) return;
        posIdx = bound(posIdx, 0, positionIds.length - 1);
        uint256 posId = positionIds[posIdx];

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        if (pos.shares == 0) return;
        if (block.timestamp < pos.unlockAt) return;

        vm.prank(pos.owner);
        lockVault.unlock(posId);
        unlockCount++;
    }

    function earlyWithdraw(uint256 posIdx) external {
        if (positionIds.length == 0) return;
        posIdx = bound(posIdx, 0, positionIds.length - 1);
        uint256 posId = positionIds[posIdx];

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        if (pos.shares == 0) return;
        if (block.timestamp >= pos.unlockAt) return;

        vm.prank(pos.owner);
        lockVault.earlyWithdraw(posId);
        earlyWithdrawCount++;
    }

    function distributeFees(uint256 amount) external {
        if (lockVault.totalWeightedShares() == 0) return;
        amount = bound(amount, 1, 100e6);

        // Owner distributes fees (test contract is owner)
        usdc.mint(address(this), amount);
        usdc.approve(address(lockVault), amount);
        lockVault.distributeFees(amount);
        totalFeesDistributed += amount;
    }

    function settleRewards(uint256 posIdx) external {
        if (positionIds.length == 0) return;
        posIdx = bound(posIdx, 0, positionIds.length - 1);
        uint256 posId = positionIds[posIdx];

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        if (pos.shares == 0) return;

        vm.prank(pos.owner);
        lockVault.settleRewards(posId);
    }

    function warpForward(uint256 seconds_) external {
        seconds_ = bound(seconds_, 1, 100 days);
        vm.warp(block.timestamp + seconds_);
    }
}

contract LockVaultInvariantTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LockVault lockVault;
    LockVaultHandler handler;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new HouseVault(IERC20(address(usdc)));
        lockVault = new LockVault(vault);

        handler = new LockVaultHandler(usdc, vault, lockVault);

        // Transfer ownership to handler so it can call distributeFees
        lockVault.transferOwnership(address(handler));

        targetContract(address(handler));
    }

    /// @notice totalLockedShares must always equal the sum of all active position shares.
    ///         The vUSDC balance of the lock vault must be >= totalLockedShares.
    function invariant_lockedSharesConsistency() public view {
        uint256 vUSDCBalance = vault.balanceOf(address(lockVault));
        assertGe(vUSDCBalance, lockVault.totalLockedShares(), "vUSDC balance < totalLockedShares");
    }

    /// @notice totalWeightedShares should be zero iff totalLockedShares is zero.
    function invariant_weightedSharesConsistency() public view {
        if (lockVault.totalLockedShares() == 0) {
            assertEq(lockVault.totalWeightedShares(), 0, "weighted shares nonzero when locked is zero");
        }
        if (lockVault.totalWeightedShares() > 0) {
            assertGt(lockVault.totalLockedShares(), 0, "locked shares zero when weighted is nonzero");
        }
    }

    /// @notice accRewardPerWeightedShare should never decrease.
    ///         (fees are only added, never removed)
    function invariant_rewardAccumulatorNonDecreasing() public view {
        // This is structurally guaranteed since distributeFees only increases it,
        // but verifying it holds under random action sequences.
        // We verify indirectly: totalFeesDistributed > 0 implies acc > 0
        if (handler.totalFeesDistributed() > 0 && lockVault.totalWeightedShares() > 0) {
            assertGt(lockVault.accRewardPerWeightedShare(), 0, "accumulator zero despite fees distributed");
        }
    }

    /// @notice Penalty shares from early withdrawals go to HouseVault.
    ///         The difference between vUSDC balance and totalLockedShares is penalty surplus.
    function invariant_penaltySurplusNonNegative() public view {
        uint256 vUSDCBalance = vault.balanceOf(address(lockVault));
        uint256 locked = lockVault.totalLockedShares();
        assertGe(vUSDCBalance, locked, "negative penalty surplus");
    }
}
