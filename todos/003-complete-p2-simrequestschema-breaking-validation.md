---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, schema, breaking-change, pr-9]
dependencies: []
---

# SimRequestSchema Breaking Validation Change

## Problem Statement

`SimRequestSchema` now inherits from `LegProbBaseSchema`, which constrains probabilities to `.int().min(1).max(999_999)`. The old schema accepted `.min(0).max(1_000_000)` and allowed floats. This is correct per Solidity contract requirements (0 < p < PPM), but it's a breaking change for any client sending boundary values (0 or 1,000,000) or float probabilities.

Flagged by: kieran-typescript-reviewer.

## Findings

- `packages/shared/src/schemas.ts` -- `LegProbBaseSchema` used by both `SimRequestSchema` and `RiskAssessRequestSchema`
- Old SimRequestSchema: probabilities `.min(0).max(1_000_000)` (floats OK)
- New SimRequestSchema: probabilities `.int().min(1).max(999_999)` (integers only, exclusive bounds)
- Tests cover the new validation but don't document the breaking change
- No existing client sends boundary values in practice (frontend builds valid requests)

## Proposed Solutions

### Option A: Document the breaking change in PR description
Note the tighter validation in PR description. No code change needed -- the new constraints are correct.
- Pros: Transparency, no code change
- Cons: If external clients exist, they break silently
- Effort: Small
- Risk: Low (no known external clients)

## Recommended Action

Option A. The new validation is correct per contract requirements. Just needs documentation.

## Technical Details

- Affected files: `packages/shared/src/schemas.ts`
- `parseSimRequest` now rejects: `probability: 0`, `probability: 1000000`, `probability: 0.5`

## Acceptance Criteria

- [ ] Breaking change documented in PR description or CHANGELOG

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Schema tightening is a breaking change even when correct |

## Resources

- PR #9: feat/risk-vault-services
