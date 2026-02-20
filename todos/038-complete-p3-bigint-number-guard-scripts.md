---
status: complete
priority: p3
issue_id: "038"
tags: [code-review, type-safety, pr18]
dependencies: []
---

# BigInt-to-Number without MAX_SAFE_INTEGER guard in scripts

## Problem Statement

ticketCount and ticketId conversions via Number(bigint) lack MAX_SAFE_INTEGER guards per Lesson #11. Also multiplierX1e6 display conversion (line 352 risk-agent.ts).

## Acceptance Criteria

- [ ] Every Number(bigint) conversion has > BigInt(Number.MAX_SAFE_INTEGER) guard
