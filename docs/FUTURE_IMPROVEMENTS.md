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

## Priority Order

1. **Admin dashboard** -- Low effort, high value for demo polish
2. **Constructor params** -- Trivial change, improves deploy flexibility
3. **Dynamic fee scaling** -- Medium effort, strong DeFi mechanic
4. **Dynamic max payout** -- Medium effort, unlocks larger tickets
5. **Jackpot pool** -- High effort, major feature expansion
