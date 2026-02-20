---
title: Review round 2 findings (dead code, zero-value boundary, comment accuracy, type guard, spec completeness)
category: review/multi-pattern
severity: medium
prs: [12, 16, 17]
commits: [da97a3d, 0210849, b899e22]
tags: [dead-code, zero-value, bigint, comment-accuracy, type-guard, spec-completeness, api-boundary]
date: 2026-02-19
---

# 015: Review Round 2 Findings (PR #12, #16, #17)

Second round of automated reviews after rebasing and fixing first-round findings. Covers Copilot and Cursor Bug Bot across three PRs.

## Findings Summary

| # | Finding | PR | Severity | Root Cause | Fix |
|---|---------|-----|----------|------------|-----|
| 1 | Comment says `>= PPM` but code uses `> PPM` | #16 | Low | Comment copied without verifying boundary | `da97a3d` |
| 2 | JSDoc says "synchronous via useEffect" | #12 | Low | Misleading terminology | `0210849` |
| 3 | Zero-balance bankroll sends `"0"` to API that rejects `<= 0` | #12 | Medium | Missing BigInt edge-value guard | `0210849` |
| 4 | Exported `clearSessionState` never imported | #12 | Low | Caller removed but callee left behind | `0210849` |
| 5 | `IAMMRouter` interface referenced but never defined | #17 | Low | Spec introduced new contract type without interface | `b899e22` |
| 6 | `useSessionState` empty deps array | #12 | N/A | By design -- all keys are constant literals | No action |
| 7 | JUDGE_QA.md `cashoutEarly(minOut)` missing ticketId | #12 | Low | Already correct on main; rebase resolved | Rebase |

## Pattern Analysis

### Pattern A: Dead code from incremental refactoring

**What happened:** `clearSessionState` was exported in the same PR that added `useSessionState`. The `handleBuy` flow was then refactored to use state setters instead, but the utility function was left behind.

**Root cause:** When removing a caller, didn't check if the callee became orphaned.

**Prevention:** After removing any function call, grep for the function name. If zero callers remain and it's not a public API, delete it.

### Pattern B: Zero/falsy values at API boundaries

**What happened:** `formatUnits(0n, 6)` produces `"0"`, which the services `RiskAssessRequestSchema` rejects (bankroll must be `> 0`). The old code used `usdcBalance ? ...` (truthiness), the fix used `usdcBalance !== undefined` (existence) but missed `usdcBalance === 0n`.

**Root cause:** Three separate BigInt boundary bugs across PRs #10 and #12, all stemming from the same underlying issue: `0n` is falsy, and JavaScript boundary code rarely tests with zero.

**This is the THIRD time this pattern appeared:**
1. Lesson #17 (BigInt falsiness): `usdcBalance ? x : fallback` treats `0n` as missing
2. Lesson #12 (NaN bypass): `parseFloat(".")` produces NaN but `"."` is truthy
3. This finding: `formatUnits(0n, 6)` produces `"0"` which API rejects

**Prevention:** Every API call that derives values from BigInt state must test three cases: `undefined` (not loaded), `0n` (valid zero), and a positive value. The guard pattern is: `value !== undefined && value > 0n ? convert(value) : fallback`.

### Pattern C: Comment/doc accuracy divergence

**What happened:** Two instances:
1. `compute.ts` comment said `>= PPM` but code checks `> PPM`
2. `utils.ts` JSDoc said "synchronous via useEffect" but useEffect is post-render

**Root cause:** Comments written at the time of initial implementation, not updated when behavior was clarified or boundary conditions were verified.

**Prevention:** When writing a comment that describes a boundary condition, verify it against the actual code. When modifying behavior, update adjacent JSDoc. Treat comments as code -- they can be wrong.

### Pattern D: Incomplete type guards

**What happened:** `isValidRiskResponse` asserted `data is RiskAdviceData` but only validated 4 of 6 fields. TypeScript trusts the assertion, so `suggestedStake` and `winProbability` could be `undefined` at runtime despite the type saying otherwise.

**Root cause:** Type guard was written incrementally (only checking fields that were immediately used), not exhaustively.

**Prevention:** A type guard function must validate ALL fields of the asserted type, not just the ones currently consumed. If the type has N fields, the guard must check N fields. Otherwise narrow to a subset type.

### Pattern E: Spec references without definitions

**What happened:** REHAB_MODE.md introduced `IAMMRouter public ammRouter` and called `ammRouter.deployToLP()` but never defined the `IAMMRouter` interface.

**Root cause:** The spec focused on the calling contract's logic and assumed the reader would understand the interface from context.

**Prevention:** Every new contract type, interface, or struct referenced in a spec MUST have an explicit definition block in the same document.

## Critical Analysis: Recurring Themes

After 15 solutions docs and 19 lessons learned, three meta-patterns dominate:

1. **The Zero-Value Problem** (lessons #8, #12, #14, #17, this doc): JavaScript's falsy semantics for `0`, `0n`, `""`, and `NaN` create a class of bugs where valid zero values are treated as missing. This is the single most recurring bug category in this codebase. Every BigInt/Number/string conversion at an API boundary is a potential zero-value bug.

2. **The Stale Artifact Problem** (lessons #4, this doc patterns A/C): When code evolves incrementally, artifacts from previous iterations (dead exports, inaccurate comments, outdated docs) accumulate silently. Reviews catch them, but they shouldn't exist in the first place. The pattern is always: X was written for version N, code moved to version N+1, X was not updated.

3. **The Type Boundary Problem** (lessons #2, #11, #18, this doc pattern D): Every time data crosses a boundary (BigInt -> Number, TypeScript -> JSON, API response -> type guard), assumptions can silently break. The fix is always: validate exhaustively at the boundary, not partially.
