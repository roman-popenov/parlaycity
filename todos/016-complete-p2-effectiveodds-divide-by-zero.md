---
status: complete
priority: p2
issue_id: "016"
tags: [code-review, frontend, math, edge-case, pr-12]
dependencies: []
---

# effectiveOdds Divides by Zero When odds === 1

## Problem Statement

`effectiveOdds` returns `leg.odds / (leg.odds - 1)` for `outcome === 2`. If `leg.odds === 1` (even money), the denominator is 0 and the function returns `Infinity`. This flows into `1 / effectiveOdds(...)` which becomes 0, then clamped to 1 by the PPM guard. The result is mathematically nonsensical (a PPM of 1 for an even-money bet) but doesn't crash.

Current mock data has odds of 2.86, 4.0, 5.0, so this won't trigger now. But with dynamic market data, `odds === 1` is possible.

## Findings

- TypeScript reviewer: Finding #5, MEDIUM severity
- File: `apps/web/src/components/ParlayBuilder.tsx:51`

## Proposed Solution

Guard the edge case:

```typescript
function effectiveOdds(leg: MockLeg, outcome: number): number {
  if (outcome === 2) {
    return leg.odds <= 1 ? Infinity : leg.odds / (leg.odds - 1);
  }
  return leg.odds;
}
```

Or document the precondition that `odds > 1` is required.

**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [x] `effectiveOdds` handles `odds <= 1` by returning `leg.odds` (guard clause)
- [ ] Test covering `odds === 1` edge case (function is module-private; guard is defensive)
- [x] `make gate` passes
