---
title: Input validation at system boundaries
category: cross-cutting/validation
severity: medium
prs: [8, 9]
commits: [83abd2e, 8fecb25, b5bc00f]
tags: [parseDecimal, scientific-notation, zero-payout, enum-validation, NaN, parseFloat]
date: 2026-02-19
---

# Input Validation at System Boundaries

## Problem
Multiple input validation gaps at user/contract boundaries:

1. **Unvalidated PayoutMode enum (PR #8)**: `buyTicketWithMode` accepted any `uint8` as `PayoutMode`. Out-of-range values blocked progressive/cashout claims while allowing classic path.

2. **Zero cashout payout (PR #8)**: `cashoutEarly` allowed `payout = 0` when `cashoutValue` rounds down and `minOut = 0`. Ticket permanently closed with no payment.

3. **Scientific notation in decimal input (83abd2e)**: Frontend `parseDecimal` accepted `1e18`, `+100`, `-50`, whitespace-padded strings. These parse to valid numbers in JS but produce unexpected values when converted to BigInt.

4. **Frontend numeric guards (8fecb25)**: Stake/amount input fields lacked `min`/`max` constraints, allowing negative numbers or values exceeding wallet balance to be submitted.

5. **Regex `\s` overmatch (5dce8bb, PR #9)**: Categories schema used `\s` in a character class, which matches tabs, newlines, and carriage returns — not just spaces. The validation message documented "space" but the regex accepted far more. A category like `"NBA\tWest"` or `"NBA\nWest"` would pass validation.

6. **`parseFloat(".")` NaN bypass (b5bc00f, PR #9)**: Typing a single `"."` into deposit/withdraw/lock inputs passed the `!amount` guard (since `"."` is truthy) but `parseFloat(".")` returns `NaN`. `NaN` is falsy for `!amount` checks but truthy for `!!amount`, so buttons stayed enabled even though the parsed value is meaningless. Clicking the button would send `NaN` downstream.

## Root Cause
Validation was trusted to happen "somewhere else" -- contracts trusted the frontend, frontend trusted the browser, both trusted the input format. The NaN case is subtle: `"."` is a valid intermediate state while typing a decimal number, but it's not a valid final value. The `!amount` truthiness check doesn't distinguish between "has a string" and "has a parseable number."

## Solution
- Contract: `require(uint8(payoutMode) <= uint8(PayoutMode.EARLY_CASHOUT))`
- Contract: `require(payout > 0, "zero cashout value")`
- Frontend: `parseDecimal` rejects scientific notation, sign prefixes, and whitespace via regex
- Frontend: Two-layer guards -- sanitize input string first, then validate parsed BigInt against balance/limits
- Frontend: Explicit NaN guards on all numeric input fields: `const depositNotANumber = depositAmount !== "" && isNaN(depositParsed)` — added to each button's `disabled` prop

## Prevention (Category-Level)
- **Rule**: Validate at EVERY boundary, not just one. Defense in depth.
- **Rule**: Solidity enum validation is defense-in-depth -- ABI decoder catches external calls, explicit `require` catches internal callers.
- **Rule**: Frontend MUST reject any numeric string that isn't `[0-9.]+` (no scientific notation, no signs, no whitespace).
- **Rule**: Every function that can close/finalize a position MUST verify the payout is > 0.
- **Rule**: `parseDecimal` is the single entry point for all user numeric input. Never use `parseFloat` or `Number()` directly.
- **Rule**: In regex character classes, never use `\s` when you mean literal space. `\s` matches `[\t\n\r\f\v ]` — always use ` ` (literal space) unless you explicitly want all whitespace.
- **Rule**: Every numeric input field must guard against NaN. A string like `"."` is truthy but `parseFloat(".")` is NaN. Always add `isNaN(parsedValue)` to button disabled conditions alongside the `!amount` check.
