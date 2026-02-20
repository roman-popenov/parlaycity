---
module: ParlayBuilder
date: 2026-02-20
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - "Math.round(prob * 1_000_000) produces 0 for tiny probabilities, rejected by schema min(1)"
  - "Math.round(prob * 1_000_000) produces 1_000_000 for near-1 probabilities, rejected by schema max(999_999)"
root_cause: missing_validation
resolution_type: code_fix
severity: medium
tags: [probability, rounding, clamping, api-boundary, schema-validation]
---

# Troubleshooting: Probability Rounding Exceeds Schema Range

## Problem

When converting floating-point probabilities to PPM integers for the risk advisor API, `Math.round(prob * 1_000_000)` can produce values outside the valid schema range `[1, 999_999]`. Tiny probabilities (e.g., 0.0000001) round to 0, and near-1 probabilities (e.g., 0.9999999) round to 1,000,000. Both are rejected by the `RiskAssessRequestSchema` Zod validation.

## Environment

- Module: ParlayBuilder (frontend)
- Affected Component: `apps/web/src/components/ParlayBuilder.tsx:226`
- Schema: `packages/shared/src/schemas.ts:56` -- `z.number().int().min(1).max(999_999)`
- Date: 2026-02-20

## Symptoms

- Risk advisor request fails with 400 for extreme probability values
- Edge-case legs (very likely or very unlikely outcomes) cause silent API rejection
- No error shown to user when probability rounds to exactly 0 or 1,000,000

## What Didn't Work

**Direct solution:** The problem was identified by Copilot code review on first inspection. No incorrect attempts.

## Solution

Clamp the rounded value to the schema's valid range after rounding:

```typescript
// Before (broken -- can produce 0 or 1_000_000):
const prob = 1 / effectiveOdds(s.leg, s.outcomeChoice);
return Math.round(prob * 1_000_000);

// After (fixed -- always within [1, 999_999]):
const prob = 1 / effectiveOdds(s.leg, s.outcomeChoice);
const scaled = Math.round(prob * 1_000_000);
return Math.min(999_999, Math.max(1, scaled));
```

## Why This Works

`Math.round()` performs standard rounding. For values very close to 0 or 1, the result can land exactly on the boundary (0 or 1,000,000). The schema enforces strict `[1, 999_999]` because:
- `0` means "impossible" (no probability) -- invalid for a selectable leg
- `1,000,000` (PPM) means "certain" -- no bet should have 100% probability

The `Math.min/Math.max` clamp ensures the value stays within the valid range regardless of the input probability, while preserving the intended PPM scale for all normal values.

## Prevention

**Pattern: Clamp after rounding for schema-bounded integers.**

When converting a continuous value (float) to a discrete schema-bounded integer:
1. Compute the raw scaled value
2. Round it
3. Clamp to the schema's `[min, max]` range

This three-step pattern prevents boundary violations that pure rounding allows.

```typescript
// Generic pattern:
const raw = Math.round(continuousValue * SCALE);
const clamped = Math.min(SCHEMA_MAX, Math.max(SCHEMA_MIN, raw));
```

## Related Issues

- See also: [008-input-validation-boundaries.md](../008-input-validation-boundaries.md) -- boundary validation at input edges
- See also: [002-unit-scale-mismatch.md](../002-unit-scale-mismatch.md) -- PPM/BPS scale confusion
- See also: [zero-bigint-api-boundary-ParlayBuilder-20260219.md](zero-bigint-api-boundary-ParlayBuilder-20260219.md) -- another API boundary validation issue
- **Promoted to Required Reading:** [critical-patterns.md](../patterns/critical-patterns.md) -- Pattern #1
