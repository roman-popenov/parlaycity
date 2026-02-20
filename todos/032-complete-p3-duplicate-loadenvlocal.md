---
status: complete
priority: p3
issue_id: "032"
tags: [code-review, duplication, pr18]
dependencies: []
---

# Duplicated loadEnvLocal() across agent scripts

## Problem Statement

settler-bot.ts and risk-agent.ts contain identical 15-line loadEnvLocal() functions. Extract to scripts/lib/env.ts.

## Acceptance Criteria

- [ ] Single loadEnvLocal implementation shared between scripts
- [ ] Unused LegStatus const deleted from settler-bot.ts
