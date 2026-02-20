# ParlayCity -- Task Board

Last updated: 2026-02-19 (validated against codebase audit)

---

## Ground Truth: What Actually Exists

Verified by reading every source file in the repo. This is the single source of truth.

### Contracts (13 source files, 19 test files)

| Contract | Status | Key Functions |
|----------|--------|---------------|
| HouseVault.sol (313 lines) | **WORKING** | deposit, withdraw, reservePayout, releasePayout, payWinner, routeFees (90/5/5), yield adapter mgmt |
| ParlayEngine.sol (640 lines) | **WORKING** | buyTicket, buyTicketWithMode (3 modes), settleTicket (permissionless), claimPayout, claimProgressive, cashoutEarly (with minOut slippage) |
| LockVault.sol (301 lines) | **WORKING** | lock (3 tiers), unlock, earlyWithdraw (linear penalty), notifyFees (Synthetix-style), claimFees |
| LegRegistry.sol (94 lines) | **WORKING** | createLeg, updateProbability, deactivateLeg, getLeg |
| ParlayMath.sol (97 lines) | **WORKING** | computeMultiplier, computeEdge, computePayout, computeCashoutValue |
| AdminOracleAdapter.sol | **WORKING** | resolve (owner-only, one-shot) |
| OptimisticOracleAdapter.sol | **WORKING** | propose, challenge, finalize, resolveDispute |
| MockYieldAdapter.sol | **WORKING** | deploy, withdraw, balance (used in default deploy) |
| AaveYieldAdapter.sol | **EXISTS** | Implemented but NOT in default deploy script |
| Deploy.s.sol | **WORKING** | Full deploy: MockUSDC -> Vault -> Registry -> Oracles -> Engine -> LockVault -> YieldAdapter -> 3 sample legs |

**NOT in contracts:** SafetyModule (just an `address` field, deployer EOA receives 5%), distributeLoss (no 80/10/10), rehab locks, IAMMRouter, per-market exposure, dynamic pricing, paymaster.

### Frontend (4 pages, 19 hooks, 6 components, 160+ tests)

| Feature | Status | Detail |
|---------|--------|--------|
| Parlay Builder (`/`) | **WORKING** | 3 payout modes, validation, session persistence, AI risk analysis |
| Vault Dashboard (`/vault`) | **WORKING** | Deposit/Withdraw/Lock tabs, TVL/utilization stats, tier selector |
| Ticket List (`/tickets`) | **WORKING** | Polls on-chain, filters by owner |
| Ticket Detail (`/ticket/[id]`) | **WORKING** | All action buttons: Settle, Claim, Progressive, Cashout |
| useCashoutEarly hook | **WORKING** | Calls cashoutEarly(ticketId, 0n), wired to TicketCard button |
| useClaimProgressive hook | **WORKING** | Wired to TicketCard button |
| MultiplierClimb | **PARTIAL** | Static SVG viz during leg selection. `crashed` prop exists but NEVER triggered. No live game loop. |
| Base Sepolia chain config | **PARTIAL** | Chain ID 84532 in wagmi.ts, but no deployed contract addresses |
| MOCK_LEGS in ParlayBuilder | **DISCONNECTED** | Builder uses 3 hardcoded legs, does NOT query LegRegistry on-chain |

**NOT in frontend:** OnchainKit, paymaster/gasless, rehab CTA, crash game loop, agent scripts.

### Services (8 endpoints, x402 real verification)

| Endpoint | Status |
|----------|--------|
| `GET /markets` | **WORKING** -- seed market catalog |
| `POST /quote` | **WORKING** -- off-chain parlay quote using shared math |
| `GET /exposure` | **WORKING** -- mock hedger exposure |
| `POST /premium/sim` | **WORKING** -- x402-gated analytical simulation |
| `POST /premium/risk-assess` | **WORKING** -- x402-gated Kelly criterion risk advisor |
| `POST /premium/agent-quote` | **WORKING** -- x402-gated combined quote + risk for agents |
| `GET /vault/health` | **WORKING** -- vault health assessment (mock data) |
| `GET /vault/yield-report` | **WORKING** -- yield optimization report (mock data) |

x402: Real verification via `@x402/express` + `ExactEvmScheme` in production. Stub in dev/test.

### Shared Math (packages/shared/src/math.ts)

All ParlayMath.sol functions mirrored: `computeMultiplier`, `computeEdge`, `computePayout`, `computeProgressivePayout`, `computeCashoutValue`. Parity tested.

### Infrastructure

| Item | Status |
|------|--------|
| `make dev` (full stack: anvil + deploy + services + web) | **WORKING** |
| `make gate` (test-all + typecheck + build-web) | **WORKING** |
| `make deploy-local` (Anvil) | **WORKING** |
| `make deploy-sepolia` | **MISSING** -- no target |
| CI (GitHub Actions, 3 jobs) | **WORKING** |
| Agent demo script | **MISSING** |
| Settler bot | **MISSING** |
| Risk agent | **MISSING** |

---

## Remaining Work (Priority Order)

### P0: Demo-Critical (blocks live demo + highest-value bounties)

#### 1. Base Sepolia Deployment
**Why:** Required for all bounty submissions, demo, and agent connectivity.
**Effort:** 2-4 hours

- [ ] Add `deploy-sepolia` Makefile target with Base Sepolia RPC + deployer key
- [ ] Create Foundry profile for Base Sepolia (foundry.toml)
- [ ] Deploy contracts to Base Sepolia
- [ ] Verify contracts on BaseScan
- [ ] Update sync-env.sh to support Sepolia output
- [ ] Verify frontend connects to Sepolia with env vars
- [ ] `make gate` passes

#### 2. Demo Harness (Resolution Flow)
**Why:** Judges need to see bets resolving live. Currently resolution is fully manual with no scripted flow.
**Effort:** 3-4 hours

The demo flow:
```
PRE-DEMO: Seed 5+ legs via AdminOracleAdapter.createLeg()
          Buy 3-4 tickets from different wallets (simulates activity)

LIVE DEMO (5 min):
  [0:00] Connect wallet, show vault TVL
  [0:30] Build 3-leg parlay, buy ticket (show fee breakdown)
  [1:30] Admin resolves Leg 1 (WIN) --> multiplier climbs
  [2:00] Admin resolves Leg 2 (WIN) --> multiplier climbs more
  [2:30] DECISION MOMENT: cash out at 6.2x or ride?
  [3:00] If cashout demo: call cashoutEarly, show USDC returned
         If crash demo: resolve Leg 3 (LOSE), show crash
  [3:30] Show vault page: LP economics, fee distribution
  [4:00] Show settler bot auto-settling other tickets
  [4:30] Show x402 agent paying for risk assessment
```

- [ ] Write `scripts/demo-seed.sh`: creates legs, buys tickets from multiple wallets
- [ ] Write `scripts/demo-resolve.sh`: resolves legs one at a time with prompts
- [ ] Pre-create legs with outcomes you control (admin oracle)
- [ ] Test full 5-minute flow on local Anvil
- [ ] Test full flow on Base Sepolia

#### 3. Settler Bot (Base Agents $10K bounty)
**Why:** Bounty requires "self-sustaining autonomous agents on Base."
**Effort:** 4-6 hours

- [ ] Create `scripts/settler-bot.ts`: watches for resolved legs, calls `settleTicket()` permissionlessly
- [ ] Poll LegRegistry for newly resolved legs
- [ ] Iterate active tickets, check if all legs resolved, settle if so
- [ ] Log activity (settled ticket IDs, gas costs)
- [ ] Fund bot wallet on Sepolia with ETH for gas
- [ ] Run against Base Sepolia, show it settling in demo

#### 4. Agent Demo Script (Kite AI x402 $10K bounty)
**Why:** x402 verification is done but bounty needs visible autonomous agent loop.
**Effort:** 3-4 hours

- [ ] Create `scripts/risk-agent.ts`: autonomous market discovery -> x402 payment -> risk assess -> buy/skip
- [ ] Agent flow: GET /markets -> POST /premium/agent-quote (with x402 header) -> evaluate Kelly -> buyTicketWithMode if favorable
- [ ] Record agent output / screenshots for submission
- [ ] Write agent-focused section in bounty submission

#### 5. Wire Crash Game Loop (Core Differentiator)
**Why:** MultiplierClimb exists but never shows a live crash. This is THE differentiator.
**Effort:** 4-6 hours

- [ ] On `/ticket/[id]`, add a MultiplierClimb that shows cumulative multiplier from resolved legs
- [ ] Poll leg statuses (already have `useLegStatuses` hook with 5s polling)
- [ ] When a new leg resolves as WON: animate multiplier climbing up
- [ ] When a leg resolves as LOST: trigger `crashed=true` prop, show crash animation
- [ ] Show cashout value in real-time next to "Cash Out Early" button
- [ ] `make gate` passes

### P1: Bounty Polish (high ROI, low effort)

#### 6. Track Submissions ($6K total)
**Why:** Futurllama ($2K), New France ($2K), Prosperia ($2K) -- narratives exist.
**Effort:** 2-3 hours

- [ ] Update all submission docs with Base Sepolia deployment links
- [ ] Add demo video or screenshots to each
- [ ] Final review against each track's criteria
- [ ] Submit all three

#### 7. OnchainKit Integration (Base bounty alignment)
**Why:** Base bounty values OnchainKit components.
**Effort:** 2-3 hours

- [ ] `pnpm --filter web add @coinbase/onchainkit`
- [ ] Replace ConnectKitButton with OnchainKit Identity/Wallet components
- [ ] Add OnchainKit transaction components where appropriate

#### 8. ADI Open Project ($19K, low confidence)
**Effort:** 1-2 hours (narrative only)

- [ ] Draft application emphasizing crash-parlay innovation + x402 + rehab concept
- [ ] Submit if time allows

### P2: Narrative Support (strengthens submission claims)

#### 9. SafetyModule Contract (Minimal)
**Why:** Claimed as "in development" in submissions. Currently the 5% fee goes to deployer EOA.
**Effort:** 3-4 hours

- [ ] Create minimal `SafetyModule.sol`: receive USDC, track balance, view function, no owner drain
- [ ] Wire to HouseVault via `setSafetyModule()`
- [ ] Unit tests
- [ ] Update deploy script
- [ ] `make gate` passes

#### 10. Rehab CTA (Frontend Only, No Contract Changes)
**Why:** Claimed in Prosperia submission.
**Effort:** 1-2 hours

- [ ] Add "Tough break. Become the house." CTA on ticket detail when ticket.status === Lost
- [ ] Link to `/vault` with pre-filled deposit suggestion
- [ ] `make gate` passes

### P3: Stretch (only if time allows)

#### 11. Uniswap API Integration ($5K bounty)
- [ ] Service endpoint proxying Uniswap Trading API
- [ ] SwapToUSDC component in frontend
- [ ] Needs API key application

#### 12. ERC-4337 Paymaster (gasless UX)
- [ ] Base Paymaster config in wagmi.ts
- [ ] Gasless tx wrapper for write hooks

#### 13. 0g Labs DeFAI Agent ($7K bounty)
- [ ] Wrap risk advisor with 0g inference for NL risk explanation

#### 14. Connect ParlayBuilder to Real LegRegistry
- [ ] Replace MOCK_LEGS with dynamic query to LegRegistry on-chain
- [ ] Show all active legs with probabilities from contract

#### 15. Loss Distribution (80/10/10)
- [ ] Add distributeLoss() to HouseVault
- [ ] Wire to ParlayEngine.settleTicket() on loss
- [ ] Unit tests

---

## Not Targeting

- **ADI Paymaster ($3K)** -- wants devtools, not app
- **ADI Payments ($3K)** -- wants merchant infra
- **Hedera ($25K)** -- requires Daml/HTS
- **Canton ($15K)** -- requires Daml
- **QuickNode ($2K)** -- Monad/Hyperliquid specific

---

## Bounty Summary (Updated)

| Bounty | Prize | Status | Remaining Work | Priority |
|--------|-------|--------|----------------|----------|
| Kite AI x402 | $10K | Verification done | Agent demo script (#4) | P0 |
| Base Agents | $10K | Permissionless settlement exists | Settler bot (#3), Sepolia deploy (#1) | P0 |
| New France | $2K | Narrative done | Polish + live links (#6) | P1 |
| Futurllama | $2K | Narrative done | Polish + live links (#6) | P1 |
| Prosperia | $2K | Narrative done | Polish + SafetyModule helps (#9) | P1-P2 |
| ADI Open Project | $19K | Narrative drafted | Submission (#8) | P1 |
| Uniswap API | $5K | Not started | Full integration (#11) | P3 |
| 0g Labs DeFAI | $7K | Not started | Agent adapter (#13) | P3 |

**Realistic: $26K** (x402 + Base Agents + tracks) | **With polish: $45K** (add ADI + Uniswap)

---

## Disconnected Items (from audit)

These exist in code but aren't wired:

1. **AaveYieldAdapter** -- fully implemented, not in deploy script (MockYieldAdapter used)
2. **IHedgeAdapter interface** -- no implementation exists
3. **ParlayMath.applyEdge()** -- function exists, never called (edge computed differently in _buyTicket)
4. **sweepPenaltyShares** -- works but manual owner-only, no automation
5. **safetyModule address** -- routeFees sends USDC to deployer EOA, not a real contract
6. **MOCK_LEGS** -- ParlayBuilder hardcodes 3 legs instead of querying LegRegistry
7. **MultiplierClimb `crashed` prop** -- animation code exists, never triggered

---

## Pending Code Todos

9 items in `todos/` directory (P2-P3 severity). None block demo or bounties.

---

## Demo Connectivity Plan

### How Bets Stream (for demo)
- Pre-seed 5+ legs via AdminOracleAdapter before demo starts
- Buy 3-5 tickets from different funded wallets (creates visible activity)
- Settler bot auto-settles as legs resolve (creates streaming resolution)

### How Legs Resolve (for demo)
- AdminOracleAdapter.resolve(legId, Won/Lost) -- called by deployer wallet
- Can script with `cast send` commands or a demo-resolve script
- Each resolution triggers ticket settlement and multiplier updates

### How Agents Connect (testnet + mainnet)
- Settler bot: RPC endpoint + funded wallet + ParlayEngine address. Polls for resolved legs, calls settleTicket().
- Risk agent: Services API URL + USDC for x402 payments. Calls /premium/agent-quote, evaluates Kelly, calls buyTicketWithMode.
- Both need: Base Sepolia ETH (gas), USDC (for bets/payments), contract addresses from deploy output.

### Recommended Demo Sequence
```
BEFORE DEMO:
  1. Deploy to Base Sepolia (make deploy-sepolia)
  2. Run demo-seed.sh (creates legs, buys tickets)
  3. Start settler bot (scripts/settler-bot.ts)
  4. Start risk agent (scripts/risk-agent.ts)
  5. Start services (make dev-services)

DURING DEMO (5 minutes):
  [0:00-0:30] HOOK: "Watch your parlay odds climb -- cash out before they crash"
              Connect wallet, show the vault
  [0:30-1:30] BUY: Build 3-leg parlay, show fee breakdown (2.5%), buy ticket
  [1:30-2:30] RESOLVE: Admin resolves Leg 1 (win), Leg 2 (win)
              Multiplier climbs from 1x -> 2.5x -> 6.2x
              Show cashout value updating in real-time
  [2:30-3:00] CRASH: Cash out at 6.2x OR let Leg 3 lose (crash animation)
  [3:00-3:30] VAULT: Show LP deposit, lock at Gold tier, fee income
  [3:30-4:00] AGENTS: Show settler bot settling tickets in background
              Show risk agent paying x402, getting assessment
  [4:00-4:30] SAFETY: Vault caps, no admin drain, permissionless settlement
  [4:30-5:00] STORY: Rehab CTA concept, 10% social impact, "become the house"
```
