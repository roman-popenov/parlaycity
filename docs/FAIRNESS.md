# Provable On-Chain Fairness

How ParlayCity ensures fairness for gamblers, with on-chain evidence for every claim.

---

## 1. Provably Fair Odds

The multiplier is computed from on-chain probability data using pure math:

```
multiplier = product(1,000,000 / probability_i) for each leg
payout     = (stake - fee) * multiplier
```

**On-chain:** `ParlayMath.computeMultiplier(uint256[] memory probabilitiesPPM)`
**Off-chain mirror:** `packages/shared/src/math.ts` -- identical integer arithmetic

There is no hidden vig adjustment, no odds manipulation, no "we moved the line because too many people bet one side." The probability data comes from the LegRegistry, set at leg creation and verifiable by anyone. The math is deterministic: given the same inputs, anyone running the same code gets the same output.

**Verification:** Read `ParlayMath.sol`. Run the TypeScript mirror with the same inputs. The results must be identical. This is enforced by parity tests in the test suite.

---

## 2. Fee Transparency

ParlayCity's fee is a separate, visible line item:

```
Fee = stake * (baseFee + perLegFee * numLegs) / 10,000
```

| Legs | Fee | Effective Cost |
|------|-----|----------------|
| 2 | 200 bps | 2.0% |
| 3 | 250 bps | 2.5% |
| 4 | 300 bps | 3.0% |
| 5 | 350 bps | 3.5% |

Compare to traditional sportsbooks:

| Platform | How the Fee Works | Visible to Bettor? |
|----------|------------------|-------------------|
| DraftKings | 17-35% vig embedded in adjusted odds | No |
| FanDuel | 17-35% vig embedded in adjusted odds | No |
| BetMGM | 17-35% vig embedded in adjusted odds | No |
| Overtime Markets | ~5% spread on odds | Partially |
| **ParlayCity** | **2-3.5% explicit fee, separate from odds** | **Yes, on-chain** |

The gambler sees exactly what they're paying. The fee goes to the people providing liquidity (90%), an insurance buffer (5%), and the vault (5%). Zero goes to a team wallet.

---

## 3. No Account Bans, No Limits

Centralized sportsbooks routinely limit or ban winning accounts. This is well-documented industry practice -- sharp bettors who consistently win find their accounts restricted, maximum bet sizes reduced, or accounts closed entirely.

ParlayCity is a smart contract. It cannot:
- Identify "winning" accounts
- Adjust odds per-user
- Reduce bet limits for specific wallets
- Prevent anyone from placing bets
- Prevent anyone from claiming payouts

**On-chain:** `settleTicket()` and `claimPayout()` have no access control beyond ticket ownership. Settlement is permissionless -- literally anyone can call `settleTicket(ticketId)` for any ticket. There is no keeper dependency.

---

## 4. Cashout Pricing (Fair Value Minus Spread)

The crash-parlay cashout gives bettors a fair exit price based on remaining probability:

```
V_fair    = potentialPayout * P_remaining
V_cashout = V_fair * (1 - cashoutFeeBps - riskSpreadBps)
```

Where:
- `P_remaining` = product of implied probabilities for unresolved legs
- `cashoutFeeBps` = explicit cashout fee (small, visible)
- `riskSpreadBps` = compensation for vault taking on residual risk
- `minOut` parameter = slippage protection (bettor sets minimum acceptable payout)

The cashout value is computed deterministically from on-chain data. The bettor can verify:
1. What `P_remaining` is (read unresolved leg probabilities from LegRegistry)
2. What the fee and spread are (read from contract parameters)
3. Whether `V_cashout` matches the formula (run ParlayMath locally)

If the bettor disagrees with the cashout price, they can simply not cash out and let the ticket run to settlement.

---

## 5. Expertise Matters (Not Just Luck)

ParlayCity rewards knowledge in two dimensions:

### Dimension 1: Picking Legs
A bettor who correctly identifies that a star quarterback is undervalued, that weather will suppress scoring, and that a specific underdog has better odds than the line suggests -- that bettor has genuine expertise. With a 2-3.5% fee and fair-odds multipliers, a bettor with genuine edge has a positive expected value.

### Dimension 2: Timing Exits
The cashout mechanic adds position management as a skill. Knowing when to exit a winning position is the same skill that separates good traders from bad ones. A bettor who understands implied probability can compute whether remaining legs justify holding vs cashing out.

This means ParlayCity is not pure gambling. It is a skill-augmented betting instrument where the protocol doesn't need every bettor to lose -- it needs the aggregate house edge to be positive, which it is structurally.

---

## 6. On-Chain Verification Checklist

Any skeptical judge or user can verify these claims independently:

| Claim | How to Verify |
|-------|--------------|
| Fair odds | Read `ParlayMath.computeMultiplier()`, run with same inputs, compare output |
| Explicit fee | Read `ParlayEngine.baseFee` and `perLegFee` storage slots |
| No hidden vig | Compare ParlayMath output to theoretical fair value (1/product of probabilities) |
| No account bans | Check `settleTicket()` for access control modifiers (there are none) |
| No admin drain | Search HouseVault for withdraw functions callable by owner (there are none) |
| Fee routing | Read FeeRouter split constants: 9000/500/500 (90/5/5) |
| Solvency invariant | Run `VaultInvariant.t.sol` -- fuzzes `totalReserved <= totalAssets()` |
| Math parity | Run `make test-all` -- parity tests compare Solidity vs TypeScript output |

---

## Narrative for Judges

"Every number the bettor sees is computed from on-chain data using open-source math. The same math runs in the contract, in the UI, and in the test suite. The fee is explicit, small, and visible. We can't ban anyone, adjust anyone's odds, or drain anyone's funds. The protocol is a verifiable machine."
