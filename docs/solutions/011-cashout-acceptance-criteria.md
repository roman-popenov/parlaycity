---
title: Cashout acceptance criteria and test matrix
category: spec/cashout
severity: n/a
prs: []
tags: [cashout, acceptance-criteria, test-matrix, crash-parlay]
date: 2026-02-19
---

# Cashout Acceptance Criteria

Cashout is ParlayCity's core differentiator -- the "crash-parlay" mechanic where the multiplier climbs as legs resolve and users choose their own exit point.

## PR #8 Status
Progressive settlement (`claimProgressive`) and early cashout (`cashoutEarly`) are implemented in `ParlayEngine.sol` with `PayoutMode` enum. The math library (`ParlayMath.computeCashoutValue`) is implemented and parity-tested.

## Acceptance Criteria

### Contract Layer

| # | Criterion | Status |
|---|-----------|--------|
| C1 | `cashoutEarly(ticketId, minOut)` callable by ticket owner only | Implemented |
| C2 | Requires at least one unresolved leg | Implemented |
| C3 | `cashoutValue = fairValue * (1 - penaltyBps / BPS)` | Implemented (fixed double-discount) |
| C4 | `require(cashoutValue >= minOut)` slippage protection | Implemented |
| C5 | `require(payout > 0)` prevents zero-value cashout | Implemented |
| C6 | `claimedAmount` updated before payment (CEI) | Implemented |
| C7 | Reserved liability released after cashout | Implemented |
| C8 | `cashoutValue <= potentialPayout` always | Implemented |
| C9 | Ticket status -> Claimed after cashout | Implemented |
| C10 | EarlyCashout event emits actual payout amount | Implemented |
| C11 | Oracle staleness check before computing probabilities | NOT IMPLEMENTED |
| C12 | Progressive + cashout combo: partial claims then cashout remainder | Implemented |

### Frontend Layer

| # | Criterion | Status |
|---|-----------|--------|
| F1 | "Cash Out" button on ticket detail page | Wired (PR #8 branch) |
| F2 | Shows current cashout value with USD equivalent | Partial (value shown, no USD) |
| F3 | minOut slippage input with default (e.g., 1% tolerance) | NOT IMPLEMENTED |
| F4 | Button disabled during pending/confirming states | Implemented |
| F5 | MultiplierClimb visualization updates as legs resolve | EXISTS (component) but no live data feed |
| F6 | "Crash" animation when leg loses (value -> 0) | NOT IMPLEMENTED |
| F7 | Cashout button hidden when all legs resolved | Implemented |
| F8 | Shows breakdown: fairValue, penalty, netPayout | NOT IMPLEMENTED |

### Edge Case Test Matrix

| # | Scenario | Expected | Tested |
|---|----------|----------|--------|
| E1 | Cashout with 0 unresolved legs | Revert: "no unresolved legs" | Yes |
| E2 | Cashout with all legs won | Revert (settlement path instead) | Yes |
| E3 | Cashout with 1 leg lost | Revert: ticket already lost | Yes |
| E4 | Cashout value rounds to 0 (tiny stake, low probability) | Revert: "zero cashout value" | Yes |
| E5 | minOut > cashoutValue (slippage exceeded) | Revert: "below minimum" | Yes |
| E6 | Non-owner calls cashout | Revert: "not ticket owner" | Yes |
| E7 | Cashout after partial progressive claims | Pays remainder only | Yes |
| E8 | Cashout when vault has insufficient free liquidity | Revert from vault | Needs test |
| E9 | Cashout + simultaneous leg resolution (race) | Must resolve cleanly | Needs test |
| E10 | Cashout with voided leg in mix | Uses recalculated payout | Yes |
| E11 | Multiple cashout attempts on same ticket | Second reverts (status = Claimed) | Yes |
| E12 | Cashout penalty = 0 BPS (no penalty config) | Full fair value paid | Needs test |
| E13 | Cashout penalty = 10000 BPS (100%, max) | Zero payout, reverts | Needs test |
| E14 | Gas cost for cashout < $0.01 on Base | Verify | Needs benchmark |

### Integration / UX Tests

| # | Scenario | Status |
|---|----------|--------|
| I1 | Buy ticket -> 1 leg wins -> cashout -> verify vault balance | Needs test |
| I2 | Buy progressive ticket -> claim 2 legs -> cashout remainder | Needs test |
| I3 | Frontend: connect -> buy -> watch multiplier -> click cashout | Manual test only |
| I4 | Risk advisor shows cashout value alongside ticket info | Partial (service endpoint exists) |

## Blocking for Demo
Must have for ETHDenver demo: C1-C10, F1, F4, F7, E1-E7, E11.
Nice to have: F2 (USD), F5 (live multiplier), F6 (crash animation).
Post-hackathon: C11 (oracle staleness), F3 (slippage input), F8 (breakdown display).
