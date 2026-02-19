---
title: Tests passing trivially — zero coverage and vacuous assertions
category: testing
severity: high
prs: [8, 9]
commits: [b5bc00f]
tags: [invariant-test, false-positive, test-setup, fuzz, vacuous-assertion, conditional-assertion]
date: 2026-02-19
---

# Tests Passing Trivially — Zero Coverage and Vacuous Assertions

## Problem

Two patterns of tests that pass without actually testing anything:

### Pattern 1: Invariant test with broken setup (PR #8)
`EngineInvariantTest` didn't configure `lockVault` or `safetyModule` on the vault. Since `HouseVault.routeFees` requires both to be non-zero, every ticket purchase reverted internally. The handler's `try/catch` silently swallowed these reverts.

Result: invariant tests ran 64 runs x 32 depth, all passed, zero tickets were ever created. The test provided false assurance about vault solvency.

### Pattern 2: Conditional assertions that never execute (PR #9)
Unit tests wrapped assertions in `if (res.body.action === RiskAction.BUY)` where the BUY branch is unreachable — Kelly criterion is always 0 when house edge exceeds fair odds. The test passed because no assertions ran.

```typescript
// WRONG: Vacuous — BUY is never reached, assertions never execute
it("BUY action only when kelly > 0", async () => {
  const res = await post(validBody);
  if (res.body.action === RiskAction.BUY) {
    expect(res.body.kellyFraction).toBeGreaterThan(0); // never runs
  }
});

// RIGHT: Assert the actual behavior unconditionally
it("returns REDUCE_STAKE when kelly is 0", async () => {
  const res = await post(validBody);
  expect(res.body.kellyFraction).toBe(0);
  expect(res.body.action).toBe(RiskAction.REDUCE_STAKE);
});
```

## Root Cause
**Pattern 1**: Invariant test setup was copy-pasted from unit test setup which didn't need fee routing. The handler's `try/catch` (standard Foundry invariant pattern) masked the setup failure.

**Pattern 2**: Tests were written to handle both BUY and REDUCE_STAKE outcomes, but with fixed mock data only one path is exercisable. The `if` guard made the test pass vacuously when the unreachable branch was the one being "tested."

## Solution
**Pattern 1**: Added LockVault + safetyModule wiring to invariant test `setUp()`. Added assertion in handler that at least some tickets were created during the run.

**Pattern 2**: Removed conditional wrappers. Made assertions unconditional against the known output. Renamed test to reflect actual behavior ("returns REDUCE_STAKE when kelly is 0").

## Prevention (Category-Level)
- **Rule**: Invariant tests MUST assert that the handler actually executed meaningful actions. Check `ghost_ticketsCreated > 0` or similar counter.
- **Rule**: When adding a new contract dependency (like fee routing), grep for ALL test setups that might need updating.
- **Rule**: Handler `try/catch` blocks should log or count failures. If failure rate is 100%, the test is broken.
- **Rule**: Run `forge test -vvv` on invariant tests periodically to verify the handler is actually doing work (look for non-zero call counts).
- **Rule**: NEVER wrap assertions inside `if (condition)` in unit tests. If you want to test a specific branch, set up inputs that deterministically reach it. If the branch is unreachable with current inputs, test what actually happens instead.
- **Rule**: Every `it()` block must contain at least one unconditional `expect()`. A test with zero executed assertions is worse than no test — it provides false confidence.
