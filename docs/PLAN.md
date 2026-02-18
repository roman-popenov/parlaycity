# ParlayCity ETHDenver 2026 -- Execution Plan

## Executive Summary

1. **Core primitive is genuinely novel.** "Unified vault + crash-parlay cashout on real-event parlays" -- no deployed protocol combines all three. Verified against Kalshi, Azuro, Overtime, ParlayMarket, PredictShark, Polymarket.
2. **Protocol foundation is solid.** HouseVault, ParlayEngine, LockVault, LegRegistry, ParlayMath, oracles, yield adapters, full test suite (unit/fuzz/invariant/integration), CI, deploy script, 4-page frontend -- all working and tested.
3. **Three critical gaps remain.** Fee routing (90/5/5 split), cashout mechanism (the core differentiator), and SafetyModule (insurance buffer). These must ship for the narrative to hold.
4. **Bounty ceiling: $32K realistic, $58K theoretical.** High-confidence: track prizes ($6K) + Base ($10K) + Kite AI x402 ($10K) + ADI Paymaster ($3K) + ADI Payments ($3K). Medium: 0g Labs ($7K), ADI Open Project ($19K).
5. **Claim corrections needed.** Aviator "$14B/yr" is actually $14B/MONTH (Dec 2024). "12M MAU" is outdated (now 42-77M). "40% YoY crash game growth" has no verifiable source -- replace with "58% content share growth" (Eilers & Krejcik).
6. **Competitor moat is real.** Verified: no other protocol has unified vault + crash cashout + non-extractive fee routing + social impact layer.
7. **PR sequence.** PR0 (docs) -> PR1 (FeeRouter) -> PR2 (SafetyModule) -> PR3 (cashout) -> PR4 (x402) -> PR5 (paymaster) -> PR6 (crash UX) -> PR7 (stretch).

---

## PR Plan

### PR0: Narrative & Documentation
**Owner:** Team lead
**Branch:** `docs/narrative-pack`
**Creates:** JUDGE_QA.md, ONE_PAGER.md, CLAIM_LEDGER.md, LP_SEEDING.md, FAIRNESS.md, PLAN.md, TASKS.md
**Updates:** BOUNTY_MAP.md, COMPETITORS.md, ECONOMICS.md (claim corrections)
**Acceptance:** All docs render correctly, no broken links, claim corrections applied.

### PR1: FeeRouter Contract
**Owner:** Contracts agent
**Branch:** `feat/fee-router`
**What:** Deterministic fee routing on `buyTicket`: 90% to LockVault lockers, 5% to SafetyModule, 5% stays in vault.
**Files:**
- Create or modify: `ParlayEngine.sol` (fee split logic)
- Modify: `HouseVault.sol` (add `transferFeeOut()` or equivalent)
- Create: `FeeRouter.t.sol` (unit tests)
- Update: `Integration.t.sol`
**Acceptance:** `make gate` green, fee split verified in integration test, invariant tests pass.
**Security:** Fee routing must not break solvency invariant. Vault must not transfer more than feePaid.

### PR2: SafetyModule
**Owner:** Contracts agent
**Branch:** `feat/safety-module`
**Depends on:** PR1
**What:** Insurance buffer contract. Receives 5% of fees + penalty redistribution. Cannot be drained by owner. Surplus redistribution above cap.
**Files:**
- Create: `SafetyModule.sol`, `ISafetyModule.sol`, `SafetyModule.t.sol`
- Update: Deploy script
**Acceptance:** `make gate` green, SafetyModule receives and holds fees correctly.

### PR3: Cashout Mechanism
**Owner:** Contracts agent
**Branch:** `feat/cashout`
**Depends on:** PR1 (fee math must be stable)
**What:** `cashoutTicket(ticketId, minOut)` -- the core differentiator.
**Files:**
- Modify: `ParlayEngine.sol` (add cashoutTicket)
- Modify: `ParlayMath.sol` (add computeCashoutValue)
- Modify: `packages/shared/src/math.ts` (mirror cashout math)
- Create: `Cashout.t.sol`, `CashoutFuzz.t.sol`
**Acceptance:** `make gate` green, cashout pays <= fair value - spread, releases reserved liability, respects minOut, cannot exceed reserves, math parity test passes.
**Security:** Cashout must release exactly the right amount of reserved liability. Must not create a path to drain vault.

### PR4: Real x402 Verification
**Owner:** Services agent
**Branch:** `feat/x402-real`
**What:** Replace stub with real @x402/express middleware. Kite AI $10K bounty.
**Files:**
- Modify: `packages/services/src/premium/x402.ts`
- Add: @x402/express dependency
- Update tests
**Acceptance:** `make gate` green, premium endpoint requires real USDC payment.

### PR5: Sponsor UX (Paymaster + OnchainKit)
**Owner:** Web agent
**Branch:** `feat/sponsor-ux`
**What:** ERC-4337 paymaster for gasless UX (ADI $3K) + OnchainKit (Base $10K).
**Files:**
- Modify: `apps/web/src/lib/wagmi.ts`, `hooks.ts`
- Add OnchainKit components
**Acceptance:** `make gate` green, gasless txns on Base Sepolia.

### PR6: Crash UX & Rehab Mode
**Owner:** Web agent
**Branch:** `feat/crash-ux`
**Depends on:** PR3
**What:** Wire MultiplierClimb to real cashout + rehab CTA for losing bettors.
**Files:**
- Modify: `MultiplierClimb.tsx`, `hooks.ts`, ticket detail page
- Create: rehab CTA component
**Acceptance:** `make gate` green, cashout button works, rehab CTA shows on loss.

### PR7: Stretch Bounties
**Owner:** Team lead
**What:** 0g Labs DeFAI agent, ADI Payments, ADI Open Project application.

---

## Implementation Sequence

```
Phase 1 (Today):    PR0 -- narrative docs (zero risk, high value)
Phase 2 (Next):     PR1 + PR4 in parallel (contracts + services, independent)
Phase 3:            PR2 + PR3 sequentially (SafetyModule then Cashout)
Phase 4:            PR5 + PR6 in parallel (sponsor UX + crash UX)
Phase 5:            PR7 -- stretch bounties as time allows
```

---

## Bounty Map

| Bounty | Prize | Confidence | Work Needed |
|--------|-------|------------|-------------|
| New France Village | $2K | HIGH | Polish narrative |
| Futurllama | $2K | HIGH | Polish narrative |
| Prosperia | $2K | HIGH | Ship FeeRouter |
| Base | $10K | HIGH | Deploy + OnchainKit |
| Kite AI x402 | $10K | HIGH | @x402/express integration |
| ADI Paymaster | $3K | MED | ERC-4337 integration |
| ADI Payments | $3K | MED | Ticket skins / profile |
| ADI Open Project | $19K | LOW | Application + narrative |
| 0g Labs DeFAI | $7K | LOW | Agent integration |

**Realistic: $32K** | **Max theoretical: $58K**

---

## Demo Moment Map (5 Minutes)

```
[0:00-0:30] HOOK: "Watch your parlay odds climb -- cash out before they crash"
[0:30-1:30] BUY: Connect wallet, 3-leg parlay, 2.5% fee (vs 17-35% hidden)
[1:30-2:30] CRASH: Legs resolve, multiplier climbs, CASHOUT at 6.2x
[2:30-3:30] HOUSE: Deposit USDC, lock 90-day Gold, 90% of fees flow to lockers
[3:30-4:30] SAFE: Vault caps, SafetyModule, no admin drain
[4:30-5:00] STORY: Rehab CTA, 10% of losses fund harm reduction
```

---

## Verification

After each PR: `make gate` must pass. Contract PRs need `make coverage` + security note.

After all PRs: Full 5-minute demo, Base Sepolia deployment, all bounty apps submitted.
