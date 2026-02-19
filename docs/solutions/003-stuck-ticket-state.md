---
title: Tickets stuck in Won status with no claim path
category: contracts/state-machine
severity: medium
prs: [8]
tags: [progressive, cashout, state-transition, dead-state]
date: 2026-02-19
---

# Tickets Stuck in Won Status With No Claim Path

## Problem
Three variants of the same bug -- tickets entering `Won` status where `claimPayout` reverts because `remaining = potentialPayout - claimedAmount = 0`:

1. **Voided-leg recalculation**: When voided-leg recalculation produces `newPayout <= claimedAmount`, ticket set to `Won` but `claimPayout` reverts on `require(remaining > 0)`.

2. **Progressive fully claimed**: When a PROGRESSIVE ticket claims all legs via `claimProgressive()` before `settleTicket()` is called, settlement unconditionally set `Won` -- but there's nothing left to claim.

3. **claimPayout missing state update**: `claimPayout` paid out but never wrote `ticket.claimedAmount = ticket.potentialPayout`, so `getTicket()` returned incorrect `claimedAmount`.

## Root Cause
The state machine had implicit assumptions about claim ordering that weren't enforced. `Won` was set unconditionally without checking if the payout was already exhausted.

## Solution
Conditional status assignment in all settlement paths:
```solidity
ticket.status = ticket.potentialPayout > ticket.claimedAmount
    ? TicketStatus.Won
    : TicketStatus.Claimed;
```

Plus: `claimPayout` now writes `ticket.claimedAmount = ticket.potentialPayout` before payment.

## Prevention (Category-Level)
- **Rule**: Every state transition MUST be reachable. If a status is set, there MUST be a function that can move to the next status. Dead states are bugs.
- **Rule**: Before setting a "claimable" status (Won), verify there's actually something to claim (`remaining > 0`).
- **Rule**: Any function that pays out MUST update `claimedAmount` to match what was paid, even if a subsequent status change would prevent double-claims.
- **Rule**: Write a state machine diagram for new stateful contracts. Every edge must be tested.
- Test: `test_progressive_fullyClaimed_settlesAsClaimed` regression covers this category.
