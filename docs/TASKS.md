# ParlayCity -- Task Board

## Contracts Agent

### PR1: FeeRouter (90/5/5 Split)
- [ ] Design fee routing approach (inline in ParlayEngine vs separate FeeRouter contract)
- [ ] Implement fee split: 90% to LockVault, 5% to SafetyModule, 5% stays in vault
- [ ] Add HouseVault method to transfer fee portions out safely
- [ ] Write unit tests for fee routing (exact split, rounding, edge cases)
- [ ] Update integration test to verify end-to-end fee flow
- [ ] Run invariant tests -- solvency invariant must hold
- [ ] `make gate` passes

### PR2: SafetyModule
- [ ] Create `SafetyModule.sol` -- receive USDC, track balance, enforce cap, redistribute surplus
- [ ] Create `ISafetyModule.sol` interface
- [ ] Wire to FeeRouter (receives 5% of fees)
- [ ] Wire penalty redistribution from LockVault (replace sweepPenaltyShares)
- [ ] Write unit tests (receive, cap, surplus redistribution, no owner drain)
- [ ] Update deploy script to include SafetyModule in deployment sequence
- [ ] `make gate` passes

### PR3: Cashout Mechanism
- [ ] Add `computeCashoutValue(potentialPayout, remainingProbs[], cashoutFeeBps, riskSpreadBps)` to ParlayMath.sol
- [ ] Mirror `computeCashoutValue` in `packages/shared/src/math.ts`
- [ ] Add math parity test between Solidity and TypeScript
- [ ] Add `cashoutTicket(ticketId, minOut)` to ParlayEngine
- [ ] Handle reserve release on cashout (release potentialPayout, transfer cashoutValue)
- [ ] Add CASHED_OUT status to ticket state machine
- [ ] Write unit tests: normal cashout, slippage protection (minOut), all legs resolved, no legs resolved
- [ ] Write fuzz tests: cashout value never exceeds reserved liability
- [ ] Run full test suite including invariant tests
- [ ] `make gate` passes

---

## Services Agent

### PR4: Real x402 Verification -- MERGED (PR#5)
- [x] Research @x402/express API -- understand middleware pattern, payment verification flow
- [x] Install @x402/express as dependency in packages/services
- [x] Replace stub middleware with real x402 payment verification
- [x] Configure USDC payment on Base (address, amount, network)
- [x] Add proper 402 response with payment instructions (resource URL, payment details)
- [x] Write integration tests (valid payment, missing payment, invalid payment)
- [x] `make gate` passes

---

## Web Agent

### PR5: Sponsor UX (Paymaster + OnchainKit + Base Sepolia Deployment)
- [ ] Add `deploy-sepolia` target to Makefile
- [ ] Configure foundry for Base Sepolia RPC
- [ ] Deploy and verify contracts on Base Sepolia
- [ ] Research Base Paymaster integration (0xf5d253B62543C6Ef526309D497f619CeF95aD430)
- [ ] Add paymaster config to wagmi.ts
- [ ] Create gasless transaction wrapper for write hooks
- [ ] Test gasless buyTicket on Base Sepolia
- [ ] Test gasless deposit/lock on Base Sepolia
- [ ] Integrate OnchainKit components where appropriate
- [ ] Verify frontend connects to Sepolia deployment
- [ ] `make gate` passes

### PR6: Crash UX & Rehab Mode
- [ ] Add `useCashoutTicket` write hook in hooks.ts
- [ ] Wire MultiplierClimb component to real cashoutTicket contract call
- [ ] Add cashout button on ticket detail page (visible when legs are partially resolved)
- [ ] Show real-time cashout value based on resolved legs
- [ ] Create rehab CTA component ("Stop losing, start earning -- become the house")
- [ ] Show rehab CTA on ticket detail page when ticket loses
- [ ] Link rehab CTA to /vault page
- [ ] `make gate` passes

---

## Team Lead

### PR0: Narrative Documentation
- [ ] Write docs/PLAN.md -- execution plan
- [ ] Write docs/TASKS.md -- per-agent task board
- [ ] Write docs/JUDGE_QA.md -- 10 judge questions with crisp answers
- [ ] Write docs/ONE_PAGER.md -- single page pitch
- [ ] Write docs/CLAIM_LEDGER.md -- 15 verified claims with sources
- [ ] Write docs/LP_SEEDING.md -- bootstrapping plan
- [ ] Write docs/FAIRNESS.md -- on-chain fairness analysis
- [ ] Update docs/BOUNTY_MAP.md with new bounty research
- [ ] Update docs/COMPETITORS.md with deep dive results
- [ ] Fix claim corrections in docs/ECONOMICS.md (#1: Aviator monthly not annual, #2: MAU updated, #3: replace 40% growth)

### PR7: Stretch Bounties
- [ ] 0g Labs DeFAI: risk explainer agent using 0g inference
- [ ] ADI Payments: in-app cosmetic purchases (ticket skins, profile items)
- [ ] ADI Open Project: application and narrative
