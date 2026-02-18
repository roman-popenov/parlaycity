// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HouseVault} from "./HouseVault.sol";

/// @title LockVault
/// @notice Accepts vUSDC shares from HouseVault. Users lock for a tier period
///         to earn boosted fee share. Uses Synthetix-style reward distribution
///         weighted by tier multipliers.
contract LockVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Enums ────────────────────────────────────────────────────────────

    enum LockTier {
        THIRTY, // 30 days  -> 1.1x multiplier
        SIXTY, // 60 days  -> 1.25x multiplier
        NINETY // 90 days  -> 1.5x multiplier

    }

    // ── Structs ──────────────────────────────────────────────────────────

    struct LockPosition {
        address owner;
        uint256 shares; // vUSDC shares locked
        LockTier tier;
        uint256 lockedAt;
        uint256 unlockAt;
        uint256 feeMultiplierBps; // 11000 = 1.1x, 12500 = 1.25x, 15000 = 1.5x
        uint256 rewardDebt; // Snapshot of accRewardPerWeightedShare at entry
    }

    // ── Constants ────────────────────────────────────────────────────────

    uint256 private constant PRECISION = 1e18;
    uint256 private constant BPS_BASE = 10_000;
    uint256 public constant MIN_LOCK = 1e6; // 1 vUSDC

    // ── State ────────────────────────────────────────────────────────────

    HouseVault public vault;
    IERC20 public vUSDC; // same as vault token (ERC20)

    mapping(uint256 => LockPosition) public positions;
    uint256 public nextPositionId;

    /// @notice Accumulated rewards per weighted share (scaled by PRECISION).
    uint256 public accRewardPerWeightedShare;

    /// @notice Sum of (position.shares * feeMultiplierBps / BPS_BASE) for all positions.
    uint256 public totalWeightedShares;

    /// @notice Total vUSDC shares locked across all positions.
    uint256 public totalLockedShares;

    /// @notice Base early withdrawal penalty in bps (default 10%).
    uint256 public basePenaltyBps = 1000;

    /// @notice Address authorized to push fee distributions (typically HouseVault).
    address public feeDistributor;

    /// @notice Accumulated claimable rewards per user.
    mapping(address => uint256) public pendingRewards;

    // ── Events ───────────────────────────────────────────────────────────

    event Locked(uint256 indexed positionId, address indexed owner, uint256 shares, LockTier tier, uint256 unlockAt);
    event Unlocked(uint256 indexed positionId, address indexed owner, uint256 shares);
    event EarlyWithdraw(
        uint256 indexed positionId, address indexed owner, uint256 sharesReturned, uint256 penaltyShares
    );
    event PenaltySharesSwept(address indexed receiver, uint256 shares);
    event FeesDistributed(uint256 amount, uint256 newAccRewardPerWeightedShare);
    event RewardsClaimed(address indexed user, uint256 amount);
    event Harvested(uint256 indexed positionId, address indexed owner, uint256 reward);
    event BasePenaltyUpdated(uint256 oldPenalty, uint256 newPenalty);
    event FeeDistributorSet(address indexed distributor);

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(HouseVault _vault) Ownable(msg.sender) {
        vault = _vault;
        vUSDC = IERC20(address(_vault));
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setBasePenalty(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "LockVault: penalty too high");
        emit BasePenaltyUpdated(basePenaltyBps, _bps);
        basePenaltyBps = _bps;
    }

    function setFeeDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "LockVault: zero address");
        feeDistributor = _distributor;
        emit FeeDistributorSet(_distributor);
    }

    // ── Core ─────────────────────────────────────────────────────────────

    /// @notice Lock vUSDC shares for a given tier period.
    function lock(uint256 shares, LockTier tier) external nonReentrant returns (uint256 positionId) {
        require(shares >= MIN_LOCK, "LockVault: lock below minimum");

        vUSDC.safeTransferFrom(msg.sender, address(this), shares);

        uint256 multiplierBps = _tierMultiplier(tier);
        uint256 duration = _tierDuration(tier);
        uint256 unlockAt = block.timestamp + duration;

        uint256 weighted = (shares * multiplierBps) / BPS_BASE;
        totalWeightedShares += weighted;
        totalLockedShares += shares;

        positionId = nextPositionId++;
        positions[positionId] = LockPosition({
            owner: msg.sender,
            shares: shares,
            tier: tier,
            lockedAt: block.timestamp,
            unlockAt: unlockAt,
            feeMultiplierBps: multiplierBps,
            rewardDebt: (weighted * accRewardPerWeightedShare) / PRECISION
        });

        emit Locked(positionId, msg.sender, shares, tier, unlockAt);
    }

    /// @notice Unlock shares after maturity. Full shares returned.
    function unlock(uint256 positionId) external nonReentrant {
        LockPosition storage pos = positions[positionId];
        require(pos.owner == msg.sender, "LockVault: not owner");
        require(pos.shares > 0, "LockVault: empty position");
        require(block.timestamp >= pos.unlockAt, "LockVault: still locked");

        uint256 shares = pos.shares;
        _settleRewards(positionId);
        _removePosition(positionId);

        vUSDC.safeTransfer(msg.sender, shares);
        emit Unlocked(positionId, msg.sender, shares);
    }

    /// @notice Early withdrawal with linear penalty.
    function earlyWithdraw(uint256 positionId) external nonReentrant {
        LockPosition storage pos = positions[positionId];
        require(pos.owner == msg.sender, "LockVault: not owner");
        require(pos.shares > 0, "LockVault: empty position");
        require(block.timestamp < pos.unlockAt, "LockVault: already matured");

        uint256 shares = pos.shares;
        _settleRewards(positionId);

        // Linear penalty: penaltyBps = basePenaltyBps * daysRemaining / totalTierDays
        uint256 totalDuration = _tierDuration(pos.tier);
        uint256 elapsed = block.timestamp - pos.lockedAt;
        uint256 remaining = totalDuration - elapsed;
        uint256 penaltyBps = (basePenaltyBps * remaining) / totalDuration;
        uint256 penaltyShares = (shares * penaltyBps) / BPS_BASE;
        uint256 returned = shares - penaltyShares;

        _removePosition(positionId);

        // Return net shares to user; penalty shares stay in contract and
        // accumulate as surplus (balance - totalLockedShares) for sweeping.
        vUSDC.safeTransfer(msg.sender, returned);
        emit EarlyWithdraw(positionId, msg.sender, returned, penaltyShares);
    }

    /// @notice Settle accrued rewards for an active position without unlocking.
    ///         Replaces the former `harvest()` — identical behavior, single entry point.
    function settleRewards(uint256 positionId) external nonReentrant {
        LockPosition storage pos = positions[positionId];
        require(pos.owner == msg.sender, "LockVault: not owner");
        require(pos.shares > 0, "LockVault: empty position");
        uint256 pendingBefore = pendingRewards[msg.sender];
        _settleRewards(positionId);
        uint256 reward = pendingRewards[msg.sender] - pendingBefore;
        emit Harvested(positionId, msg.sender, reward);
    }

    /// @notice Distribute fee income proportionally to weighted locked shares.
    ///         Called by owner/keeper -- pulls USDC from msg.sender.
    function distributeFees(uint256 amount) external onlyOwner nonReentrant {
        require(totalWeightedShares > 0, "LockVault: no locked shares");
        require(amount > 0, "LockVault: zero amount");

        // Transfer USDC fee income into this contract
        IERC20 usdc = vault.asset();
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        accRewardPerWeightedShare += (amount * PRECISION) / totalWeightedShares;
        emit FeesDistributed(amount, accRewardPerWeightedShare);
    }

    /// @notice Notify the LockVault of fee income already transferred to this contract.
    ///         Called by the feeDistributor (typically HouseVault) after pushing USDC.
    function notifyFees(uint256 amount) external nonReentrant {
        require(msg.sender == feeDistributor, "LockVault: caller is not fee distributor");
        require(amount > 0, "LockVault: zero amount");
        if (totalWeightedShares == 0) return; // no lockers to reward, USDC stays as surplus

        accRewardPerWeightedShare += (amount * PRECISION) / totalWeightedShares;
        emit FeesDistributed(amount, accRewardPerWeightedShare);
    }

    /// @notice Claim accumulated USDC rewards.
    function claimFees() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "LockVault: nothing to claim");

        pendingRewards[msg.sender] = 0;
        IERC20 usdc = vault.asset();
        usdc.safeTransfer(msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount);
    }

    /// @notice Sweep accumulated penalty shares to a receiver for redistribution.
    function sweepPenaltyShares(address receiver) external onlyOwner nonReentrant {
        require(receiver != address(0), "LockVault: zero receiver");
        uint256 balance = vUSDC.balanceOf(address(this));
        require(balance > totalLockedShares, "LockVault: no penalty shares");
        uint256 penaltyShares = balance - totalLockedShares;
        vUSDC.safeTransfer(receiver, penaltyShares);
        emit PenaltySharesSwept(receiver, penaltyShares);
    }

    // ── Views ────────────────────────────────────────────────────────────

    function getPosition(uint256 positionId) external view returns (LockPosition memory) {
        return positions[positionId];
    }

    function pendingReward(uint256 positionId) external view returns (uint256) {
        LockPosition memory pos = positions[positionId];
        if (pos.shares == 0) return 0;
        uint256 weighted = (pos.shares * pos.feeMultiplierBps) / BPS_BASE;
        return ((weighted * accRewardPerWeightedShare) / PRECISION) - pos.rewardDebt;
    }

    // ── Internal ─────────────────────────────────────────────────────────

    function _settleRewards(uint256 positionId) internal {
        LockPosition storage pos = positions[positionId];
        uint256 weighted = (pos.shares * pos.feeMultiplierBps) / BPS_BASE;
        uint256 accumulated = (weighted * accRewardPerWeightedShare) / PRECISION;
        uint256 pending = accumulated - pos.rewardDebt;
        if (pending > 0) {
            pendingRewards[pos.owner] += pending;
        }
        pos.rewardDebt = accumulated;
    }

    function _removePosition(uint256 positionId) internal {
        LockPosition storage pos = positions[positionId];
        uint256 weighted = (pos.shares * pos.feeMultiplierBps) / BPS_BASE;
        totalWeightedShares -= weighted;
        totalLockedShares -= pos.shares;
        pos.shares = 0;
        pos.owner = address(0);
    }

    function _tierMultiplier(LockTier tier) internal pure returns (uint256) {
        if (tier == LockTier.THIRTY) return 11000; // 1.1x
        if (tier == LockTier.SIXTY) return 12500; // 1.25x
        return 15000; // 1.5x (NINETY)
    }

    function _tierDuration(LockTier tier) internal pure returns (uint256) {
        if (tier == LockTier.THIRTY) return 30 days;
        if (tier == LockTier.SIXTY) return 60 days;
        return 90 days; // NINETY
    }
}
