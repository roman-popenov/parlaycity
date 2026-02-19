---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, testing, simplicity, pr-9]
dependencies: []
---

# Duplicate Test Coverage in risk.test.ts (~250 LOC)

## Problem Statement

`risk.test.ts` (1140 lines) tests the same validation 2-3 times via HTTP, direct schema calls, and schema-dedup verification. Same hex/octal/binary rejection, zero probability, etc. appear at multiple layers. ~250 LOC could be removed without reducing bug-catching ability.

Flagged by: code-simplicity-reviewer.

## Proposed Solutions

### Option A: Keep HTTP tests, remove direct schema + dedup tests
HTTP tests cover the full stack including middleware. Direct schema tests are redundant.
- Effort: Small (delete ~250 lines)
- Risk: None (HTTP tests catch all the same bugs)

## Acceptance Criteria

- [ ] No test covers the same validation at more than one layer
- [ ] All unique test scenarios still covered

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Test at one layer, not three |
