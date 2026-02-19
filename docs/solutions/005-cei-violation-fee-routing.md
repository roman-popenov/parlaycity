---
title: CEI violation in fee routing
category: contracts/security
severity: medium
prs: [4]
tags: [reentrancy, checks-effects-interactions, fee-routing]
date: 2026-02-18
---

# CEI Violation in Fee Routing

## Problem
In `HouseVault.routeFees()`, state updates (`routedToLockers = feeToLockers`, `routedToSafety = feeToSafety`) happened AFTER external calls (`asset.safeTransfer`, `lockVault.notifyFees`). This violates checks-effects-interactions pattern.

Additionally, when `totalWeightedShares == 0` (no lockers), `notifyFees` returned early but fees were already transferred to LockVault -- permanently trapped with no recovery mechanism.

## Root Cause
External call ordering was written for readability (transfer then record) rather than safety (record then transfer).

## Solution
1. Move state updates before external calls
2. Guard `routeFees` to keep fees in vault when no lockers exist (skip transfer entirely)

## Prevention (Category-Level)
- **Rule**: Always write state changes BEFORE external calls. No exceptions.
- **Rule**: Before transferring tokens to a contract, verify the recipient can process them. If `totalWeightedShares == 0`, don't send fees to LockVault.
- **Rule**: Ask "what happens if the recipient contract rejects or ignores this transfer?" for every `safeTransfer` call.
- Added to security checklist in `packages/contracts/CLAUDE.md`.
