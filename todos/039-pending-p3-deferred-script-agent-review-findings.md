---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, scripts, deferred, pr26]
dependencies: []
---

# Deferred script/agent review findings from PR #26

## Context

PR #26 received extensive review from Copilot and Cursor Bugbot. These findings affect scripts and agent infrastructure that may be refactored or removed. Grouped here rather than individual todos.

## Findings

### 0g-inference.ts
- [ ] `.filter(Boolean)` in `buildRiskPrompt` removes intentional blank-line prompt separators
- [ ] Missing key check caching causes per-request log spam when ZG_PRIVATE_KEY unset
- [ ] Auto-fund ledger (`broker.ledger.addLedger`) has real monetary side effects without confirmation
- [ ] Empty apiKey causes OpenAI constructor to always throw (should skip construction)
- [ ] Empty 0G response (empty `completion.choices`) not handled

### agent-quote.ts
- [ ] 5s `Promise.race` timeout leaves pending setTimeout even when inference completes quickly
- [ ] Timeout error not distinguishable from inference error in response

### risk-agent.ts
- [ ] RISK_TOLERANCE env var cast to union type without validation
- [ ] CONFIDENCE_THRESHOLD not validated to 0.0-1.0 range
- [ ] LOOP_INTERVAL_MS not validated non-negative
- [ ] AGENT_BANKROLL used as string without numeric validation
- [ ] AgentQuoteResponse/AiInsight types redefined locally (duplicates shared types)

### package.json
- [ ] @0glabs/0g-serving-broker should be pinned exact (not ^0.7.1) -- peer dep requires ethers exactly 6.13.1

### ticket/[id]/page.tsx
- [ ] useReplay setTimeout not cleared on component unmount

## Resources

- PR #26: https://github.com/roman-popenov/parlaycity/pull/26
- Reviews: rounds 1-5 from Copilot and Cursor Bugbot
