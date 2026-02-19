---
title: Invariant tests passing trivially with zero coverage
category: testing
severity: high
prs: [8]
tags: [invariant-test, false-positive, test-setup, fuzz]
date: 2026-02-19
---

# Invariant Tests Passing Trivially With Zero Coverage

## Problem
`EngineInvariantTest` didn't configure `lockVault` or `safetyModule` on the vault. Since `HouseVault.routeFees` requires both to be non-zero, every ticket purchase reverted internally. The handler's `try/catch` silently swallowed these reverts.

Result: invariant tests ran 64 runs x 32 depth, all passed, zero tickets were ever created. The test provided false assurance about vault solvency.

## Root Cause
Invariant test setup was copy-pasted from unit test setup which didn't need fee routing. The handler's `try/catch` (standard Foundry invariant pattern) masked the setup failure.

## Solution
Added LockVault + safetyModule wiring to invariant test `setUp()`. Added assertion in handler that at least some tickets were created during the run.

## Prevention (Category-Level)
- **Rule**: Invariant tests MUST assert that the handler actually executed meaningful actions. Check `ghost_ticketsCreated > 0` or similar counter.
- **Rule**: When adding a new contract dependency (like fee routing), grep for ALL test setups that might need updating.
- **Rule**: Handler `try/catch` blocks should log or count failures. If failure rate is 100%, the test is broken.
- **Rule**: Run `forge test -vvv` on invariant tests periodically to verify the handler is actually doing work (look for non-zero call counts).
