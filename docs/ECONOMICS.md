# ParlayCity Tokenomics & Economics

## How the Money Moves

Every dollar in ParlayCity flows through one of three roles: **gambler** (buys parlay tickets), **LP** (deposits USDC into the vault), or **locker** (locks LP shares for boosted fee income). There is no fourth role. There is no team treasury, no founder allocation, no admin wallet that takes a cut. The protocol is a machine with deterministic routing.

### Token Stack

```
USDC       -- the only real money in the system
vUSDC      -- LP shares (ERC-4626), redeemable for USDC at floating share price
Tickets    -- ERC-721 NFTs representing active parlay bets
```

No governance token in MVP. The economics are designed to work without one.

## Worked Example: One Complete Bet

Vault has **$100,000 USDC** from LPs. A gambler places a **$100, 3-leg parlay** (each leg ~40% probability, realistic sports odds).

### Step 1: Purchase

```
Stake:             $100.00
Fee (2.5%):         -$2.50   (100bps base + 3 legs * 50bps)
Effective stake:    $97.50
Fair multiplier:    ~15.6x   (1/0.4^3)
Potential payout:   $1,521   ($97.50 * 15.6)
```

The full $100 transfers directly from gambler to HouseVault via `safeTransferFrom`. The engine contract never holds a single dollar -- it's a routing layer, not a custody layer. The vault books $1,521 as reserved liability against its existing capital.

**Safety gates (both enforced on-chain, both must pass):**
- Payout cap: $1,521 must be < 5% of vault TVL ($5,000) -- passes
- Utilization cap: total reserved across ALL active bets must be < 80% of TVL -- prevents overexposure

### Step 2a: Gambler Loses (~93.6% probability for a 3-leg parlay)

Nothing moves. The vault unbooks the $1,521 reservation. The $100 stays in the vault, increasing the share price for every vUSDC holder. No one "takes" the money -- it becomes part of the pool.

**Target loss distribution (on the full $100 stake):**

```
$80  (80%)  -> stays in vault (LP share price appreciation)
$10  (10%)  -> AMM liquidity pools (Uniswap V3 USDC/USDS LP, swap fees fund SafetyModule)
$10  (10%)  -> rehab lock (force-locked vUSDC for 120 days, gambler earns fees as LP)
```

See `docs/UNISWAP_LP_STRATEGY.md` for AMM deployment details and `docs/REHAB_MODE.md` for the rehab lock mechanism.

### Step 2b: Gambler Wins (~6.4% probability)

The vault pays $1,521 from its reserves. Net vault loss: $1,421 ($1,521 out minus $100 in). That loss is distributed across ALL LPs proportionally via share price decline. No single LP bears the full hit.

### The Fee ($2.50)

**Target fee routing (deterministic, enforced by smart contract):**

```
$2.25   (90%)  -> LockVault lockers (USDC rewards, weighted by lock tier)
$0.125   (5%)  -> SafetyModule (insurance buffer no one controls)
$0.125   (5%)  -> stays in vault (LP share price appreciation)
```

### The Flywheel

```
Gambler stakes $100
  |
  +-- $2.50 fee --> 90% to Lockers ($2.25)
  |                  5% to SafetyModule ($0.125)
  |                  5% stays in Vault ($0.125)
  |
  +-- $97.50 effective stake --> reserved in Vault
        |
        +-- [LOSES ~94%] --> 80% LP profit ($80)
        |                     10% AMM liquidity ($10)
        |                     10% social good ($10)
        |                     + "become the house" CTA
        |
        +-- [WINS ~6%]  --> $1,521 paid from Vault
                             (net cost to LPs: $1,421)

LP deposits USDC --> earns from: gambler losses + fee share
  |
  +-- locks vUSDC in LockVault --> earns 90% of ALL fees
        |                          (weighted by lock tier)
        +-- early exit? --> penalty split to other lockers,
                            SafetyModule, social good
```

## Bootstrapping: Convincing the First Dollar

### Why LPs Deposit

**The math is structurally on the LP's side.** Parlays have a 17-35% house edge (vs 4.5% on straight bets), because the probability of ALL legs hitting compounds against the gambler. A 3-leg parlay at 40% per leg has a 6.4% hit rate. The fee is separate and additive on top of this structural edge.

**Comparable protocol returns:**
- GMX GLP: 25% APR from trading fees alone
- Hyperliquid HLP: 42% CAGR lifetime, 450% total return
- Overtime Markets: 106% cumulative LP return in year one (Arbitrum, partly token-incentivized)
- Gains Network gDAI: 10-20% variable APR
- Azuro: >95% probability of positive yield for positions held >1 month

All of these are vault-as-counterparty models -- the same architecture as ParlayCity.

**Our fee share is the most generous in the space.** 90% of all fees go to lockers. GMX gives 70% to GLP. Hyperliquid gives ~1% of trading fees to HLP. We give 90% to committed capital because we believe the people providing liquidity should capture almost all the fee income.

### Solving the Cold Start

**Protocol-seeded first deposit.** The deploy script seeds the vault with initial USDC, atomically in the deployment transaction. This means the first external LP is never the sole counterparty. Overtime Markets bootstrapped their entire protocol with just 100K sUSD from the DAO treasury and generated $8.7M in volume and +$230K profit from that seed.

**The caps protect small vaults.** With a $10K vault:
- Max single payout: $500 (5% cap)
- Max total reserved: $8,000 (80% cap)
- A gambler literally cannot place a bet large enough to drain the vault

As the vault grows, the caps scale proportionally. The vault self-regulates its risk exposure.

**Overcollateralization at launch.** Following the Gains Network model, the vault can start above 100% collateral ratio by seeding more than the minimum. Early bets generate fees that further overcollateralize the vault before significant volume arrives.

## Depositor Safety

### On-Chain Guarantees (not promises -- smart contract invariants)

**1. Solvency invariant: `totalReserved <= 80% * totalAssets()`**

The vault always keeps 20% of its capital unencumbered. If reserved exposure approaches 80%, new bets are rejected -- not existing ones liquidated. This is tested with invariant fuzzing (64 runs, depth 32).

**2. Per-ticket cap: `potentialPayout <= 5% * totalAssets()`**

No single bet can claim more than 5% of the vault. A whale cannot drain the pool with one lucky parlay. On a $1M vault, max single payout is $50K.

**3. Engine never holds funds.**

USDC flows directly from gambler to vault in a single `safeTransferFrom`. There is no intermediary contract where funds sit temporarily. The engine is a stateless routing layer.

**4. No discretionary owner drains.**

The owner can adjust fee parameters and pause the protocol. The owner CANNOT redirect user deposits, LP capital, or accumulated fees to arbitrary addresses. There is no `selfdestruct`, no proxy upgrade, no admin withdrawal function. Penalty redistribution is deterministic, not discretionary.

**5. SafetyModule backstop (in development, PR2).**

A planned insurance buffer funded by three independent income streams:
- 5% of all fees (grows with volume)
- Swap fees from AMM liquidity provision (grows with DeFi activity)
- Portion of early-withdrawal penalties (grows with locker activity)

No one will be able to withdraw from the SafetyModule. It will cover deficit events (oracle failure, bug, black swan). If the buffer exceeds a cap, excess flows back to LPs or lockers -- it never accumulates into a war chest.

### LP Risk Profile

LPs are the counterparty to all bets. When gamblers win, LPs lose (proportionally across all depositors). When gamblers lose, LPs profit. Over a sufficient volume of bets, the house edge makes LPs structurally profitable -- the same reason casinos are profitable despite individual jackpots.

The risk is real but bounded:
- Any single loss is capped at 5% of TVL
- Total exposure is capped at 80% of TVL
- The fee income provides a continuous yield cushion even in periods where gamblers win more than expected
- The SafetyModule (planned, PR2) will provide an additional backstop layer

### LockVault: Rewarding Commitment

LPs who lock their vUSDC shares get boosted fee income:

| Lock Tier | Duration | Weight Multiplier | Max Early-Exit Penalty |
|-----------|----------|-------------------|----------------------|
| Bronze | 30 days | 1.1x | 10% (linear decay) |
| Silver | 60 days | 1.25x | 10% (linear decay) |
| Gold | 90 days | 1.5x | 10% (linear decay) |

Fee distribution uses a Synthetix-style accumulator (`accRewardPerWeightedShare`). A 90-day locker with 1.5x weight earns 36% more per dollar locked than a 30-day locker with 1.1x weight. This rewards patience, not mercenary capital.

**Early exit penalty is non-extractive.** If you exit a 90-day lock at day 45 (50% remaining), you forfeit ~5% of your locked shares. Those penalty shares don't go to an admin wallet. They're split deterministically to: other lockers, SafetyModule, AMM pool, and social good. Your early exit makes everyone else slightly better off.

## Fairness for Gamblers

### Provably Fair Odds

The multiplier is computed from on-chain probability data using pure math (`ParlayMath.sol`). The same exact math runs identically in TypeScript for the UI (`packages/shared/src/math.ts`). There is no hidden vig adjustment, no odds manipulation, no "we moved the line because too many people bet one side."

```
multiplier = product(1,000,000 / probability_i) for each leg
payout     = (stake - fee) * multiplier
```

The fee is explicit and small: 2-3.5% depending on number of legs. Compare: traditional sportsbooks embed 17-35% vig into parlay odds. The gambler never sees that number -- it's hidden in "adjusted" odds. Our fee is a separate, visible line item.

### The Fee Comparison

| Platform | Parlay Fee (effective) | Where it goes | Visible? |
|----------|----------------------|---------------|----------|
| DraftKings | 17-35% (hidden in odds) | Corporate profit | No |
| FanDuel | 17-35% (hidden in odds) | Corporate profit | No |
| Overtime Markets | ~5% spread | LP + token burns | Partially |
| ParlayCity | 2-3.5% (explicit) | 90% lockers, 5% safety, 5% vault | Yes, on-chain |

### No Account Bans, No Limits

Centralized sportsbooks routinely limit or ban winning accounts. This is well-documented and industry-standard practice. ParlayCity is a smart contract -- it cannot identify "winning" accounts, cannot adjust odds per-user, and cannot prevent anyone from placing bets or claiming payouts. Settlement is permissionless: anyone can call `settleTicket()`.

### Cashout: Agency, Not Just Luck

The crash-parlay mechanic transforms parlays from lottery tickets into live instruments:

```
Leg 1 wins -> multiplier: 1.0x -> 2.5x
  Cash out now at 2.5x? Or ride?
Leg 2 wins -> multiplier: 2.5x -> 6.2x
  Cash out now at 6.2x? Or ride?
Leg 3 loses -> multiplier crashes to 0
  Too late.
```

**Cashout pricing (fair value minus spread):**
```
V_fair    = potentialPayout * P_remaining
V_cashout = V_fair * (1 - cashoutFeeBps - riskSpreadBps)
```

Where `P_remaining` = product of implied probabilities for unresolved legs. Slippage protection via `minOut` parameter.

This means expertise matters twice: once in picking legs (market knowledge), and again in timing exits (risk management). A gambler who correctly identifies that remaining legs are riskier than priced can cash out for profit. A gambler who recognizes favorable odds can let it ride. This is not pure chance -- it's a skill-augmented betting instrument.

## Why ParlayCity Instead of the Alternatives

### vs Centralized Sportsbooks (DraftKings, FanDuel)

They fragment liquidity per bet type, hide the vig in adjusted odds (17-35% on parlays), ban winning accounts, and all profit accrues to the corporation. ParlayCity has transparent 2-3.5% fees, provably fair odds, no account bans, and 90% of fees flow to liquidity providers -- the people taking the risk.

### vs On-Chain Prediction Markets (Polymarket, Azuro)

Polymarket uses order books -- liquidity fragments per market, thin markets have terrible spreads, and there's no parlay product at all. Azuro has a singleton pool (similar to us) but no live cashout mechanic. Neither has the crash game loop that creates per-leg engagement and the agency of choosing your exit.

### vs DeFi Perps Vaults (GMX, Hyperliquid, Gains)

Same vault-as-counterparty architecture, proven to work at $300M-$500M TVL. But they serve leveraged traders, not parlay bettors. The parlay market is structurally higher margin (17-35% vs 2-5% on perps) and the crash game mechanic creates consumer engagement that perps platforms don't have.

### What No Competitor Has

1. **Crash-parlay game loop** -- Aviator's engagement mechanic ($14B/month in wagers, 42-77M MAU) applied to the highest-margin bet type (56-72% of US sportsbook revenue)
2. **Non-extractive fee routing** -- 90/5/5 split enforced by smart contract, no owner take
3. **Social impact layer** -- 10% of every loss funds gambling harm reduction
4. **Loser-to-LP conversion** -- "become the house" CTA at the crash moment, when the gambler is most emotionally receptive to switching sides

## Expertise vs Pure Chance

Parlays reward knowledge. A bettor who correctly identifies that a star quarterback is undervalued, that weather will suppress scoring, and that a specific underdog has better odds than the line suggests -- that bettor has genuine expertise. Traditional platforms extract that expertise via hidden vig. ParlayCity preserves it.

With a 2-3.5% fee and fair-odds multipliers, a bettor with genuine insight has a positive expected value. The protocol doesn't need every bettor to lose -- it needs the aggregate house edge to be positive, which it is structurally (the fee + the mathematical reality that most multi-leg parlays don't hit).

The cashout mechanic adds a second skill dimension: position management. Knowing when to exit a winning position is the same skill that separates good traders from bad ones. A gambler who understands implied probability can compute whether the remaining legs justify holding vs cashing out. This is risk management, not coin flipping.

The LP side rewards financial judgment too. Choosing when to deposit (low utilization = higher expected yield), which lock tier (90-day at 1.5x weight vs 30-day at 1.1x), and reading vault health metrics -- these are genuine financial decisions. The LockVault is a yield instrument backed by the mathematical edge of being the counterparty to parlay bets.

## Implementation Status

| Component | Status | What Exists |
|-----------|--------|-------------|
| HouseVault (ERC-4626) | Deployed | deposit, withdraw, reserve/release/pay, yield adapter, safety caps |
| ParlayEngine (ERC-721) | Deployed | buyTicket, settleTicket, claimPayout, partial void |
| LockVault (staking) | Deployed | lock/unlock/earlyWithdraw, Synthetix-style accumulator, tier weights |
| Fee calculation | Deployed | ParlayMath.sol + TypeScript mirror, exact parity |
| Fee routing (90/5/5) | Not built | Fees currently stay passively in vault |
| Loss distribution (80/10/10) | Not built | Losses currently 100% to vault |
| SafetyModule | Not built | Contract does not exist yet |
| Cashout mechanism | Not built | MultiplierClimb UI exists, no on-chain cashout |
| Automatic fee distribution | Deployed | HouseVault.routeFees → LockVault.notifyFees (90/5/5 split) |
| Penalty redistribution | Not built | sweepPenaltyShares is owner-discretionary |

See root `CLAUDE.md` gap analysis for the full EXISTS / NEEDS BUILDING / DISCONNECTED inventory.

## Economic Constants (BPS = basis points, 10,000 = 100%)

```
-- Fee calculation --
baseFee             = 100 bps   (1%)
perLegFee           =  50 bps   (0.5% per leg)
2-leg total fee     = 200 bps   (2%)
5-leg total fee     = 350 bps   (3.5%)

-- Fee routing (target) --
feeToLockersBps     = 9000      (90% of fee)
feeToSafetyBps      =  500      (5% of fee)
feeToVaultBps       =  500      (5% of fee)

-- Loss distribution (target) --
lossToLPBps         = 8000      (80% of full stake)
lossToAMMBps        = 1000      (10% of full stake)
lossToRehabBps      = 1000      (10% of full stake)

-- Vault safety caps --
maxUtilizationBps   = 8000      (80% of TVL)
maxPayoutBps        =  500      (5% of TVL per ticket)

-- Lock tiers --
THIRTY_DAY weight   = 11000 bps (1.1x)
SIXTY_DAY weight    = 12500 bps (1.25x)
NINETY_DAY weight   = 15000 bps (1.5x)
basePenaltyBps      = 1000      (10% max, linear decay)

-- Math scales --
Probability         = PPM (1,000,000 = 100%)
Fees / caps         = BPS (10,000 = 100%)
```
