# PR #28 -- Multi-Category Markets & BDL Integration Review Patterns

**Category:** review/multi-pattern | **PR:** 28 | **Reviews:** 3 rounds (Cursor Bugbot x2, Copilot x1)

## Overview

PR #28 adds multi-category market support (7 seed categories + BDL NBA integration), including a unified market catalog, category-filtered UI, session persistence, on-chain leg registration, and E2E tests. Three automated review rounds surfaced 11 findings across 7 distinct patterns.

## Pattern 1: ID Namespace Collisions Across Data Sources

**Problem:** `ON_CHAIN_LEG_IDS` was `{0n, 1n, 2n}` (from Deploy.s.sol), but the seed catalog uses 1-based IDs `{1, 2, 3}`. After API fetch replaced mock legs, catalog leg 3 was incorrectly marked off-chain while non-existent ID 0 was included. Additionally, `legMapping` applied to all legs without distinguishing mock from catalog -- IDs 1 and 2 collided.

**Root Cause:** Two independent ID namespaces (contract deploy order vs. catalog sequential IDs) overlapped numerically. No namespace prefix or source tag distinguished them.

**Solution:** (1) Removed baked-in `ON_CHAIN_LEG_IDS`. API legs start as `onChain: false` and get promoted reactively via `leg-mapping.json`. (2) Added early return for `s.leg.onChain` before `legMapping` lookup so mock legs bypass catalog mapping.

**Prevention:** When multiple data sources produce IDs, either use non-overlapping ranges (e.g., NBA legs start at 1000) or tag IDs with their source. Never assume numeric IDs from different systems won't collide.

## Pattern 2: Stale Object References After Async State Replacement

**Problem:** User selects mock legs (with `onChain: true`), then API fetch replaces `allLegs` with catalog data. `selectedLegs` still holds references to the old mock leg objects. In `handleBuy`, the stale `onChain: true` flag causes wrong code path execution -- user sees one question but buys a bet on a different one.

**Root Cause:** React state updates are independent. Replacing `allLegs` doesn't automatically update `selectedLegs` which holds captured references to the previous `allLegs` entries. The `restoreSelections` logic only fired for stored (sessionStorage) picks, not for live interactive selections.

**Solution:** Added reconciliation `useEffect` that triggers on `allLegs` changes. Builds a `Map<id, leg>` from current `allLegs`, iterates `selectedLegs`, and replaces any stale references with fresh objects. Legs no longer present are dropped.

**Prevention:** When a component has derived/selected state that references objects from a primary collection, always add a reconciliation effect that fires when the primary collection changes. Pattern: `useEffect(() => { reconcile(selected, primary) }, [primary])`.

## Pattern 3: Persisted UI State Referencing Unavailable Options

**Problem:** `activeCategory` persisted in sessionStorage. If the stored category (e.g., "nba") becomes unavailable on next load (API fails, BDL disabled), `filteredLegs` returns empty while `allLegs` has data. UI renders blank with no recovery path.

**Root Cause:** Session persistence assumed the stored value would always be valid. No validation against current available options after restore.

**Solution:** Added `useEffect` that resets `activeCategory` to `"all"` when it produces empty `filteredLegs` while `allLegs` is non-empty.

**Prevention:** Every persisted enum/category value needs a fallback guard: if the restored value doesn't match any current option, reset to a safe default. This is the select-box equivalent of "dangling pointer" -- the reference outlives the referent.

## Pattern 4: Cross-Environment Configuration Trust

**Problem:** `leg-mapping.json` includes `chainId` but the client ignored it. A stale mapping from a different chain/environment (e.g., Anvil mapping applied to Sepolia) would silently translate catalog IDs to wrong on-chain leg IDs, causing incorrect ticket purchases.

**Root Cause:** Generated config files were trusted without validation. No chain-awareness at the consumption boundary.

**Solution:** Validate `data.chainId` against `NEXT_PUBLIC_CHAIN_ID` (default 31337) when loading the mapping. Mismatches log a warning and skip the mapping entirely.

**Prevention:** Every static config file consumed at runtime needs environment validation. If the file includes environment metadata (chain ID, network, deploy timestamp), verify it matches the current runtime context before applying.

## Pattern 5: Race-Unsafe Sequential ID Derivation

**Problem:** `register-legs.ts` derived new on-chain leg IDs as `legCount + created` (a counter variable). Under concurrent registration (parallel script runs, shared testnet), another transaction could create legs between the initial `legCount` read and the derivation, producing incorrect mappings.

**Root Cause:** Optimistic ID calculation assumed single-writer access to the on-chain registry. The counter was local but the state was shared.

**Solution:** Re-read `legCount` after each transaction receipt confirms, derive ID as `legCountAfter - 1`.

**Prevention:** Never derive on-chain IDs from local counters. Either parse the event from the transaction receipt (`LegCreated(uint256 legId, ...)`) or re-read the authoritative state after the transaction confirms.

## Pattern 6: Snapshot Tests Capturing Error Shapes

**Problem:** `POST /premium/risk-assess` snapshot test omitted required `legIds` and `outcomes` fields. Zod validation rejected the request, and the snapshot silently captured the error response shape instead of the success shape. Test passed but couldn't detect regressions in the actual success payload.

**Root Cause:** Snapshot tests auto-pass on first run by writing whatever shape they receive. If the shape is an error, the baseline becomes the error shape. No assertion on HTTP status before snapshotting.

**Solution:** Added missing required fields. Also: snapshot tests should assert `expect(res.status).toBe(200)` before calling `toMatchSnapshot()`.

**Prevention:** Every snapshot test must assert the expected HTTP status (or equivalent success indicator) before capturing the shape. A snapshot of an error response is always a bug unless explicitly labeled as such (e.g., "snapshot of 400 validation error").

## Pattern 7: Completed-Event Data Leaking Into Active Pipelines

**Problem:** BDL fallback query returned recently completed ("Final") NBA games. `register-legs.ts` then replaced their past cutoff times with `sevenDaysFromNow`, making already-decided games appear as active, bettable legs on-chain. Users who know outcomes could exploit this.

**Root Cause:** The fallback path (`upcoming.length === 0`) was intended for demo purposes but didn't filter by game status. The "Final" filter only existed on the primary query path.

**Solution:** Added `.filter((g) => g.status !== "Final")` to the fallback query. Only in-progress (non-final) games pass through.

**Prevention:** Data pipeline filters must be applied consistently across all paths (primary + fallback + cache). If a filter is safety-critical (preventing betting on known outcomes), it should be a single shared function, not duplicated inline.

---

## Summary Table

| # | Pattern | Severity | Fix Commit |
|---|---------|----------|------------|
| 1 | ID namespace collision across data sources | High | `2609bef`, `541e10c` |
| 2 | Stale object references after async state swap | Medium | `4f0289c` |
| 3 | Persisted UI state referencing unavailable options | Medium | `4f0289c` |
| 4 | Cross-environment config trust (chainId ignored) | Medium | `4f0289c` |
| 5 | Race-unsafe sequential ID derivation | Medium | `4f0289c` |
| 6 | Snapshot tests capturing error shapes | Medium | `4f0289c` |
| 7 | Completed-event data in active pipelines | Medium | `4f0289c` |

## Also Fixed (Low Severity)

- **Dead export `getSeedMarkets()`** -- removed in `541e10c`. Zero callers. (See lesson #20: grep for callees before shipping.)
- **`sync-env.sh` env var name mismatch** -- added `ADMIN_ORACLE_ADDRESS` alias alongside `NEXT_PUBLIC_` variant in `4f0289c`. Non-Next.js scripts need both.
