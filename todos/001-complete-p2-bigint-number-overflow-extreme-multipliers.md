---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, security, correctness, pr-9]
dependencies: []
---

# BigInt-to-Number Precision Loss on Extreme Multipliers

## Problem Statement

`Number(fairMultiplierX1e6)` in `risk/index.ts:44` can exceed `Number.MAX_SAFE_INTEGER` (2^53) for extreme 5-leg parlays with very low probabilities. This silently produces wrong Kelly criterion and expected value calculations.

Example: `computeMultiplier([1,1,1,1,1])` produces a BigInt far exceeding safe integer range. `Number()` will lose precision without error.

This is advisory-only (not financial), so it won't cause fund loss, but produces incorrect risk advice for edge-case inputs.

Flagged by: security-sentinel, performance-oracle, kieran-typescript-reviewer.

## Findings

- `packages/services/src/risk/index.ts:44` -- `const fairMultFloat = Number(fairMultiplierX1e6) / PPM`
- Tests cover extreme probabilities but don't assert precision of the Kelly output
- The same pattern exists in `premium/index.ts:36` (pre-existing, not new in this PR)

## Proposed Solutions

### Option A: Guard with MAX_SAFE_INTEGER check
Add a clamp before conversion: if BigInt exceeds safe range, cap the advisory output and flag it.
- Pros: Simple, 3-line fix
- Cons: Loses accuracy for extreme inputs
- Effort: Small
- Risk: Low

### Option B: Use BigInt arithmetic for Kelly calculation
Keep everything in BigInt/PPM scale until the final display conversion.
- Pros: Full precision
- Cons: More complex, Kelly formula needs rework in integer math
- Effort: Medium
- Risk: Low

## Recommended Action

Option A for hackathon. Option B post-hackathon.

## Technical Details

- Affected files: `packages/services/src/risk/index.ts`, `packages/services/src/premium/index.ts`
- Trigger: 5-leg parlay with all probabilities near 1 PPM (essentially impossible bets)

## Acceptance Criteria

- [ ] `Number()` conversion guarded against exceeding `MAX_SAFE_INTEGER`
- [ ] Extreme multiplier inputs produce a clamped/flagged response, not silently wrong values
- [ ] Existing tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Cross-agent consensus (3 agents flagged) |

## Resources

- PR #9: feat/risk-vault-services
- Related: docs/solutions/002-unit-scale-mismatch.md (Kelly criterion mixes units)
