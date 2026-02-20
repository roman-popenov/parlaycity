---
status: complete
priority: p3
issue_id: "037"
tags: [code-review, agent-native, pr18]
dependencies: []
---

# Risk agent hardcodes CLASSIC payout mode

## Problem Statement

risk-agent.ts hardcodes payoutMode=0 (CLASSIC). Add AGENT_PAYOUT_MODE env var to support Progressive and EarlyCashout modes.

## Acceptance Criteria

- [ ] AGENT_PAYOUT_MODE env var controls payout mode (default: 0)
