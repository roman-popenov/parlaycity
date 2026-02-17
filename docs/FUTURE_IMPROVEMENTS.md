# Future Improvements

Protocol enhancements beyond hackathon scope. These build on the existing architecture without breaking changes.

---

## 1. Admin Dashboard

**Current state:** Fee params (`baseFee`, `perLegFee`, `maxLegs`, `minStake`, `maxPayoutBps`) are set at deploy time. The contract already has admin setters, but no UI to call them.

**Improvement:**
- Admin page gated by `owner()` check
- Read current params from contract, update via setters
- Frontend fee display should read from contract instead of hardcoded `PARLAY_CONFIG`
- Constructor should accept fee params instead of hardcoding defaults

---

## 2. Dynamic Max Payout

**Current state:** Max payout per ticket = 5% of TVL (`maxPayoutBps = 500`). On a $10k vault, max payout = $500. A 57x parlay is capped at ~$8.77 stake.

**Problem:** This limits excitement on high-multiplier parlays. Small vaults restrict ticket sizes.

**Possible approaches:**
- **Graduated tiers:** 5% for payouts under $1k, 3% for $1k-$5k, 1% above $5k
- **TVL-scaled curve:** As TVL grows, `maxPayoutBps` increases (e.g., 500 at $10k TVL, 1000 at $100k TVL)
- **Per-ticket risk scoring:** Higher-probability parlays get larger max payouts since they're less likely to pay out

---

## 3. Dynamic Fee Scaling

**Current state:** Flat fee = `baseFee + perLegFee * numLegs` regardless of vault utilization.

**Improvement:** Scale fees with utilization to create natural back-pressure:

```
effectiveFeeBps = baseFee * (1 + utilization / TARGET_UTIL)
```

Example: At 50% utilization with `TARGET_UTIL = 50%`, fees double. At 70%, fees triple. This:
- Discourages heavy betting when the vault is stressed
- Creates higher yield for LPs during high-demand periods
- Self-regulates without admin intervention

Implementation: Add `dynamicFee()` view function to `ParlayEngine` that reads vault utilization on each `buyTicket` call.

---

## 4. Payout Tiers & Jackpot Pool

**Problem:** A single 200x payout can wreck the vault. Capping multipliers kills the fun.

**Improvement:** Split large payouts into immediate + jackpot:

- **Immediate payout:** Up to 50x of stake, paid instantly from vault
- **Jackpot overflow:** Anything above 50x goes into a jackpot pool
- **Jackpot distribution:** Pool pays out over time (e.g., weekly draws, or streamed via a vesting schedule)

This lets users build massive multiplier parlays for excitement while protecting vault solvency. The jackpot pool could be a separate contract that accumulates overflow and distributes via epochs.

---

## 5. On-Chain Fee Config in Constructor

**Current state:** `ParlayEngine` constructor doesn't accept fee params:

```solidity
constructor(HouseVault _vault, LegRegistry _registry, IERC20 _usdc, uint256 _bootstrapEndsAt)
```

**Improvement:** Accept initial fee configuration:

```solidity
constructor(
    HouseVault _vault,
    LegRegistry _registry,
    IERC20 _usdc,
    uint256 _bootstrapEndsAt,
    uint256 _baseFee,
    uint256 _perLegFee,
    uint256 _minStake,
    uint256 _maxLegs
)
```

This makes deployments configurable without post-deploy admin calls.

---

## 6. LockVault Economic Model Redesign

**Current state:** Users lock vUSDC shares for 30/60/90 days and receive a tier multiplier (1.1x/1.25x/1.5x) on fee distributions. Early withdrawal incurs a linear penalty on the locked principal. The locked capital is idle — it doesn't increase the vault's betting capacity or generate yield.

**Problems with the current model:**

1. **Tier multipliers are detached from real yield.** The 1.1x-1.5x weight boost on fee distributions can pay out more than the actual yield the locked capital generates, especially when fee volume is high relative to TVL. This makes the multipliers an unbacked promise.

2. **Locked capital doesn't improve vault capacity.** Locked vUSDC sits in the LockVault contract and doesn't count toward HouseVault's `totalAssets()` or `freeLiquidity()`. Locking actually *reduces* the vault's ability to underwrite bets, hurting both LPs and bettors.

3. **Early withdrawal penalty is on principal, not yield.** Losing 5-10% of deposited capital for exiting early is a steep cost, especially if the yield earned during the lock period was minimal. Penalties should be proportional to the benefit received.

**Proposed redesign:**

- **Locked shares should remain productive.** Instead of transferring vUSDC out of HouseVault, the LockVault could track lock commitments as a lien on shares — the capital stays in HouseVault contributing to TVL and betting capacity, while the lock prevents the user from withdrawing.

- **Yield-based rewards instead of multiplier-weighted fees.** Deploy locked capital into yield strategies (Aave, Compound, etc.) via the existing `IYieldAdapter` interface. Lock tier determines the *share of yield*, not an arbitrary multiplier. A 90-day locker gets a larger slice of actual yield generated, not a 1.5x weight on fee distributions.

- **Penalty applies to accrued yield, not principal.** Early withdrawal forfeits a portion of the *yield earned* during the lock, not the original deposit. This makes the risk/reward proportional — users risk their upside, not their capital.

- **Graduated unlock.** Instead of cliff unlock at maturity, allow partial unlocks (e.g., 25% after 1/4 of the period) to reduce the all-or-nothing early withdrawal problem.

**Implementation sketch:**
```
LockVault v2:
- lock() creates a commitment record (no vUSDC transfer)
- HouseVault tracks locked vs unlocked shares internally
- Yield adapter deploys locked portion
- settleRewards() distributes actual yield pro-rata by tier weight
- earlyWithdraw() forfeits (tier_weight * remaining_time / total_time) of accrued yield
- unlock() returns full principal + accrued yield
```

This requires coordinating with HouseVault changes (internal lock tracking, yield allocation) and is a significant refactor.

---

## Priority Order

1. **LockVault economic redesign** -- High priority, current model has structural issues
2. **Admin dashboard** -- Low effort, high value for demo polish
3. **Constructor params** -- Trivial change, improves deploy flexibility
4. **Dynamic fee scaling** -- Medium effort, strong DeFi mechanic
5. **Dynamic max payout** -- Medium effort, unlocks larger tickets
6. **Jackpot pool** -- High effort, major feature expansion
