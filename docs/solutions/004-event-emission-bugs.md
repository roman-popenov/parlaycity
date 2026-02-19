---
title: Events emitting wrong or missing data
category: contracts/events
severity: medium
prs: [4, 8]
tags: [events, indexing, off-chain, monitoring]
date: 2026-02-18
---

# Events Emitting Wrong or Missing Data

## Problem
Three event emission bugs found by reviewers:

1. **FeesRouted hardcodes feeToVault=0 (PR #4)**: `routeFees` emitted `FeesRouted` with `feeToVault=0` because the function didn't compute or receive the vault's share. Off-chain indexers would show zero vault fees.

2. **FeesRouted emits when transfer skipped (PR #4)**: When `lockVault` or `safetyModule` was `address(0)`, event still emitted the full fee amounts even though no transfer occurred. Dashboards would show fees as distributed when they stayed in vault.

3. **TicketPurchased missing payoutMode (PR #8)**: New `PayoutMode` field stored in struct but not emitted in purchase event. Indexers couldn't distinguish classic/progressive/cashout tickets without extra RPC calls.

## Root Cause
Events are treated as afterthoughts -- developers write the logic, then add events at the end. Event params often mirror function params rather than actual execution results.

## Solution
- Emit actual transferred amounts (not intended amounts)
- Include all struct fields that affect downstream behavior
- Set event params to zero when transfers are skipped

## Prevention (Category-Level)
- **Rule**: Events MUST emit actual outcomes, not intended values. If a transfer was skipped, emit 0.
- **Rule**: When adding a field to a struct, check if it should also be in the corresponding event.
- **Rule**: Events are the primary API for off-chain systems. Treat them as a public interface contract.
- Added to security checklist in `packages/contracts/CLAUDE.md`.
