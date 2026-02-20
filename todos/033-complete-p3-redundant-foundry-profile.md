---
status: complete
priority: p3
issue_id: "033"
tags: [code-review, cleanup, pr19]
dependencies: []
---

# Redundant [profile.sepolia] in foundry.toml

## Problem Statement

The [profile.sepolia] section duplicated all 8 default settings. Foundry profiles inherit from default.

## Solution

Deleted the entire [profile.sepolia] section. The [rpc_endpoints] section already contains the base-sepolia RPC URL for deployment.

## Acceptance Criteria

- [x] [profile.sepolia] section removed
