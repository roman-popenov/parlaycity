---
status: complete
priority: p1
issue_id: "013"
tags: [code-review, security, frontend, input-validation, pr-12]
dependencies: []
---

# Unsanitized suggestedStake From API Bypasses Input Validation

## Problem Statement

`riskAdvice.suggestedStake` from the risk advisor API response is set directly into the `stake` state without passing through `sanitizeNumericInput`. The type guard `isValidRiskResponse` only checks `typeof d.suggestedStake === "string"` -- it does not validate the format. A malicious or misconfigured API server could return scientific notation (`"1e18"`), hex (`"0x1F4"`), or negative values (`"-100"`), which would be set as the stake string, persist to sessionStorage, and be consumed by `parseFloat(stake)`.

## Findings

- Security sentinel (PR #12 review): Finding #1, MEDIUM severity
- TypeScript reviewer: Finding #8, noted unnecessary `riskAdvice!` non-null assertion at same location
- Learnings researcher: Pattern matches lesson #8 (input validation boundaries) -- `parseDecimal` is the single entry point for user numeric input, but API-sourced values bypass it
- File: `apps/web/src/components/ParlayBuilder.tsx:529`

## Proposed Solution

Wrap `suggestedStake` in `sanitizeNumericInput` before setting state:

```typescript
// Before:
onClick={() => setStake(riskAdvice!.suggestedStake)}

// After:
onClick={() => setStake(sanitizeNumericInput(riskAdvice!.suggestedStake))}
```

Additionally, strengthen `isValidRiskResponse` to validate the format:

```typescript
typeof d.suggestedStake === "string" &&
/^\d+(?:\.\d*)?$/.test(d.suggestedStake) &&
```

**Pros:** Defense-in-depth at both the type guard and the click handler. One-line fix at the click handler, small regex addition in type guard.
**Cons:** None.
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [x] `suggestedStake` passes through `sanitizeNumericInput` before `setStake`
- [x] `isValidRiskResponse` validates `suggestedStake` format with decimal regex
- [x] Test: mock API returning `suggestedStake: "1e18"` -- verify it is sanitized
- [x] `make gate` passes

## Work Log

- 2026-02-20: Identified by security-sentinel and TypeScript reviewer during PR #12 review
- 2026-02-20: Fixed. Added regex `/^\d+(?:\.\d*)?$/` to `isValidRiskResponse` type guard. Wrapped `suggestedStake` in `sanitizeNumericInput()` at click handler. Added 3 tests: rejects scientific notation, rejects negative values, verifies sanitized value applied.

## Resources

- PR #12: `fix/pr10-review-findings`
- Lesson #8: `docs/solutions/008-input-validation-boundaries.md`
- Critical pattern: `parseDecimal` is single entry point for numeric input
