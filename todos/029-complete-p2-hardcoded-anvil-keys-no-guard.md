---
status: complete
priority: p2
issue_id: "029"
tags: [code-review, security, pr19]
dependencies: []
---

# Hardcoded Anvil private keys without non-local guard

## Problem Statement

Both demo shell scripts (demo-seed.sh, demo-resolve.sh) default to well-known Anvil private keys. When NETWORK is "local" but BASE_SEPOLIA_RPC_URL is set in the environment, the user may have forgotten to pass "sepolia" as an argument.

## Solution

Added safety guard in both scripts: when running in local mode, check if BASE_SEPOLIA_RPC_URL env var is set. If so, print a warning and require y/N confirmation before continuing.

## Acceptance Criteria

- [x] Scripts warn when NETWORK is local but BASE_SEPOLIA_RPC_URL is set
- [x] User must confirm (y/N) to continue with local mode
