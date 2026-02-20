---
status: pending
priority: p3
issue_id: "036"
tags: [code-review, agent-native, pr20]
dependencies: ["023", "025"]
---

# No cashout quote endpoint for agents

## Problem Statement

The crash game loop's core feature (live cashout) is UI-only. Agents have no API to compute current cashout values. Need POST /quote/cashout or GET /ticket/:id/cashout-value in services.

## Acceptance Criteria

- [ ] Service endpoint returns current cashout value for a ticket ID
- [ ] Uses shared math library (not a third copy)
