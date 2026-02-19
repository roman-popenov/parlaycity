---
title: BigInt arithmetic hazards — overflow and division by zero
category: services/math
severity: medium
prs: [9]
commits: [4a323e6, b5bc00f]
tags: [bigint, number-overflow, kelly-criterion, max-safe-integer, division-by-zero]
date: 2026-02-19
---

# BigInt Arithmetic Hazards — Overflow and Division by Zero

## Problem

### Case 1: BigInt-to-Number overflow on extreme multipliers
`Number(fairMultiplierX1e6)` in the risk advisor silently loses precision when the BigInt exceeds `Number.MAX_SAFE_INTEGER` (2^53). A 5-leg parlay with near-zero probabilities (e.g., all legs at 1 PPM) produces a multiplier of ~1e30 — far beyond the safe integer range. The subsequent Kelly criterion and expected value calculations return silently wrong results.

Three independent review agents flagged this (security-sentinel, performance-oracle, kieran-typescript-reviewer).

### Case 2: BigInt division by zero in vault health endpoint
`pctOfTVL = Number((data.exposure * 10_000n) / totalAssets)` throws a `RangeError` when `totalAssets === 0n` (empty vault). The vault health endpoint crashes instead of returning a valid response with zero concentration.

## Root Cause
**Case 1**: JavaScript's `Number()` coerces any BigInt without error, even when the value exceeds 2^53. There's no runtime warning — precision is silently lost. The risk advisor computed `computeMultiplier()` in BigInt (correct) but then converted to `Number` for the Kelly formula (lossy).

**Case 2**: BigInt division by `0n` throws `RangeError: Division by zero`. Unlike floating-point division (which returns `Infinity` or `NaN`), BigInt division is strict. The vault health endpoint assumed `totalAssets > 0n` without checking.

## Solution
**Case 1**: Guard before conversion: if the BigInt exceeds `MAX_SAFE_INTEGER`, skip the Kelly calculation entirely and return `RiskAction.AVOID` with a warning. The parlay is too extreme for meaningful advisory math anyway.

```typescript
if (fairMultiplierX1e6 > BigInt(Number.MAX_SAFE_INTEGER)) {
  return res.json({
    action: RiskAction.AVOID,
    suggestedStake: "0.00",
    kellyFraction: 0,
    warnings: ["Multiplier too large for risk assessment"],
    // ... rest of response
  });
}
```

**Case 2**: Ternary guard before division:

```typescript
// Before:
const pctOfTVL = Number((data.exposure * 10_000n) / totalAssets) / 10_000;

// After:
const pctOfTVL = totalAssets > 0n ? Number((data.exposure * 10_000n) / totalAssets) / 10_000 : 0;
```

## Prevention (Category-Level)
- **Rule**: Every `Number(bigint)` conversion MUST be preceded by a `> BigInt(Number.MAX_SAFE_INTEGER)` guard. No exceptions.
- **Rule**: When BigInt arithmetic can grow exponentially (multiplied probabilities, factorial-like computations), assume it WILL exceed safe range and plan the overflow path.
- **Rule**: Advisory/display math can use Number; financial math should stay in BigInt until the final output boundary.
- **Rule**: When multiple review agents independently flag the same issue, treat it as high confidence — address it immediately.
- **Rule**: Every BigInt division MUST guard against zero divisor. Unlike `Number` division (which returns `Infinity`/`NaN`), `BigInt / 0n` throws `RangeError`. Always use `divisor > 0n ? ... : fallback`.
- **Rule**: When computing ratios like `pctOfTVL`, `utilizationBps`, or any percentage from BigInts, the denominator (totalAssets, totalSupply, etc.) can be zero in edge cases (empty vault, no deposits). Handle it explicitly.
