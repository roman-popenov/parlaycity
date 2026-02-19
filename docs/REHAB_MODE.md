# Rehab Mode: Loser-to-LP Conversion

**Status: PLANNED.** This document specifies the full rehab mode mechanism -- converting losing gamblers into vault liquidity providers through force-locked positions with yield.

## Core Concept

When a gambler loses a parlay bet, 10% of their stake is not simply absorbed by the vault. Instead, it is converted to vUSDC shares and force-locked for 120 days in a special rehab lock tier. During this period, the locked shares earn fee income (like any other LockVault position) and benefit from vault yield (including Uniswap LP income). After 120 days, the gambler can withdraw their shares or re-lock for a boosted tier.

**The thesis:** A gambler who experiences forced exposure to LP economics for 120 days may choose to become a voluntary LP. The rehab lock is not punitive -- it is educational. The gambler earns real yield on their locked stake, sees the vault mechanics from the LP side, and has a clear path to continue as an LP after the lock expires.

## Economics Flow

From `docs/ECONOMICS.md`, when a gambler loses a $100 stake:

```
$100 losing stake
  |-- $80 (80%)  -> stays in vault (LP share price appreciation)
  |-- $10 (10%)  -> AMM liquidity pool (see docs/UNISWAP_LP_STRATEGY.md)
  |-- $10 (10%)  -> rehab lock (force-locked vUSDC for 120 days)
```

### The $10 Rehab Flow (step by step)

1. **Settlement triggers loss distribution.** When `settleTicket()` determines a loss, ParlayEngine calls `HouseVault.distributeLoss(stake)` (new function).
2. **Vault mints vUSDC shares.** The $10 rehab portion is used to mint vUSDC shares at the current share price. These shares represent a claim on vault capital.
3. **Shares are force-locked.** The newly minted vUSDC shares are deposited into LockVault under the gambler's address with a special `REHAB` tier (120-day lock, 1.0x initial weight).
4. **Gambler earns fee income.** The rehab lock participates in the Synthetix-style fee distribution exactly like any other lock. The 1.0x weight means rehab lockers earn at the base rate (less than Bronze 1.1x, Silver 1.25x, Gold 1.5x).
5. **After 120 days:** Gambler can withdraw their vUSDC shares (redeem for USDC) OR re-lock at a boosted 1.55x weight for another 120 days.

### Why 1.0x Weight Initially

The rehab lock starts at 1.0x weight (lower than all voluntary tiers) because:
- The capital was not voluntarily committed -- it was force-locked from a losing bet
- Starting below Bronze (1.1x) creates an incentive to voluntarily upgrade
- The re-lock at 1.55x is the highest weight in the system, rewarding the choice to stay

### Re-lock Incentive

After the initial 120-day lock expires:

| Choice | Weight | Duration | Outcome |
|--------|--------|----------|---------|
| Withdraw | N/A | Immediate | Gambler gets USDC back, rehab complete |
| Re-lock (Rehab+) | 1.55x | 120 days | Highest weight tier, max fee income |
| Convert to Gold | 1.50x | 90 days | Standard Gold tier, shorter lock |

The 1.55x re-lock weight is deliberately higher than Gold (1.5x) to reward gamblers who choose to stay as LPs. This is the only way to access the 1.55x tier.

## Contract Changes

### LockVault Modifications

```solidity
// New tier constant
uint256 public constant REHAB_WEIGHT = 10_000;    // 1.0x (no boost)
uint256 public constant REHAB_PLUS_WEIGHT = 15_500; // 1.55x
uint256 public constant REHAB_DURATION = 120 days;

// New lock type flag
enum LockTier { THIRTY_DAY, SIXTY_DAY, NINETY_DAY, REHAB, REHAB_PLUS }

struct LockInfo {
    uint256 shares;
    uint256 unlockTime;
    uint256 weightedShares;
    LockTier tier;           // NEW: track tier type (REHAB/REHAB_PLUS derivable from this)
}

// Helper to check rehab-origin locks (replaces redundant isRehab bool)
function _isRehabTier(LockTier tier) internal pure returns (bool) {
    return tier == LockTier.REHAB || tier == LockTier.REHAB_PLUS;
}
```

New functions:

```solidity
/// @notice Called by HouseVault during loss distribution.
///         Force-locks vUSDC shares for the losing gambler.
/// @param user The gambler's address (ticket owner)
/// @param shares Amount of vUSDC shares to lock
function rehabLock(address user, uint256 shares) external onlyVault {
    require(shares > 0, "LockVault: zero shares");

    // Transfer shares from vault to this contract
    vUSDC.safeTransferFrom(msg.sender, address(this), shares);

    // Checkpoint accrued rewards BEFORE modifying totalWeightedShares.
    // Without this, the Synthetix-style accumulator would silently
    // recalculate all existing lockers' pending rewards using the new
    // denominator, causing incorrect payouts.
    _settleRewards(user);

    uint256 weightedShares = shares * REHAB_WEIGHT / 10_000;
    totalWeightedShares += weightedShares;

    locks[user].push(LockInfo({
        shares: shares,
        unlockTime: block.timestamp + REHAB_DURATION,
        weightedShares: weightedShares,
        tier: LockTier.REHAB
    }));

    emit RehabLocked(user, shares, block.timestamp + REHAB_DURATION);
}

/// @notice Re-lock an expired rehab position at the boosted 1.55x weight.
/// @param lockIndex Index of the rehab lock to re-lock
function rehabRelock(uint256 lockIndex) external nonReentrant {
    LockInfo storage lock = locks[msg.sender][lockIndex];
    require(_isRehabTier(lock.tier), "LockVault: not a rehab lock");
    require(block.timestamp >= lock.unlockTime, "LockVault: still locked");

    // Checkpoint accrued rewards BEFORE modifying totalWeightedShares.
    _settleRewards(msg.sender);

    // Remove old weighted shares, apply boosted weight
    totalWeightedShares -= lock.weightedShares;
    uint256 newWeightedShares = lock.shares * REHAB_PLUS_WEIGHT / 10_000;
    totalWeightedShares += newWeightedShares;

    lock.unlockTime = block.timestamp + REHAB_DURATION;
    lock.weightedShares = newWeightedShares;
    lock.tier = LockTier.REHAB_PLUS;

    emit RehabRelocked(msg.sender, lockIndex, lock.shares, newWeightedShares);
}
```

### HouseVault Modifications

New function for loss distribution:

```solidity
/// @notice Distribute a losing stake according to the 80/10/10 split.
/// @param stake The full losing stake amount in USDC
/// @param ticketOwner The gambler who lost (receives rehab lock)
function distributeLoss(uint256 stake, address ticketOwner) external onlyEngine {
    uint256 toLPs = stake * lossToLPBps / 10_000;        // 80%
    uint256 toAMM = stake * lossToAMMBps / 10_000;       // 10%
    uint256 toRehab = stake - toLPs - toAMM;              // 10% (remainder to avoid rounding loss)

    // toLPs: stays in vault implicitly (already here from safeTransferFrom during buyTicket)

    // toAMM: transfer to a SEPARATE AMMRouter contract (NOT the vault's yieldAdapter).
    // Using yieldAdapter.deploy() would keep this capital in totalAssets() via
    // yieldAdapter.balance(), making LPs effectively retain ~90% (80% + 10% via adapter)
    // instead of the intended 80%. The AMMRouter is not counted in totalAssets().
    if (toAMM > 0 && address(ammRouter) != address(0)) {
        asset.safeTransfer(address(ammRouter), toAMM);
        ammRouter.deployToLP(toAMM);
        emit LossToAMM(toAMM);
    }

    // toRehab: mint vUSDC shares, force-lock in LockVault
    if (toRehab > 0 && address(lockVault) != address(0)) {
        // Mint vUSDC shares for the rehab amount
        uint256 shares = _convertToShares(toRehab);
        _mint(address(this), shares);

        // Approve and lock in LockVault
        IERC20(address(this)).approve(address(lockVault), shares);
        lockVault.rehabLock(ticketOwner, shares);
        emit LossToRehab(ticketOwner, toRehab, shares);
    }

    emit LossDistributed(stake, toLPs, toAMM, toRehab);
}
```

### ParlayEngine Modifications

In `settleTicket()`, when the ticket loses:

```solidity
// Existing: release reserved liability
vault.releaseReserved(ticket.reservedPayout);

// NEW: trigger loss distribution
vault.distributeLoss(ticket.stake, ticket.owner);
```

### New Constants in HouseVault

```solidity
uint256 public lossToLPBps = 8000;     // 80%
uint256 public lossToAMMBps = 1000;    // 10%
// lossToRehabBps is implicit: 10_000 - lossToLPBps - lossToAMMBps = 1000 (10%)

address public lockVault;   // LockVault address for rehab locks
IAMMRouter public ammRouter; // Separate from yieldAdapter so AMM capital
                             // is NOT counted in totalAssets()
```

### IAMMRouter Interface

```solidity
/// @notice Routes losing-stake AMM capital to a Uniswap LP position.
///         Separate from IYieldAdapter so that deployed capital is NOT
///         counted in HouseVault.totalAssets() (preserving the 80/10/10 split).
interface IAMMRouter {
    /// @notice Deploy USDC into an AMM liquidity position.
    /// @param amount USDC amount to deploy
    function deployToLP(uint256 amount) external;

    /// @notice Withdraw USDC from the AMM position.
    /// @param amount USDC amount to withdraw (0 = all)
    /// @return withdrawn Actual USDC withdrawn
    function withdrawFromLP(uint256 amount) external returns (uint256 withdrawn);

    /// @notice Current USDC value held in the AMM position.
    function balance() external view returns (uint256);
}
```

## Frontend UX

### At Loss Moment (Crash Screen)

When a ticket settles as lost, the crash animation plays. After the crash:

```
Your ticket crashed.

Stake: $100.00
Lost:  -$100.00

But you're not empty-handed:

$10.00 has been locked as LP shares
Earning fees for the next 120 days

[View Your Rehab Lock]  [Become the House ->]
```

The "Become the House" CTA links to the vault page with a pre-filled deposit amount suggestion.

### Rehab Lock Dashboard

On the `/vault` page, add a "Rehab Locks" section:

```
Rehab Locks
-----------
Lock #1: 42.3 vUSDC ($43.18)
  Locked: Jan 15, 2026
  Unlocks: May 15, 2026 (87 days remaining)
  Fees earned: $1.23
  Weight: 1.0x

  [After unlock: Withdraw | Re-lock at 1.55x]

Lock #2: 18.7 vUSDC ($19.12)
  Locked: Dec 28, 2025
  UNLOCKED - Ready to claim
  Fees earned: $2.81
  Weight: 1.0x -> 1.55x available

  [Withdraw $19.12] [Re-lock at 1.55x (120 days)]
```

### Re-lock Prompt

When a rehab lock expires, show a prominent notification:

```
Your rehab lock has matured!

Original stake portion: $10.00
Current value: $10.83 (+8.3% from fees)

Options:
1. Withdraw $10.83 to your wallet
2. Re-lock at 1.55x weight for 120 days (highest fee tier!)
   Estimated additional income: ~$1.50 over 120 days

[Withdraw]  [Re-lock at 1.55x (Recommended)]
```

## Implementation Steps

### Phase A: Contract Changes (Priority 1)

1. **Add `LockTier` enum and `_isRehabTier()` helper to LockVault**
   - Modify `LockInfo` struct (tier enum only, no redundant bool)
   - Add `REHAB_WEIGHT`, `REHAB_PLUS_WEIGHT`, `REHAB_DURATION` constants
   - Add `rehabLock()` function (onlyVault, with `_settleRewards` checkpoint)
   - Add `rehabRelock()` function (user-callable, with `_settleRewards` checkpoint)
   - Update `unlock()` to handle rehab locks
   - Events: `RehabLocked`, `RehabRelocked`

2. **Add `distributeLoss()` to HouseVault**
   - New state: `lossToLPBps`, `lossToAMMBps`, `lockVault` address, `ammRouter` address
   - New function: `distributeLoss(uint256 stake, address ticketOwner)`
   - Owner setters: `setLossDistribution(uint256 lpBps, uint256 ammBps)`, `setLockVault(address)`, `setAMMRouter(address)`
   - Events: `LossDistributed`, `LossToAMM`, `LossToRehab`

3. **Modify ParlayEngine.settleTicket()**
   - After releasing reserved payout on a loss, call `vault.distributeLoss()`
   - This is a small change: ~3 lines in the loss branch

4. **Tests**
   - Unit: rehab lock/unlock/relock flows
   - Unit: loss distribution arithmetic (80/10/10 split)
   - Fuzz: loss distribution with variable stakes
   - Invariant: totalWeightedShares consistency after rehab operations
   - Integration: full lifecycle (buy -> lose -> rehab lock -> earn fees -> relock or withdraw)

### Phase B: Uniswap Yield Adapter (Priority 2)

See `docs/UNISWAP_LP_STRATEGY.md` for full implementation plan.

### Phase C: Frontend (Priority 3)

1. Rehab lock section on `/vault` page
2. Crash screen CTA with lock notification
3. Re-lock prompt with APR estimate
4. "Become the House" conversion funnel

### Phase D: Stretch Goals

1. **Automatic re-range bot** for UniswapYieldAdapter (if price exits range)
2. **Rehab analytics dashboard** -- conversion rate from rehab to voluntary LP
3. **Graduated rehab tiers** -- multiple losses increase lock duration but also increase re-lock weight
4. **Social good routing** -- the 10% "social good" portion from economics spec (currently combined with rehab in this design; could be separated into a distinct GoodCause contract)

## Open Questions

1. **Should rehab locks earn from the same fee pool as voluntary locks?** Current design: yes, at 1.0x weight. Alternative: separate fee pool for rehab (simpler accounting but less incentive to convert).

2. **What if the gambler has no wallet interaction for 120+ days?** The lock simply sits there earning fees. No action needed. When they return, they can withdraw or relock. No expiration on the withdrawal window.

3. **Minimum rehab amount.** If 10% of a $1 stake is $0.10, the gas cost of the lock exceeds the value. Set a `MIN_REHAB_AMOUNT` (e.g., $1) below which the rehab portion stays in the vault as LP profit instead.

4. **vUSDC share price changes during lock.** The locked shares are in vUSDC, which floats with vault performance. If the vault has a bad period (many gambler wins), the share price drops and the rehab lock loses value. This is by design -- the gambler experiences LP economics fully, including downside.

## Security Considerations

- **Reentrancy:** `distributeLoss` calls external contracts (yieldAdapter, lockVault). Must follow CEI pattern. Both calls are to trusted protocol contracts, but ReentrancyGuard is still applied.
- **Share minting:** `_mint(address(this), shares)` in the vault creates new shares without a corresponding deposit. This is correct because the USDC is already in the vault (from the gambler's stake). The shares represent a claim on existing capital, not new capital.
- **Integer arithmetic:** Loss distribution uses BPS (1e4). The remainder pattern (`toRehab = stake - toLPs - toAMM`) ensures no dust is lost to rounding.
- **Access control:** `rehabLock()` is `onlyVault`. `rehabRelock()` is user-callable (only on their own locks). `distributeLoss()` is `onlyEngine`.
