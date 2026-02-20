# PR #26 -- 0G Risk Agent Review Patterns

**Category:** review/multi-pattern | **PRs:** 25, 26 | **Reviews:** 5 rounds

## Overview

PR #26 (0G inference + autonomous risk agent) and PR #25 (crash animations + rehab flow) went through 5 review rounds from Copilot and Cursor Bugbot. This doc captures the new categorical patterns that emerged.

## Pattern 1: Lazy Singleton Retry Storms

**Problem:** `getZGBroker()` is a lazy singleton that initializes the 0G broker on first call. When initialization fails (no private key, no ledger, no services, catch block), it returned `null` but left `disabled = false`. Every subsequent request retried initialization -- producing log spam and wasted network calls.

**Root Cause:** Only the "no key" early-return set `disabled = true`. The three other failure paths (no ledger + auto-fund disabled, no services available, catch block) returned `null` without preventing retries.

**Solution:** Set `disabled = true` on ALL failure paths before returning `null`.

**Prevention:** Every lazy-init singleton with failure paths needs an audit: "Does every `return null` also set `disabled = true`?"

## Pattern 2: Eager Combinatorial Materialization

**Problem:** `buildCandidates()` called `combinations(categories, size)` which materialized ALL `C(n,k)` combinations into an array before the caller could apply `maxCandidates` filtering. For `n=20` categories and `k=5`, that's 15,504 combinations. For larger sets, memory and CPU explode.

**Root Cause:** The generic `combinations<T>()` helper was a clean abstraction but had no early-termination capability. The caller received the full array and then sliced.

**Solution:** Replace with inline backtracking that checks `candidates.length >= maxCandidates` at every recursion step. Also `Math.floor()` the env var counts since `Number("4.2")` produces non-integer loop bounds.

**Prevention:** Never materialize full combinatorial sets. If you need "first N from C(n,k)", use backtracking with early termination. This is the same principle as lazy iterators vs eager collection.

## Pattern 3: useEffect Declaration Order on Mount

**Problem:** `MultiplierClimb.tsx` had two effects: a "watch" effect (deps: `[resolvedUpTo, animated, resolvedMultiplier]`) that set `animatedSegments` based on resolved legs, and a "reset" effect (deps: `[animated]`) that zeroed `animatedSegments`. On initial mount, both fire -- the reset effect fires AFTER the watch effect (React runs effects in declaration order), clobbering the watch effect's work.

**Root Cause:** The reset effect was meant for "replay restart" (user re-enters animated mode) but had no guard against running on initial mount.

**Solution:** `prevAnimatedRef` tracks previous `animated` value. Reset only fires on `false -> true` transitions, not on initial mount where `prevAnimatedRef.current` is undefined/true.

**Prevention:** Any "reset on prop change" effect must distinguish initial mount from subsequent changes. Use a `prevRef` pattern to detect the specific transition you care about.

## Pattern 4: SVG Stroke Reveal with Non-Uniform Segments

**Problem:** Progressive stroke reveal used `revealedSegments / totalSegments * pathLength` for `strokeDashoffset`. This assumes uniform segment lengths, but SVG path segments have variable lengths (each leg's multiplier affects Y coordinates differently).

**Root Cause:** The calculation treated the path as having N equal divisions, but the actual SVG geometry has segments of different Euclidean lengths.

**Solution:** Compute cumulative Euclidean distance: `Math.sqrt(dx*dx + dy*dy)` per segment, sum up to the reveal point.

**Prevention:** When animating partial SVG path reveal, always compute actual geometric distances, not index-based fractions.

## Pattern 5: Test Hermeticity for Feature Toggles

**Problem:** `agent-quote.test.ts` tested the endpoint without 0G inference (expected behavior when `ZG_PRIVATE_KEY` is unset). But if a developer has `ZG_PRIVATE_KEY` in their shell, the endpoint includes `aiInsight` in responses, breaking assertions.

**Root Cause:** Tests assumed environment state rather than controlling it.

**Solution:** `beforeAll` saves and deletes the env var; `afterAll` restores it.

**Prevention:** Any test that depends on the ABSENCE of an env var must explicitly delete it in setup and restore in teardown.

## Pattern 6: Unused Dependencies from Removed Features

**Problem:** `crypto-js` and `@types/crypto-js` were declared in `packages/services/package.json` but never imported. They were likely added during development for a feature that was later removed or reimplemented differently.

**Root Cause:** `pnpm install` adds to package.json, but removing the code that used the dependency doesn't remove the dependency declaration.

**Solution:** Grep for imports before shipping. Remove unused packages.

**Prevention:** Before any PR that removes or replaces functionality, grep for the old dependency's import statements. If zero remain, remove from package.json.

## Deferred Items (Scripts -- May Be Removed)

These findings from PR #26 reviews affect scripts that may be removed in future refactors. Noted but not fixed:

- **`.filter(Boolean)` removes blank-line prompt separators** in 0g-inference.ts `buildRiskPrompt`
- **Missing key check caching** causes per-request log spam in 0g-inference.ts
- **Auto-fund ledger side effects** in 0g-inference.ts (real monetary impact)
- **Promise.race timeout cleanup** in agent-quote.ts leaves pending setTimeout
- **Empty apiKey causes OpenAI constructor to always throw** in 0g-inference.ts
- **Empty 0G response handling** when `completion.choices` is empty
- **RISK_TOLERANCE env var not validated** against union type
- **CONFIDENCE_THRESHOLD / LOOP_INTERVAL_MS / AGENT_BANKROLL** not range-validated
- **Duplicate type definitions** in risk-agent.ts (AgentQuoteResponse redefined locally)
- **useReplay cleanup** -- setTimeout not cleared on unmount in ticket page
- **@0glabs/0g-serving-broker** should be pinned exact, not caret range
