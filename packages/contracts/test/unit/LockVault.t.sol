// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../../src/MockUSDC.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LockVault} from "../../src/core/LockVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LockVaultTest is Test {
    MockUSDC usdc;
    HouseVault vault;
    LockVault lockVault;

    address owner = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

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
        lockVault = new LockVault(vault);

        // Fund alice and bob with USDC, deposit into vault to get vUSDC
        _mintBulk(alice, 50_000e6);
        _mintBulk(bob, 50_000e6);

        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000e6, alice);
        // Approve lockVault to take vUSDC
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000e6, bob);
        IERC20(address(vault)).approve(address(lockVault), type(uint256).max);
        vm.stopPrank();

        // Fund owner with USDC for fee distribution
        _mintBulk(owner, 10_000e6);
        usdc.approve(address(lockVault), type(uint256).max);
    }

    // ── Lock ──────────────────────────────────────────────────────────────

    function test_lock_30day() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        assertEq(pos.owner, alice);
        assertEq(pos.shares, 1000e6);
        assertEq(uint8(pos.tier), uint8(LockVault.LockTier.THIRTY));
        assertEq(pos.feeMultiplierBps, 11000); // 1.1x
        assertEq(pos.unlockAt, block.timestamp + 30 days);
        assertEq(lockVault.totalLockedShares(), 1000e6);
    }

    function test_lock_60day() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(2000e6, LockVault.LockTier.SIXTY);

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        assertEq(pos.feeMultiplierBps, 12500); // 1.25x
        assertEq(pos.unlockAt, block.timestamp + 60 days);
    }

    function test_lock_90day() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(3000e6, LockVault.LockTier.NINETY);

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        assertEq(pos.feeMultiplierBps, 15000); // 1.5x
        assertEq(pos.unlockAt, block.timestamp + 90 days);
    }

    function test_lock_zeroShares_reverts() public {
        vm.prank(alice);
        vm.expectRevert("LockVault: lock below minimum");
        lockVault.lock(0, LockVault.LockTier.THIRTY);
    }

    function test_lock_belowMinimum_reverts() public {
        vm.prank(alice);
        vm.expectRevert("LockVault: lock below minimum");
        lockVault.lock(0.5e6, LockVault.LockTier.THIRTY); // 0.5 vUSDC < 1 vUSDC minimum
    }

    function test_lock_insufficientBalance_reverts() public {
        address charlie = makeAddr("charlie");
        vm.prank(charlie);
        vm.expectRevert(); // SafeERC20 transfer will fail
        lockVault.lock(1000e6, LockVault.LockTier.THIRTY);
    }

    // ── Unlock ────────────────────────────────────────────────────────────

    function test_unlock_afterMaturity() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        uint256 balBefore = vault.balanceOf(alice);

        // Warp past maturity
        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        lockVault.unlock(posId);

        assertEq(vault.balanceOf(alice), balBefore + 1000e6);
        assertEq(lockVault.totalLockedShares(), 0);

        // Position should be cleared
        LockVault.LockPosition memory pos = lockVault.getPosition(posId);
        assertEq(pos.shares, 0);
    }

    function test_unlock_beforeMaturity_reverts() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        vm.prank(alice);
        vm.expectRevert("LockVault: still locked");
        lockVault.unlock(posId);
    }

    function test_unlock_notOwner_reverts() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        vm.warp(block.timestamp + 31 days);

        vm.prank(bob);
        vm.expectRevert("LockVault: not owner");
        lockVault.unlock(posId);
    }

    // ── Early Withdraw ────────────────────────────────────────────────────

    function test_earlyWithdraw_halfwayThrough() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(10_000e6, LockVault.LockTier.THIRTY);

        // Warp 15 days (halfway through 30 day lock)
        vm.warp(block.timestamp + 15 days);

        uint256 balBefore = vault.balanceOf(alice);

        vm.prank(alice);
        lockVault.earlyWithdraw(posId);

        uint256 balAfter = vault.balanceOf(alice);
        uint256 returned = balAfter - balBefore;

        // Penalty: basePenaltyBps=1000 (10%), remaining=15/30=50%, so penaltyBps=500 (5%)
        // penaltyShares = 10000e6 * 500 / 10000 = 500e6
        // returned = 10000e6 - 500e6 = 9500e6
        assertEq(returned, 9500e6);
    }

    function test_earlyWithdraw_dayOne_fullPenalty() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(10_000e6, LockVault.LockTier.THIRTY);

        // Very early (1 second in)
        vm.warp(block.timestamp + 1);

        uint256 balBefore = vault.balanceOf(alice);
        vm.prank(alice);
        lockVault.earlyWithdraw(posId);

        uint256 returned = vault.balanceOf(alice) - balBefore;
        // Nearly full penalty: ~10% of 10000 = ~9000
        // remaining ≈ 30 days, so penaltyBps ≈ 1000 (nearly full)
        assertTrue(returned < 9100e6, "should get less due to penalty");
        assertTrue(returned > 8900e6, "shouldn't lose more than ~10%");
    }

    function test_earlyWithdraw_lastDay_minimalPenalty() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(10_000e6, LockVault.LockTier.THIRTY);

        // 29 days in (1 day remaining)
        vm.warp(block.timestamp + 29 days);

        uint256 balBefore = vault.balanceOf(alice);
        vm.prank(alice);
        lockVault.earlyWithdraw(posId);

        uint256 returned = vault.balanceOf(alice) - balBefore;
        // remaining=1/30 of penalty: ~0.33% of 10000 ≈ 33 USDC
        assertTrue(returned > 9900e6, "minimal penalty expected");
    }

    function test_earlyWithdraw_afterMaturity_reverts() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        vm.warp(block.timestamp + 31 days);

        vm.prank(alice);
        vm.expectRevert("LockVault: already matured");
        lockVault.earlyWithdraw(posId);
    }

    // ── Fee Distribution ──────────────────────────────────────────────────

    function test_distributeFees_singleLocker() public {
        vm.prank(alice);
        lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        // Distribute 100 USDC in fees
        lockVault.distributeFees(100e6);

        // Alice should have ~100 USDC pending (rounding from weighted share math)
        uint256 pending = lockVault.pendingReward(0);
        assertApproxEqAbs(pending, 100e6, 2); // allow 2 wei rounding
    }

    function test_distributeFees_multiTier_weightedDistribution() public {
        // Alice locks 1000 at 30d (1.1x multiplier), weighted = 1100
        vm.prank(alice);
        lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        // Bob locks 1000 at 90d (1.5x multiplier), weighted = 1500
        vm.prank(bob);
        lockVault.lock(1000e6, LockVault.LockTier.NINETY);

        // Distribute 260 USDC (to get nice numbers)
        // weighted_alice = 1000e6 * 11000 / 10000 = 1100e6
        // weighted_bob   = 1000e6 * 15000 / 10000 = 1500e6
        // total = 2600e6
        // Alice gets: 260e6 * 1100e6 / 2600e6 = 110e6
        // Bob gets:   260e6 * 1500e6 / 2600e6 = 150e6
        lockVault.distributeFees(260e6);

        uint256 alicePending = lockVault.pendingReward(0);
        uint256 bobPending = lockVault.pendingReward(1);

        assertEq(alicePending, 110e6);
        assertEq(bobPending, 150e6);
    }

    function test_claimFees() public {
        vm.prank(alice);
        lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        lockVault.distributeFees(100e6);

        // Unlock position to settle rewards
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        lockVault.unlock(0);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        lockVault.claimFees();

        assertApproxEqAbs(usdc.balanceOf(alice) - balBefore, 100e6, 2);
    }

    function test_claimFees_nothingToClaim_reverts() public {
        vm.prank(alice);
        vm.expectRevert("LockVault: nothing to claim");
        lockVault.claimFees();
    }

    function test_distributeFees_noLockers_reverts() public {
        vm.expectRevert("LockVault: no locked shares");
        lockVault.distributeFees(100e6);
    }

    // ── settleRewards (consolidated from former harvest) ───────────────

    function test_settleRewards_checkpointsWithoutUnlocking() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        lockVault.distributeFees(100e6);

        // Settle rewards without unlocking
        vm.prank(alice);
        lockVault.settleRewards(posId);

        // Position still open
        assertEq(lockVault.getPosition(posId).shares, 1000e6);
        // Rewards checkpointed
        assertApproxEqAbs(lockVault.pendingRewards(alice), 100e6, 2);
    }

    function test_settleRewards_revertsForNonOwner() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        vm.prank(bob);
        vm.expectRevert("LockVault: not owner");
        lockVault.settleRewards(posId);
    }

    function test_rewardDebt_preventsDoubleCounting() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        lockVault.distributeFees(100e6);

        // Settle once
        vm.prank(alice);
        lockVault.settleRewards(posId);
        uint256 afterFirst = lockVault.pendingRewards(alice);

        // Settle again without new fees — should not add more
        vm.prank(alice);
        lockVault.settleRewards(posId);
        assertEq(lockVault.pendingRewards(alice), afterFirst);
    }

    // ── sweepPenaltyShares ──────────────────────────────────────────────

    function test_sweepPenaltyShares_recoversStrandedShares() public {
        // Simulate stranded penalty shares by transferring vUSDC directly to lockVault
        vm.prank(alice);
        IERC20(address(vault)).transfer(address(lockVault), 50e6);

        // No locked positions, so all vUSDC in lockVault is penalty shares
        uint256 receiverBefore = vault.balanceOf(address(vault));
        lockVault.sweepPenaltyShares(address(vault));
        assertEq(vault.balanceOf(address(vault)) - receiverBefore, 50e6);
    }

    function test_sweepPenaltyShares_revertsIfNoPenalty() public {
        vm.expectRevert("LockVault: no penalty shares");
        lockVault.sweepPenaltyShares(address(vault));
    }

    function test_sweepPenaltyShares_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        lockVault.sweepPenaltyShares(address(vault));
    }

    // ── Penalty shares go to HouseVault ────────────────────────────────

    function test_earlyWithdraw_penaltySharesGoToHouseVault() public {
        vm.prank(alice);
        lockVault.lock(10_000e6, LockVault.LockTier.THIRTY);

        uint256 vaultSharesBefore = vault.balanceOf(address(vault));

        // Warp 15 days (50% through)
        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        lockVault.earlyWithdraw(0);

        // LockVault should be empty (all shares transferred out)
        assertEq(vault.balanceOf(address(lockVault)), 0);
        // Penalty shares (500e6) transferred to HouseVault (increases LP value)
        assertEq(vault.balanceOf(address(vault)) - vaultSharesBefore, 500e6);
    }

    // ── Edge Cases ──────────────────────────────────────────────────────

    function test_settleRewards_zeroReward_noRevert() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        // Settle without distributing any fees — should not revert
        vm.prank(alice);
        lockVault.settleRewards(posId);

        assertEq(lockVault.pendingRewards(alice), 0);
    }

    function test_unlock_zeroAccumulatedRewards() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        vm.warp(block.timestamp + 31 days);

        // Unlock without any fee distributions — reward accounting should be clean
        vm.prank(alice);
        lockVault.unlock(posId);

        assertEq(lockVault.pendingRewards(alice), 0);
        assertEq(vault.balanceOf(alice), 10_000e6); // all shares returned
    }

    function test_earlyWithdraw_settlesRewards() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        lockVault.distributeFees(100e6);

        vm.warp(block.timestamp + 15 days);

        vm.prank(alice);
        lockVault.earlyWithdraw(posId);

        // Rewards should still have been settled via _settleRewards
        assertApproxEqAbs(lockVault.pendingRewards(alice), 100e6, 2);
    }

    function test_lock_multiplePositions_sameUser() public {
        vm.prank(alice);
        uint256 pos0 = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);
        vm.prank(alice);
        uint256 pos1 = lockVault.lock(2000e6, LockVault.LockTier.NINETY);

        assertEq(lockVault.totalLockedShares(), 3000e6);

        lockVault.distributeFees(260e6);

        // Unlock first position only
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        lockVault.unlock(pos0);

        assertEq(lockVault.totalLockedShares(), 2000e6);

        // Second position rewards should be intact
        uint256 pending1 = lockVault.pendingReward(pos1);
        assertGt(pending1, 0, "second position should have pending rewards");
    }

    function test_unlock_exactMaturityBoundary() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        LockVault.LockPosition memory pos = lockVault.getPosition(posId);

        // Warp to exactly unlockAt
        vm.warp(pos.unlockAt);

        // Should succeed at exact maturity timestamp
        vm.prank(alice);
        lockVault.unlock(posId);

        assertEq(lockVault.totalLockedShares(), 0);
    }

    function test_settleRewards_emitsHarvestedEvent() public {
        vm.prank(alice);
        uint256 posId = lockVault.lock(1000e6, LockVault.LockTier.THIRTY);

        lockVault.distributeFees(100e6);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit LockVault.Harvested(posId, alice, 0); // amount checked loosely
        lockVault.settleRewards(posId);
    }
}
