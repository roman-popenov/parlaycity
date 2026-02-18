# LP Seeding & Bootstrapping Plan

How ParlayCity convinces the first dollar to enter the vault, and how the vault grows from there.

---

## The Cold Start Problem

Every vault-as-counterparty protocol faces the same chicken-and-egg: bettors won't bet if the vault is too small (payouts are capped), and LPs won't deposit if there's no betting volume (no fee income). The solution is to make the vault safe at any size and bootstrap volume with a protocol seed.

## Strategy 1: Protocol-Seeded First Deposit

The deploy script seeds the vault with initial USDC atomically in the deployment transaction. The first external LP is never the sole counterparty.

**Precedent:** Overtime Markets bootstrapped with just 100K sUSD from the DAO treasury. From that seed:
- $8.7M in volume in year one
- +$230K profit (+106% cumulative return for Y1 LPs on Arbitrum)
- The seed was never at serious risk because utilization caps protected it

**Our approach:** Seed the vault with a meaningful amount (target: $10K-$100K depending on available capital). The caps automatically scale:

| Vault TVL | Max Single Payout (5%) | Max Total Reserved (80%) | Max Ticket Stake (approx) |
|-----------|----------------------|------------------------|--------------------------|
| $10K | $500 | $8K | ~$32 for a 15x parlay |
| $50K | $2,500 | $40K | ~$160 for a 15x parlay |
| $100K | $5,000 | $80K | ~$320 for a 15x parlay |
| $1M | $50,000 | $800K | ~$3,200 for a 15x parlay |

A gambler literally cannot place a bet large enough to drain a small vault. The caps are on-chain invariants, not promises.

## Strategy 2: Structural Edge Makes LPs Profitable

The math is structurally on the LP's side. Parlays have a 17-35% house edge because probabilities compound against the gambler:

| Parlay Legs | Per-Leg Probability | Combined Hit Rate | House Edge |
|-------------|--------------------|--------------------|------------|
| 2 legs | 50% | 25.0% | ~50% |
| 3 legs | 40% | 6.4% | ~84% |
| 4 legs | 40% | 2.6% | ~90% |
| 5 legs | 40% | 1.0% | ~94% |

The fee (2-3.5%) is additive on top of this structural edge. LPs earn from both:
1. **Fee income:** 5% of every fee stays in the vault (LP share price appreciation)
2. **Losing bets:** When gamblers lose (~94% of 3-leg parlays), the stake stays in the vault

**Comparable protocol returns (vault-as-counterparty models):**

| Protocol | Architecture | Returns |
|----------|-------------|---------|
| GMX GLP | Perps vault | ~25% APR from trading fees |
| Hyperliquid HLP | Perps vault | 42% CAGR lifetime, 450% cumulative |
| Overtime Markets | Sports AMM vault | 106% cumulative Y1 (Arbitrum, includes token incentives) |
| Gains Network gDAI | Perps vault | 10-20% variable APR |
| Azuro | Prediction market pool | >95% positive yield for positions held >1 month |

ParlayCity targets similar or better returns because parlay markets have structurally higher margins (17-35%) than perps markets (2-5%).

## Strategy 3: 90% Fee Share to Lockers

Our fee share is the most generous in the space:

| Protocol | Fee Share to LPs |
|----------|-----------------|
| GMX | 70% to GLP holders |
| Hyperliquid | ~1% of trading fees to HLP |
| Azuro | Variable (pool-dependent) |
| ParlayCity | **90% to lockers** (5% to SafetyModule, 5% to vault) |

We give 90% to committed capital because we believe the people providing liquidity should capture almost all the fee income. There is no team take, no governance token dilution, no foundation allocation.

## Strategy 4: Overcollateralization at Launch

Following the Gains Network model, the vault can start above 100% collateral ratio by seeding more than the minimum required for initial bets. Early bets generate fees that further overcollateralize the vault before significant volume arrives.

The cycle:
1. Seed vault with $X
2. First bets are small (caps enforce this)
3. Fees accumulate, increasing share price
4. External LPs see positive yield, deposit more
5. Caps scale up, allowing larger bets
6. More volume -> more fees -> more LP deposits

## Strategy 5: Lock Tiers Reward Patience

LPs who lock their vUSDC shares in the LockVault get boosted fee income via a Synthetix-style accumulator:

| Lock Tier | Duration | Weight Multiplier | Fee Share Boost |
|-----------|----------|-------------------|-----------------|
| Bronze | 30 days | 1.1x | Baseline |
| Silver | 60 days | 1.25x | +14% vs Bronze |
| Gold | 90 days | 1.5x | +36% vs Bronze |

This rewards patience over mercenary capital. A 90-day Gold locker earns 36% more per dollar than a 30-day Bronze locker. Early exit forfeits up to 10% of locked shares (linear decay), split to other lockers + SafetyModule + social good.

## Measurable UX: What LPs See

The `/vault` page shows:
- **TVL:** Total USDC in the vault
- **Share price:** Current vUSDC -> USDC conversion rate (rises as gambler losses accumulate)
- **Utilization:** What % of vault is reserved for active bets
- **Free liquidity:** Available for new bets or withdrawals
- **Fee APR:** Annualized fee income based on recent volume
- **Your position:** Shares held, current value, unrealized gain/loss

The `/vault` lock section shows:
- **Lock tiers:** Bronze/Silver/Gold with duration, weight, and current APR
- **Pending rewards:** USDC earned from fee distribution
- **Time remaining:** Days until unlock
- **Early exit cost:** Penalty amount if exiting now

## Narrative for Judges

"We solved the cold start the same way Overtime Markets did: seed the vault, let the math work, and protect small vaults with on-chain caps. The difference is our fee share. 90% of every fee goes to the people providing liquidity. No team take. No governance token. Just math."
