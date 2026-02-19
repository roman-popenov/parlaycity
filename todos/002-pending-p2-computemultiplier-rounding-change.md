---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, math-parity, correctness, pr-9]
dependencies: []
---

# computeMultiplier Refactor Changes Rounding Behavior

## Problem Statement

The `computeMultiplier` function in `packages/shared/src/math.ts` was refactored from deferred division (`PPM^(n+1) / product(probs)`) to iterative division (`multiplier = multiplier * PPM / prob_i`). This matches Solidity's iterative pattern (correct per the parity invariant), but intermediate BigInt truncation produces slightly different results for certain inputs.

The change is silent -- no PR description mention, no migration note. Existing parity tests pass, which suggests the rounding difference is within acceptable bounds or the test inputs don't trigger it.

Flagged by: kieran-typescript-reviewer.

## Findings

- Old: `(numerator * ppm) / denominator` where numerator = `PPM^n`, denominator = `product(probs)` -- single final division
- New: `multiplier = (multiplier * ppm) / BigInt(p)` per leg -- intermediate truncation at each step
- The Solidity contract uses iterative division, so this is the correct parity fix
- Tests pass, but edge cases with coprime probabilities could differ
- Input validation now also added (empty array throws, out-of-range throws)

## Proposed Solutions

### Option A: Add a comment and PR description note
Document that the rounding change is intentional for Solidity parity. Add a test comparing old vs new for a range of inputs to prove convergence.
- Pros: Low effort, documents the decision
- Cons: Doesn't fix the rounding gap (if any)
- Effort: Small
- Risk: Low

### Option B: Add exhaustive parity fuzz test
Run both old and new implementations across random probability arrays and assert they either match or differ by at most 1 unit.
- Pros: Proves correctness for all practical inputs
- Cons: Test-only change, doesn't affect production
- Effort: Small-Medium
- Risk: None

## Recommended Action

Option A now (document it). Option B is good follow-up.

## Technical Details

- Affected files: `packages/shared/src/math.ts`
- The change also adds input validation (empty array, out-of-range probabilities)
- All existing tests pass

## Acceptance Criteria

- [ ] PR description updated to call out the rounding behavior change
- [ ] Comment in code explaining why iterative division is used (Solidity parity)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Silent math changes need explicit callouts |

## Resources

- PR #9: feat/risk-vault-services
- Invariant: CLAUDE.md "Shared math parity" rule
- packages/contracts/CLAUDE.md Solidity math details
