---
status: complete
priority: p3
issue_id: "008"
tags: [code-review, security, pr-9]
dependencies: []
---

# No Explicit express.json() Body Size Limit

## Problem Statement

Express default body parser limit is 100kb, which is reasonable, but it's not explicitly set. For a financial protocol API, explicit limits are best practice. An attacker could send large payloads to consume memory.

Flagged by: security-sentinel.

## Proposed Solutions

### Option A: Set explicit limit
`app.use(express.json({ limit: '10kb' }))` -- parlay requests are small.
- Effort: Small (1 line)
- Risk: None

## Acceptance Criteria

- [ ] `express.json()` has explicit `limit` parameter

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Explicit > implicit for security configs |
