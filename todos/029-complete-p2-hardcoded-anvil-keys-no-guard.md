---
status: pending
priority: p2
issue_id: "029"
tags: [code-review, security, pr18, pr19]
dependencies: []
---

# Hardcoded Anvil private keys without non-local guard

## Problem Statement

Both agent scripts (settler-bot.ts, risk-agent.ts) and demo shell scripts (demo-seed.sh, demo-resolve.sh) default to well-known Anvil private keys. When RPC_URL points to a non-local endpoint but PRIVATE_KEY is not set, scripts silently use the Anvil key on a live network.

## Proposed Solutions

### Option A: Require PRIVATE_KEY for non-local RPC (Recommended)
```typescript
const isLocal = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost");
if (!isLocal && !process.env.PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY required for non-local RPC");
}
```
- Effort: Small

## Acceptance Criteria

- [ ] Scripts refuse to use default keys when RPC_URL is non-local
- [ ] Clear error message directs user to set PRIVATE_KEY

## Resources

- PRs #18, #19
- Lesson #7: Production env vars must throw on zero/empty defaults
