---
status: complete
priority: p2
issue_id: "029"
tags: [code-review, security, pr18, pr19]
dependencies: []
---

# Hardcoded Anvil private keys without non-local guard

## Problem Statement

Both agent scripts (settler-bot.ts, risk-agent.ts) and demo shell scripts (demo-seed.sh, demo-resolve.sh) default to well-known Anvil private keys. When NETWORK is "local" but BASE_SEPOLIA_RPC_URL is set in the environment, the user may have forgotten to pass "sepolia" as an argument.

## Solution

Added safety guard in both scripts: when running in local mode, check if BASE_SEPOLIA_RPC_URL env var is set. If so, print a warning and require y/N confirmation before continuing. Agent scripts (settler-bot.ts, risk-agent.ts) also check for non-local RPC without PRIVATE_KEY.

## Acceptance Criteria

- [x] Scripts warn when NETWORK is local but BASE_SEPOLIA_RPC_URL is set
- [x] User must confirm (y/N) to continue with local mode
- [x] Scripts refuse to use default keys when RPC_URL is non-local
