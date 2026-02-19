---
status: complete
priority: p3
issue_id: "005"
tags: [code-review, documentation, pr-9]
dependencies: []
---

# Documentation Drift: New Endpoints Not in CLAUDE.md or ARCHITECTURE.md

## Problem Statement

PR #9 adds `/premium/risk-assess`, `/vault/health`, and `/vault/yield-report` endpoints but doesn't update:
- `packages/services/CLAUDE.md` (routes list)
- `docs/ARCHITECTURE.md` (system diagrams)
- Root `CLAUDE.md` gap analysis (risk advisor and vault guardian should move from "NEEDS BUILDING" to partial)

Flagged by: architecture-strategist.

## Proposed Solutions

### Option A: Update all three docs
Add new routes to services CLAUDE.md, update architecture diagram, update gap analysis.
- Effort: Small
- Risk: None

## Acceptance Criteria

- [ ] `packages/services/CLAUDE.md` lists `/premium/risk-assess`, `/vault/health`, `/vault/yield-report`
- [ ] Root `CLAUDE.md` gap analysis updated for risk advisor and vault guardian status

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | New endpoints need doc updates |
