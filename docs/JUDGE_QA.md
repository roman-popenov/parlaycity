# Judge Q&A -- ParlayCity

Crisp answers to the 10 most likely judge questions. Each answer includes an on-chain reference and a key number.

---

### 1. How do you bootstrap initial liquidity?

The deploy script seeds the vault with USDC atomically in the deployment transaction -- the first external LP is never the sole counterparty. Overtime Markets bootstrapped their entire protocol with 100K sUSD and generated $8.7M in volume and +$230K profit from that seed. Our vault caps (80% utilization, 5% per-ticket payout) make it mathematically impossible for a single bet to drain a small vault.

**On-chain:** `HouseVault.maxUtilizationBps = 8000`, `maxPayoutBps = 500`
**Number:** On a $10K vault, max single payout = $500, max total reserved = $8K.

---

### 2. Why would anyone deposit when the vault is small?

Parlays have a 17-35% structural house edge (the probability of ALL legs hitting compounds against the gambler). A 3-leg parlay at 40% per leg hits only 6.4% of the time. The fee (2-3.5%) is additive on top of this edge. Comparable vault-as-counterparty protocols: GMX GLP (25% APR), Hyperliquid HLP (42% CAGR lifetime), Overtime Markets (106% cumulative Y1 return on Arbitrum, partly token-incentivized). Our 90% fee share to lockers is the most generous in the space.

**On-chain:** `ParlayEngine.baseFee = 100bps`, `perLegFee = 50bps`
**Number:** 90% of all fees flow to lockers (vs 70% at GMX, ~1% at Hyperliquid).

---

### 3. How are bets safe for depositors?

Four on-chain invariants protect depositors today: (1) the solvency invariant (`totalReserved <= 80% * totalAssets()`) ensures 20% always stays unencumbered, (2) no single bet can claim more than 5% of the vault, (3) the engine never holds funds -- USDC flows directly to the vault in one `safeTransferFrom`, (4) there is no admin withdrawal function, no `selfdestruct`, no proxy upgrade. These are tested with invariant fuzzing (64 runs, depth 32). Additionally, the SafetyModule (in development) will provide an insurance buffer funded by three independent income streams.

**On-chain:** `VaultInvariant.t.sol` -- invariant test for `totalReserved <= totalAssets()`
**Number:** 80% utilization cap + 5% per-ticket cap = bounded risk.

---

### 4. How is this fair for gamblers?

The multiplier is computed from on-chain probability data using pure math (`ParlayMath.sol`). The exact same math runs in TypeScript for the UI preview. The fee is a separate, visible line item: 2-3.5% depending on legs. Compare: DraftKings/FanDuel embed 17-35% vig into parlay odds -- the gambler never sees that number. Settlement is permissionless: anyone can call `settleTicket()`, no account bans, no limits.

**On-chain:** `ParlayMath.computeMultiplier()` -- verifiable by anyone
**Number:** 2-3.5% explicit fee vs 17-35% hidden vig at traditional sportsbooks.

---

### 5. What prevents the team from draining funds?

The owner can adjust fee parameters and pause the protocol. The owner CANNOT redirect user deposits, LP capital, or accumulated fees. There is no `selfdestruct`, no proxy upgrade, no admin withdrawal function. Penalty redistribution will be deterministic (to lockers, SafetyModule, social good) -- not discretionary. The engine never holds a single dollar. The vault's `reservePayout` / `releasePayout` / `payWinner` functions are restricted to the engine address set at deployment.

**On-chain:** No admin drain function in HouseVault, ParlayEngine, or LockVault
**Number:** 0 USDC accessible to owner outside protocol rules.

---

### 6. Why not just use Polymarket or Kalshi?

Polymarket uses per-market orderbooks -- liquidity fragments, thin markets have terrible spreads, and there's no parlay product. Kalshi fragments per-combo orderbooks with RFQ -- no live cashout, no unified vault. Azuro has a singleton pool (similar) but no crash mechanic. ParlayCity combines four primitives no competitor has: (1) crash-parlay game loop, (2) non-extractive fee routing (90/5/5), (3) social impact layer (10% of losses to harm reduction), (4) loser-to-LP conversion.

**On-chain:** Unified `HouseVault` backs all bets -- zero liquidity fragmentation
**Number:** 4 unique primitives, 0 competitors with all four.

---

### 7. What's the crash mechanic and why does it matter?

The multiplier climbs as each leg resolves favorably, like Aviator's ascending plane. After each leg wins, the bettor can cash out at the current multiplier or ride for more. If a leg loses, the multiplier crashes to zero. This transforms parlays from passive lottery tickets into live instruments with real-time exit decisions. Aviator generates $14B/month in wagers with 42-77M MAU -- the mechanic is proven at massive scale. We apply it to real-event parlays (sports, politics, markets) instead of pure randomness.

**On-chain:** `ParlayEngine.PayoutMode` enum + `buyTicketWithMode()` + `cashoutEarly(minOut)` with slippage protection
**Number:** Aviator: $14B/month in wagers, 42-77M MAU.

---

### 8. How do you make money if there's no token?

We don't need a token. The protocol is self-sustaining: gamblers pay 2-3.5% explicit fees. 90% flows to lockers, 5% to SafetyModule, 5% stays in vault. When gamblers lose (~94% of 3-leg parlays), the vault profits from the structural house edge. LPs earn from both fees and losing bets. No governance token, no founder allocation, no admin take. The economics work because parlay markets have 17-35% structural margins -- the highest in sports betting.

**On-chain:** Fee split constants in ParlayEngine: `FEE_TO_LOCKERS_BPS=9000`, `FEE_TO_SAFETY_BPS=500` (shipped in PR1)
**Number:** 0% team take. 90% to liquidity providers.

---

### 9. What happens if a bunch of people win at once?

The 80% utilization cap means 20% of vault capital is always unencumbered. No new bets are accepted when utilization approaches the cap. The 5% per-ticket cap means no single payout exceeds 5% of TVL. If multiple wins occur, the loss distributes proportionally across ALL LPs via share price decline. The SafetyModule (in development, PR2) will provide additional backstop for black swan events. This is the same model used by GMX ($500M TVL), Hyperliquid, and Gains Network -- vault-as-counterparty is battle-tested.

**On-chain:** `HouseVault.reservePayout()` enforces both caps on every ticket purchase
**Number:** Max total exposure = 80% TVL. Max single payout = 5% TVL.

---

### 10. Why Base? Why not Solana or other chains?

Base offers the best combination of low gas costs, EVM compatibility (our entire stack is Solidity + wagmi), and sponsor ecosystem (Coinbase Paymaster for gasless UX, OnchainKit for native components, Base Builder grants). The x402 payment protocol is Base-native, which unlocks the Kite AI bounty. That said, the protocol is chain-agnostic -- we can deploy anywhere with EVM + USDC. Multi-chain deployment is in the roadmap, but Base is the optimal launch target for ETHDenver.

**On-chain:** Base Paymaster at `0xf5d253B62543C6Ef526309D497f619CeF95aD430`
**Number:** Base Sepolia gas: <$0.001 per transaction.
