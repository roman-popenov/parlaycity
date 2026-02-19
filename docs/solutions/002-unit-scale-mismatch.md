---
title: Unit and scale mismatches across contract boundaries
category: contracts/math
severity: high
prs: [2, 8]
tags: [shares-vs-assets, bps-vs-ppm, math-parity, decimals]
date: 2026-02-18
---

# Unit and Scale Mismatches Across Contract Boundaries

## Problem
Multiple instances of confusing units at system boundaries:

1. **Shares vs Assets (PR #2)**: Vault withdrawal warning subtracted `withdrawAmountBigInt` (shares/vUSDC) from `totalAssets` (USDC). When share price != 1, the utilization warning was materially wrong.

2. **TS math parity divergence (PR #8)**: TypeScript `computeCashoutValue` added `alreadyClaimed` parameter not present in Solidity. Same function name, different semantics -- violates invariant #3.

3. **TS empty-array behavior (PR #8)**: TS returned `{ cashoutValue: 0n }` on empty inputs while Solidity reverted. Silent zero vs loud revert = different failure mode.

4. **Cashout double-discount (PR #8, HIGH)**: `computeCashoutValue` applied unresolved leg probabilities twice -- once in the multiplier calculation, once in the discount loop. Underpriced cashouts by ~20x.

## Root Cause
When the same concept exists in two places (Solidity + TypeScript, shares + assets, BPS + PPM), humans and AI agents assume they're interchangeable without verifying the conversion.

## Solution
- PR #2: Convert shares to assets before comparing: `withdrawAmountAssets = (shares * shareValue) / totalShares`
- PR #8: Removed `alreadyClaimed` from TS to match Solidity signature exactly
- PR #8: TS now throws on empty arrays matching Solidity reverts
- PR #8: Rewrote cashout formula to avoid double-application of probability discounts

## Prevention (Category-Level)
- **Rule**: When the same function exists in Solidity and TypeScript, signatures MUST be identical. If Solidity reverts, TS MUST throw.
- **Rule**: Never subtract shares from assets or vice versa. Always convert first.
- **Rule**: BPS (1e4) and PPM (1e6) must never appear in the same arithmetic expression without explicit conversion.
- **Rule**: After any math change, run `make test-all` to catch parity violations.
- **Rule**: When a value crosses a contract/module boundary, document its unit in the variable name or comment.
