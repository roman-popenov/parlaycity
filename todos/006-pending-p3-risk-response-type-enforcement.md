---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, typescript, type-safety, pr-9]
dependencies: []
---

# Response Types Not Enforced in Route Handlers

## Problem Statement

The risk advisor handler builds its response inline without using the `RiskAssessResponse` interface from `types.ts`. The vault endpoints have no response types at all. This means there's no compile-time guarantee that API responses match their documented interfaces.

Flagged by: kieran-typescript-reviewer, code-simplicity-reviewer.

## Proposed Solutions

### Option A: Type the response objects
Cast or annotate response objects with their interfaces. Remove unused interfaces (simplicity reviewer's recommendation) if they're not going to be used.
- Effort: Small
- Risk: None

### Option B: Derive types from Zod response schemas
Create Zod schemas for responses and derive types via `z.infer`. Consistent with request pattern.
- Effort: Medium
- Risk: None

## Acceptance Criteria

- [ ] Either use `RiskAssessResponse` in the handler OR remove the dead interface
- [ ] Decision documented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Dead types drift from reality |
