---
title: Input validation at system boundaries
category: cross-cutting/validation
severity: medium
prs: [8]
commits: [83abd2e, 8fecb25]
tags: [parseDecimal, scientific-notation, zero-payout, enum-validation]
date: 2026-02-19
---

# Input Validation at System Boundaries

## Problem
Multiple input validation gaps at user/contract boundaries:

1. **Unvalidated PayoutMode enum (PR #8)**: `buyTicketWithMode` accepted any `uint8` as `PayoutMode`. Out-of-range values blocked progressive/cashout claims while allowing classic path.

2. **Zero cashout payout (PR #8)**: `cashoutEarly` allowed `payout = 0` when `cashoutValue` rounds down and `minOut = 0`. Ticket permanently closed with no payment.

3. **Scientific notation in decimal input (83abd2e)**: Frontend `parseDecimal` accepted `1e18`, `+100`, `-50`, whitespace-padded strings. These parse to valid numbers in JS but produce unexpected values when converted to BigInt.

4. **Frontend numeric guards (8fecb25)**: Stake/amount input fields lacked `min`/`max` constraints, allowing negative numbers or values exceeding wallet balance to be submitted.

## Root Cause
Validation was trusted to happen "somewhere else" -- contracts trusted the frontend, frontend trusted the browser, both trusted the input format.

## Solution
- Contract: `require(uint8(payoutMode) <= uint8(PayoutMode.EARLY_CASHOUT))`
- Contract: `require(payout > 0, "zero cashout value")`
- Frontend: `parseDecimal` rejects scientific notation, sign prefixes, and whitespace via regex
- Frontend: Two-layer guards -- sanitize input string first, then validate parsed BigInt against balance/limits

## Prevention (Category-Level)
- **Rule**: Validate at EVERY boundary, not just one. Defense in depth.
- **Rule**: Solidity enum validation is defense-in-depth -- ABI decoder catches external calls, explicit `require` catches internal callers.
- **Rule**: Frontend MUST reject any numeric string that isn't `[0-9.]+` (no scientific notation, no signs, no whitespace).
- **Rule**: Every function that can close/finalize a position MUST verify the payout is > 0.
- **Rule**: `parseDecimal` is the single entry point for all user numeric input. Never use `parseFloat` or `Number()` directly.
