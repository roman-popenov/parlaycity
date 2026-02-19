# 014: Risk Advisor Frontend Bugs (PR #10 Review Findings)

## Problem

The risk advisor integration in ParlayBuilder had multiple interacting bugs that made the feature unreliable:

1. **Stale results from in-flight fetches**: User changes input while fetch is in-flight; old results overwrite new state.
2. **Zero BigInt falsy check**: `usdcBalance ? ...` evaluates false for `0n`, sending a phantom `"100"` bankroll.
3. **BigInt-to-string type mismatch**: `legIds` sent as strings via `.toString()` but API schema expects `z.number()`.
4. **Silent fetch failures**: Empty `catch {}` block -- user sees "Analyzing..." briefly, then nothing.
5. **Unvalidated API response**: `riskAdvice.action`, `.kellyFraction`, `.warnings` accessed without null guards.
6. **Hooks missing hash state**: `useClaimProgressive` and `useCashoutEarly` didn't return `hash`, breaking consistency.
7. **Env vars undocumented**: `NEXT_PUBLIC_X402_PAYMENT` and `NEXT_PUBLIC_SERVICES_URL` missing from `.env.example`.

## Root Cause

Each bug has a different root:

1. No fetchId invalidation pattern on the risk advisor (unlike the polling hooks which already had it).
2. Misused truthiness check: `usdcBalance ? ...` treats both `0` and `0n` as falsy, so it can't distinguish `undefined` (no balance yet) from a valid zero balance.
3. `BigInt.prototype.toString()` returns a string, but `JSON.stringify` doesn't know BigInt natively. The fix for the JSON.stringify crash (#4) used `.toString()` but should have used `Number()`.
4. Developer-mode "it'll fail in dev anyway" thinking. In production, fetch failures are common (network, CORS, 500s).
5. Trusting API contract stability. Response shapes can change; defensive validation is cheap insurance.
6. Copy-paste of hook boilerplate without carrying over all state variables.
7. Env vars added in code but not in the project template.

## Solution

- **FetchId pattern**: `const localFetchId = ++riskFetchIdRef.current` before fetch, check `localFetchId !== riskFetchIdRef.current` before applying results. Input-change `useEffect` increments the ref AND resets `riskLoading` to prevent stuck spinners.
- **BigInt existence check**: `usdcBalance !== undefined` instead of `usdcBalance ?`.
- **Number conversion**: `Number(s.leg.id)` for small IDs sent to JSON APIs.
- **Error UI**: `riskError` state with red banner shown to user. Non-OK responses show status code.
- **Response validation**: Check `typeof data.action === "string" && typeof data.kellyFraction === "number"` before setting state. Null-safe access with `??` on display fields.
- **Hash state**: Added `useState<\`0x${string}\` | undefined>` + `setHash(txHash)` to both hooks.
- **Env docs**: Added both vars to `.env.example` with defaults and descriptions.

## Prevention

- **Category: Async state management** -- Any user-triggered fetch that can be invalidated MUST use the fetchId pattern. This is now lesson #16.
- **Category: BigInt boundaries** -- Every BigInt truthiness check should use `!== undefined`. Every BigInt-to-JSON conversion should be `Number()` for small values. This is now lessons #17 and #18.
- **Category: User feedback** -- Never swallow errors on user-facing features. Show at minimum "unavailable." This is now lesson #19.
- **Category: Hook consistency** -- When adding new contract-write hooks, copy the full interface (including `hash`) from the canonical pattern (`useSettleTicket`).
