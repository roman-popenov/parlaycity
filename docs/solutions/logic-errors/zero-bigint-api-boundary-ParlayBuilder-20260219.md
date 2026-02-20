---
module: ParlayBuilder
date: 2026-02-19
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - "formatUnits(0n, 6) produces '0' which API Zod schema rejects (bankroll > 0)"
  - "Risk advisor silently fails when USDC balance is exactly zero"
  - "Guard usdcBalance !== undefined passes for 0n but API rejects the formatted value"
root_cause: missing_validation
resolution_type: code_fix
severity: medium
tags: [bigint, zero-value, api-boundary, falsy, formatUnits]
---

# Troubleshooting: Zero BigInt Produces API-Rejected Value at Boundary

## Problem

When a user's USDC balance is exactly `0n`, the ParlayBuilder sends `bankroll: "0"` to the risk advisor API. The API's Zod schema requires `bankroll > 0`, so the request is silently rejected. The user sees no risk advice with no error message.

## Environment

- Module: ParlayBuilder (frontend) / Risk Advisor (services)
- Affected Component: `apps/web/src/components/ParlayBuilder.tsx:242`, `packages/services/src/premium/risk-assess.ts`
- Date: 2026-02-19

## Symptoms

- Risk advisor returns no data when user has zero USDC balance
- No error displayed to user (silent failure)
- `formatUnits(0n, 6)` produces the string `"0"`, which passes frontend existence checks but fails API validation

## What Didn't Work

**Attempted Solution 1:** Use existence check `usdcBalance !== undefined`
- **Why it failed:** `0n` is defined (not `undefined`), so the check passes. But `formatUnits(0n, 6)` produces `"0"`, and the API rejects `bankroll <= 0`. The existence check does not distinguish "not loaded yet" from "loaded but zero."

**Previous fix (PR #10):** Use truthiness check `usdcBalance ? x : fallback`
- **Why it failed:** `0n` is falsy in JavaScript, so this treated zero balance as "not loaded" and always used the fallback. This was a different bug (treating valid zero as missing), fixed by switching to existence check -- which introduced THIS bug.

## Solution

Guard with BOTH existence AND positivity:

```typescript
// Before (broken -- 0n passes existence check, API rejects "0"):
bankroll: usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : "100",

// After (fixed -- zero balance uses fallback, positive balance converts):
bankroll:
  usdcBalance !== undefined && usdcBalance > 0n
    ? formatUnits(usdcBalance, 6)
    : "100",
```

Commit: `0210849`

## Why This Works

The root cause is a **three-way state mismatch**:

1. **`undefined`** = balance not loaded yet (use fallback)
2. **`0n`** = balance loaded, is zero (API rejects zero, use fallback)
3. **`> 0n`** = balance loaded, is positive (convert and send)

The previous fix only distinguished states 1 vs 2+3. The correct fix distinguishes all three states. The `> 0n` check handles both `undefined` (which would fail the first conjunct) and zero (which would fail the second conjunct).

This is the THIRD variant of the zero-value problem in this codebase:

1. **Lesson #17 (BigInt falsiness):** `usdcBalance ? x : fallback` treats `0n` as missing (truthiness)
2. **Lesson #12 (NaN bypass):** `parseFloat(".")` produces NaN but `"."` is truthy
3. **This finding:** `formatUnits(0n, 6)` produces `"0"` which API rejects

All three share the same underlying issue: JavaScript's falsy semantics for `0`, `0n`, `""`, and `NaN` create a class of bugs where valid-but-zero values are silently mishandled at type/API boundaries.

## Prevention

**The three-case guard pattern for BigInt-to-API conversions:**

```typescript
// ALWAYS use this pattern when sending BigInt-derived values to APIs:
value !== undefined && value > 0n
  ? convert(value)    // positive: convert and send
  : fallback          // undefined or zero: use safe default
```

**Checklist for every API call that derives values from BigInt state:**
1. Test with `undefined` (not loaded) -- should use fallback
2. Test with `0n` (valid zero) -- should use fallback OR handle explicitly
3. Test with a positive value -- should convert and send
4. Verify the API's Zod schema accepts the converted value

## Related Issues

- See also: [008-input-validation-boundaries.md](../008-input-validation-boundaries.md) -- NaN bypass on partial input
- See also: [012-bigint-number-overflow.md](../012-bigint-number-overflow.md) -- BigInt-to-Number overflow
- See also: [014-risk-advisor-frontend-bugs.md](../014-risk-advisor-frontend-bugs.md) -- BigInt falsiness (`0n` is falsy)
- See also: [015-review-round-2-findings.md](../015-review-round-2-findings.md) -- Pattern B: Zero/falsy values at API boundaries
- **Promoted to Required Reading:** [critical-patterns.md](../patterns/critical-patterns.md) -- Pattern #2
