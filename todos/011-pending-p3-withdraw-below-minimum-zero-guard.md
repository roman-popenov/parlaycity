---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, frontend, ux-consistency, pr-9]
dependencies: []
---

# withdrawBelowMinimum Missing Zero-Amount Guard

## Problem Statement

In `apps/web/src/components/VaultDashboard.tsx:160`, `withdrawBelowMinimum` uses `withdrawParsed > 0` (strict greater-than) while `depositBelowMinimum` and `lockBelowMinimum` use `>= 0`. When the user types "0":

- Deposit button: disabled (correct)
- Lock button: disabled (correct)
- Withdraw button: **enabled** (incorrect)

The `handleWithdraw` handler has its own `!amount` guard preventing the actual transaction, but the enabled button with no error feedback is a UX inconsistency.

## Findings

- Cursor Bugbot review #3828737621 on PR #9, commit `b5bc00f`
- Comment ID: 2830339963
- Low severity — no financial risk, just UX inconsistency
- Replied acknowledging and deferring to next PR

## Proposed Solution

Change `withdrawParsed > 0` to `withdrawParsed >= 0`:

```typescript
// Before:
const withdrawBelowMinimum = withdrawAmount !== "" && !isNaN(withdrawParsed) && withdrawParsed > 0 && withdrawAmountBigInt === 0n;

// After:
const withdrawBelowMinimum = withdrawAmount !== "" && !isNaN(withdrawParsed) && withdrawParsed >= 0 && withdrawAmountBigInt === 0n;
```

## Acceptance Criteria

- [ ] Typing "0" in withdraw input disables the withdraw button
- [ ] Withdraw button label shows "Amount Too Small" for "0" input
- [ ] Deposit and lock behavior unchanged
- [ ] Existing withdraw tests still pass
- [ ] `make gate` passes
