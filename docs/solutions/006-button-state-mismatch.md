---
title: Button disabled/styling state disagreements
category: frontend/ux
severity: low
prs: [7]
tags: [button-state, disabled, ternary-priority, transaction-status]
date: 2026-02-18
---

# Button Disabled/Styling State Disagreements

## Problem
Three related frontend state priority bugs:

1. **Styling ignores disabled**: Buy button `disabled` prop included `vaultEmpty`, but `className` gradient logic only checked `canBuy && !isPending && !isConfirming`. Button looked active while actually disabled.

2. **Transaction status hidden**: `buyButtonLabel` checked `vaultEmpty` before `isPending`/`isConfirming`/`isSuccess`. When vault emptied mid-purchase (10s refetch), label switched from "Ticket Bought!" to "No Vault Liquidity", hiding the success feedback.

3. **Ternary nesting**: Deeply nested ternary chain with inconsistent indentation after inserting new level. Not a bug but increases risk of future edit errors.

## Root Cause
Priority ordering in conditional rendering. Transaction status feedback is ephemeral and time-sensitive -- it must take priority over all other conditions.

## Solution
Refactored `buyButtonLabel` into a helper function with explicit priority:
1. Transaction states first (isPending, isConfirming, isSuccess)
2. Error states second
3. Availability states last (vaultEmpty, insufficientBalance, etc.)

Styling conditions must mirror disabled conditions exactly.

## Prevention (Category-Level)
- **Rule**: Transaction status (pending/confirming/success/error) ALWAYS takes priority over UI state conditions.
- **Rule**: If a button has both `disabled` prop and `className` conditional, the conditions MUST match. Extract to a shared variable.
- **Rule**: When a ternary chain exceeds 3 levels, extract to a named function for readability.
- Added button rules to `apps/web/CLAUDE.md`.
