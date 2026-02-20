---
status: complete
priority: p1
issue_id: "014"
tags: [code-review, security, frontend, bigint, pr-12]
dependencies: []
---

# Unguarded Number(bigint) Conversions -- Use formatUnits

## Problem Statement

Multiple `Number(bigint) / 1e6` conversions in ParlayBuilder.tsx violate the project's own lesson #11: "Every `Number(bigint)` conversion MUST be guarded by `> BigInt(Number.MAX_SAFE_INTEGER)`." The PR already uses `formatUnits` from viem correctly in the `bankroll` field (line 245) but uses raw `Number()` conversion elsewhere. This creates inconsistency and potential precision loss for large values.

Affected locations:
- Lines 161-165: `freeLiquidityNum`, `maxPayoutNum`, `usdcBalanceNum`
- Line 408: Balance display `(Number(usdcBalance) / 1e6).toFixed(2)`
- Line 426: MAX button `(Number(usdcBalance) / 1e6).toString()`

## Findings

- Security sentinel: Finding #2, MEDIUM severity
- TypeScript reviewer: Finding #1, HIGH severity
- Learnings researcher: Matches lesson #11 (`docs/solutions/012-bigint-number-overflow.md`)
- Known pattern: `Number.MAX_SAFE_INTEGER / 1e6` = ~9 billion USDC. Unlikely for user balances but `freeLiquidity` is protocol-wide.
- File: `apps/web/src/components/ParlayBuilder.tsx:161-165, 408, 426`

## Proposed Solution

Replace `Number(bigint) / 1e6` with `formatUnits(bigint, 6)` consistently:

```typescript
// Before:
const freeLiquidityNum = freeLiquidity !== undefined ? Number(freeLiquidity) / 1e6 : 0;
const maxPayoutNum = maxPayout !== undefined ? Number(maxPayout) / 1e6 : 0;
const usdcBalanceNum = usdcBalance !== undefined ? Number(usdcBalance) / 1e6 : 0;

// After:
const freeLiquidityNum = freeLiquidity !== undefined ? parseFloat(formatUnits(freeLiquidity, 6)) : 0;
const maxPayoutNum = maxPayout !== undefined ? parseFloat(formatUnits(maxPayout, 6)) : 0;
const usdcBalanceNum = usdcBalance !== undefined ? parseFloat(formatUnits(usdcBalance, 6)) : 0;

// MAX button:
onClick={() => setStake(formatUnits(usdcBalance, 6))}

// Balance display:
Balance: {parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)}
```

**Pros:** Consistent with `bankroll` field pattern. `formatUnits` handles arbitrary precision. Follows project lessons.
**Cons:** `parseFloat` still loses precision for very large values, but the display context is acceptable.
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [x] All `Number(bigint) / 1e6` replaced with `formatUnits` pattern
- [x] No raw `Number(bigint)` conversions remain in ParlayBuilder.tsx
- [x] MAX button uses `formatUnits(usdcBalance!, 6)` directly
- [x] Balance display uses `parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)`
- [x] `make gate` passes

## Work Log

- 2026-02-20: Identified by security-sentinel and TypeScript reviewer during PR #12 review
- 2026-02-20: Fixed. Replaced all 5 `Number(bigint) / 1e6` with `parseFloat(formatUnits(..., 6))` or `formatUnits(..., 6)`. Added 2 tests: MAX button precision, balance display precision.

## Resources

- PR #12: `fix/pr10-review-findings`
- Lesson #11: `docs/solutions/012-bigint-number-overflow.md`
- viem `formatUnits` already imported at line 5
