---
status: pending
priority: p2
issue_id: "031"
tags: [code-review, type-safety, pr18]
dependencies: []
---

# Non-null assertion on walletClient.account!

## Problem Statement

Both scripts use `walletClient.account!` in writeContract calls. The account is available in scope from `privateKeyToAccount` and should be passed directly.

## Proposed Solutions

Pass `account` directly (already in scope from privateKeyToAccount) instead of `walletClient.account!`.

## Acceptance Criteria

- [ ] No non-null assertions on walletClient.account
- [ ] account passed directly from privateKeyToAccount result

## Resources

- PR #18: https://github.com/roman-popenov/parlaycity/pull/18
