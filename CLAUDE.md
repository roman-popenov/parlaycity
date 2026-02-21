# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Identity & Pitch

ParlayCity -- the first Crash-Parlay AMM. On-chain parlay betting on Base (multi-chain possible). Built at ETHDenver 2026.

**Core loop:** Buy ticket (2-5 legs) -> watch multiplier climb as legs resolve -> cash out before a leg crashes OR ride to full payout.

This is NOT "parlays on Base." The differentiator is the Aviator-style game mechanic: tickets are live instruments with real-time cashout. The "plane" metaphor: multiplier climbs as each leg resolves favorably, crashes when a leg loses. Users choose their own exit point.

**One-sentence pitch:** "Crash-Parlay AMM with non-extractive fee routing, live cashout, and unified vault liquidity."

**Token stack:** Users stake USDC. LPs deposit USDC into HouseVault, receive vUSDC shares. vUSDC can be locked in LockVault for boosted fee share. Tickets are ERC721 NFTs.

## Invariants (NEVER violate)

1. **Engine never holds USDC.** All stake flows directly to HouseVault via `safeTransferFrom`. ParlayEngine has zero token balance.
2. **totalReserved <= totalAssets().** The vault MUST always be able to cover all reserved payouts. Enforced on-chain, tested in `VaultInvariant.t.sol`.
3. **Shared math parity.** `ParlayMath.sol` and `packages/shared/src/math.ts` MUST produce identical results. Same integer arithmetic, same PPM scale (1e6). Change one, change both, run `make test-all`.
4. **Permissionless settlement.** Anyone can call `settleTicket()`. No keeper dependency, no access control on settlement.
5. **No discretionary owner drains.** Owner manages protocol parameters but has no path to redirect user deposits, LP capital, or protocol-accumulated funds to arbitrary addresses. Penalty redistribution must be deterministic. No `selfdestruct`, no proxy upgrades in MVP.
6. **Fee arithmetic uses BPS (10_000).** Probability uses PPM (1_000_000). Never mix scales.
7. **SafeERC20 on ALL token operations.** No raw `.transfer()` or `.transferFrom()`.
8. **`make gate` must pass before any commit.** Gate = test-all + typecheck + build-web.

## Monorepo Layout

pnpm 8 workspaces. Node >= 18.

```
apps/web/              Next.js 14 (App Router), React 18, TypeScript, Tailwind 3
packages/contracts/    Foundry, Solidity 0.8.24, OpenZeppelin 5.x
packages/services/     Express.js API, Zod validation
packages/shared/       Shared math, types, schemas (consumed by services + web)
packages/e2e/          E2E integration tests (Anvil-backed, vitest)
```

## Commands

All primary dev commands go through the Makefile at repo root:

```bash
make bootstrap         # Install all dev tools (foundry, pnpm, node)
make setup             # pnpm install + forge install dependencies

make dev               # Full stack: anvil + deploy + services (3001) + web (3000)
make dev-stop          # Tear down all dev services
make dev-status        # Check which dev services are running
make chain             # Anvil only (8545)
make deploy-local      # Deploy contracts to local Anvil, auto-sync .env.local

make test-contracts    # forge test -vvv
make test-services     # vitest run (packages/services)
make test-all          # Both

make test-e2e          # E2E integration tests (requires running Anvil + deploy)
make gate              # test-all + typecheck + build-web (CI quality gate)
make typecheck         # tsc --noEmit (apps/web)
make build-web         # next build
make build-contracts   # forge build only
make coverage          # forge coverage --report summary
make snapshot          # forge snapshot (gas benchmarks)
make clean             # forge clean + .next

make register-legs     # Register seed legs on-chain from catalog (requires Anvil + deploy)
make sync-env          # re-run sync-env.sh without redeploying
make fund-wallet WALLET=0x...  # Mint 10,000 MockUSDC to any wallet on Base Sepolia
make fund-wallet WALLET=0x... AMOUNT=5000  # Custom amount (max 10,000 per call)
make fund-deployer     # Print deployer address + ETH/USDC faucet links
make ci                # run full CI locally via act
make ci-contracts      # run contracts CI job via act
make ci-services       # run services CI job via act
make ci-web            # run web CI job via act

# -- Sepolia Deployment --
make deploy-sepolia          # Deploy contracts to Base Sepolia (needs .env)
make deploy-sepolia-full     # Full pipeline: deploy + sync-env + register-legs + demo-seed
make register-legs-sepolia   # Register catalog legs on Base Sepolia
make demo-seed-sepolia       # Seed demo data on Base Sepolia (small amounts)
make create-pool-sepolia     # Create Uniswap V3 USDC/WETH pool on Base Sepolia
make fund-deployer           # Print deployer address + funding instructions

# -- Agents --
make risk-agent              # 0G-powered autonomous betting agent
make risk-agent-dry          # Risk agent in dry-run mode (no tx)
make market-agent            # Market discovery agent (local, requires BDL_API_KEY)
make market-agent-sepolia    # Market discovery agent on Base Sepolia
make risk-agent-sepolia      # Risk agent on Base Sepolia
make settler-sepolia         # Settler bot on Base Sepolia
make agents-sepolia          # Both agents on Base Sepolia (background)
make agents-stop             # Stop agent processes
```

Dev logs written to `.pids/*.log` (anvil.log, deploy.log, services.log, web.log).

Single contract test: `cd packages/contracts && forge test -vvv --match-test <TestName>`

Per-package: `pnpm --filter web dev`, `pnpm --filter web test`, `pnpm --filter services test`, `pnpm -r lint`

## Architecture (Current State)

**Contracts:** ERC4626-like HouseVault (USDC, vUSDC shares, 80% utilization cap, 5% max payout, 90/5/5 fee routing via `routeFees`). ParlayEngine (ERC721 tickets, baseFee=100bps + perLegFee=50bps). LegRegistry (admin-managed outcomes). LockVault (30/60/90 day locks, Synthetix-style rewards, fee income via `notifyFees` from HouseVault). ParlayMath (pure library mirrored in TS). Oracles: AdminOracleAdapter (bootstrap) + OptimisticOracleAdapter (production). Deploy order in `script/Deploy.s.sol`.

**Frontend:** Next.js 14 pages: `/` (builder), `/vault`, `/tickets`, `/ticket/[id]`, `/about`. wagmi 2 + viem 2 + ConnectKit. Polling 5s/10s with stale-fetch guards. FTUE spotlight, demo banner, how-it-works onboarding components.

**Services:** Express port 3001. Routes: `/markets` (category filter via `?category=`), `/markets/categories`, `/quote` (resolves legs from full catalog including NBA), `/exposure`, `/premium/sim` (x402-gated), `/premium/risk-assess` (x402-gated), `/premium/agent-quote` (x402-gated, combined quote + risk for autonomous agents), `/vault/health`, `/vault/yield-report`, `/health`. Catalog subsystem: `registry.ts` (unified leg map merging seed + BDL), `seed.ts` (7 hardcoded categories), `bdl.ts` (live NBA markets via BallDontLie API, 5-min cache, `BDL_API_KEY` env var, also exports `fetchCompletedGames`/`BDLGameResult` for resolution). x402 uses real verification in production, stub in dev/test.

**Agents:** `scripts/market-agent.ts` (autonomous NBA market discovery + on-chain registration + game result resolution via BDL API), `scripts/settler-bot.ts` (permissionless ticket settlement loop), `scripts/risk-agent.ts` (autonomous betting with 0G inference + Kelly sizing). Run via `make agents-sepolia` / `make agents-stop`.

**Shared:** `math.ts` mirrors `ParlayMath.sol` exactly. PPM=1e6, BPS=1e4.

See subdirectory `CLAUDE.md` files for detailed per-package rules and context.

## Deep Specs (read before major changes)

- `docs/ECONOMICS.md` -- fee routing 90/5/5, loss distribution 80/10/10, SafetyModule, penalties
- `docs/RISK_MODEL.md` -- utilization pricing, exposure caps, RiskConfig
- `docs/CASHOUT.md` -- crash-parlay cashout pricing and flow
- `docs/BOUNTY_MAP.md` -- ETHDenver bounty targets + status
- `docs/COMPETITORS.md` -- competitive positioning
- `docs/THREAT_MODEL.md` -- threat model + mitigations
- `docs/ARCHITECTURE.md` -- system diagrams + contract architecture
- `docs/FUTURE_IMPROVEMENTS.md` -- post-hackathon enhancements
- `docs/UNISWAP_LP_STRATEGY.md` -- UniswapYieldAdapter design, stable-stable LP, pair selection
- `docs/REHAB_MODE.md` -- loser-to-LP conversion, 120-day force-lock, re-lock tiers
- `docs/DEPLOYMENT.md` -- Base Sepolia deployment guide, prerequisites, post-deploy checklist
- `docs/RUNBOOK.md` -- operational runbook (local dev, testnet deploy, incident response)
- `docs/DEMO.md` -- demo script and hackathon judge talking points

## Gap Analysis

### EXISTS (working, tested, deployed)
- HouseVault: deposit, withdraw, reserve/release/pay, yield adapter, 90/5/5 fee routing via `routeFees`
- ParlayEngine: buyTicket, buyTicketWithMode, settleTicket, claimPayout, claimProgressive, cashoutEarly (with slippage protection), partial void, ERC721, PayoutMode enum (Classic/Progressive/EarlyCashout)
- LegRegistry: CRUD, validation, oracle adapter references
- LockVault: lock/unlock/earlyWithdraw, Synthetix-style fee distribution via `notifyFees`, penalty
- ParlayMath: multiplier, edge, payout, progressive payout, cashout value -- supports Classic, Progressive, and EarlyCashout modes (Solidity + TypeScript mirror)
- AdminOracleAdapter + OptimisticOracleAdapter
- MockYieldAdapter + AaveYieldAdapter (not in default deploy)
- Frontend: parlay builder (multi-category tabs, API-driven legs, on-chain/off-chain indicators), vault dashboard, tickets list, ticket detail, about page, MultiplierClimb viz (animated rocket + crash), RehabCTA, RehabLocks (mock), FTUESpotlight, DemoBanner, DemoHint, HowItWorks onboarding components
- Services: multi-category market catalog (7 seeded categories + BDL NBA), category filtering, unified market registry, quote, exposure (mock), x402-gated premium/sim + risk-assess + agent-quote (with optional 0G AI insight), vault/health, vault/yield-report
- Scripts: market-agent (autonomous NBA market discovery + on-chain registration + game result resolution via BDL API), settler-bot (permissionless ticket settlement), risk-agent (autonomous agent loop with 0G inference, Kelly sizing, multi-candidate selection), demo-autopilot (leg resolution + crash simulation), demo-seed, register-legs (on-chain leg registration from catalog with race-safe ID derivation)
- Tests: unit, fuzz, invariant, integration (contracts), vitest (services + web), E2E integration (Anvil-backed, 20 tests across 5 suites: deploy, registration, API consistency, lifecycle, vault flow)
- CI: GitHub Actions (3 jobs), Makefile quality gate, coverage thresholds enforced
- Deploy script + sync-env
- Base Sepolia deployment pipeline (deploy-sepolia-full, conditional USDC, Basescan verification, Uniswap V3 pool creation)

### NEEDS BUILDING
- SafetyModule contract (insurance buffer, yield deployment)
- Loss distribution routing (80/10/10 split on losing stakes to LP/AMM/rehab)
- Automatic penalty distribution (replace sweepPenaltyShares manual sweep)
- ERC-4337 paymaster integration (gasless buyTicket/cashout/lock via Base Paymaster)
- Per-market exposure tracking and caps
- Utilization-based dynamic pricing (riskPremiumBps)
- Good cause donation routing (Gitcoin-style)

### DISCONNECTED (exists but not wired)
- `LockVault.sweepPenaltyShares`: penalty shares accumulate silently until owner sweeps
- `IHedgeAdapter` interface exists, services mock exists, but no deployed contract
- `AaveYieldAdapter` exists in src but default deploy only uses MockYieldAdapter

## PR Strategy

- This repo is a fork of `roman-popenov/parlaycity`. Push branches to `origin` (stragitech), open PRs against the upstream with `gh pr create --repo roman-popenov/parlaycity`.
- Small PRs against `main`. Main stays green.
- Merged: PR #24 (cashout math parity), PR #25 (crash UX + rehab flow + demo scripts), PR #26 (0G risk agent + AI insight), PR #27 (README), PR #28 (multi-category markets + BDL NBA integration + E2E tests + register-legs script), PR #29 (UI overhaul + FTUE spotlight + demo banner + about page + market-agent + settler-bot + chain-pinning fix). Remaining: Uniswap LP, SafetyModule, loss distribution, paymaster, dynamic pricing.
- Every PR must pass `make gate` before merge.
- Contract PRs must include tests AND a security note.

## Environment

`apps/web/.env.local` is auto-generated by `make deploy-local` or `make deploy-sepolia` (via `scripts/sync-env.sh`). Contains contract addresses and chain ID. WalletConnect project ID must be set manually.

Root `.env` holds secrets and chain config (loaded by Makefile via `-include .env`). See `.env.example` for all vars.

**Funded deployer wallet (DO NOT REDEPLOY -- funded with ETH on Base Sepolia):**
- Address: `0x1214ACab3De95D9C72354562D223f45e16a80389`
- Private key in `.env` (gitignored). If `.env` is lost, check GitHub secrets or generate a new one and re-fund.

**Base Sepolia external addresses (immutable, not ours):**
- Circle USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- WETH: `0x4200000000000000000000000000000000000006`
- Uniswap V3 Factory: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- Uniswap V3 NFPM: `0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2`
- Uniswap V3 SwapRouter: `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`

**Base Sepolia deployed contracts (v2, redeployed 2026-02-20 with MockUSDC):**
- MockUSDC: `0xBf68FAa69faA3b42FFDEA2C033dF795706F6362b` (mintable, 10k max per call)
- HouseVault: `0xeF9334cA8C7cb7F081e4A53005020CD2F939A979`
- ParlayEngine: `0x8463CF3D7EE71Be38dDD10f83BA64689033eFDd2`
- LegRegistry: `0x2244D0f74469BD0ef8C47e7E5f7631E529D4c3bc` (47 legs registered)
- LockVault: `0x75457799813D894078FEbec6Fed6602938635435`
- AdminOracleAdapter: `0x4d2a37b47C5950Fa314E2cd6620CD01161B5eF22`
- OptimisticOracleAdapter: `0xaB07986A968B5F8E70ebc5d5ce7f47E117Bbd8d5`
- MockYieldAdapter: `0x995223C4763eA63cB6F46D79514a3020c42F5D53`
- Uniswap V3 Pool (MockUSDC/WETH, 0.05%): `0xcd32e3536406aC7f41DD677DB152ce462680701a`
- LP NFT #78037 (0.1 WETH + 280 USDC initial liquidity)

These contracts are owned by the deployer. Redeploying contracts is fine (costs gas). Redeploying/changing the deployer wallet loses the funded ETH -- avoid unless necessary.

## Tests

```
packages/contracts/test/unit/       # Per-contract unit tests
packages/contracts/test/fuzz/       # Fuzz tests (vault, math)
packages/contracts/test/invariant/  # Invariant tests (totalReserved <= totalAssets)
packages/contracts/test/Integration.t.sol  # Full lifecycle
packages/services/test/             # API + math tests (vitest)
  catalog.test.ts                   #   Market catalog (seed + BDL, category filtering)
  smoke.test.ts                     #   All routes smoke + error paths
  snapshots.test.ts                 #   API response shape regression
  env-helpers.test.ts               #   BDL environment/config edge cases
  agent-quote.test.ts               #   x402-gated agent quote endpoint
apps/web/src/*/__tests__/           # Frontend tests (vitest)
packages/e2e/test/                  # E2E integration tests (Anvil-backed)
  01-deploy.test.ts                 #   Contract deployment verification
  02-registration.test.ts           #   Leg registration + mapping
  03-api-consistency.test.ts        #   API ↔ on-chain data consistency
  04-lifecycle.test.ts              #   Full ticket lifecycle (buy → resolve → claim)
  05-vault-flow.test.ts             #   Vault deposit/withdraw/reserve flows
```

Foundry config: optimizer 200 runs, fuzz 256 runs, invariant 64 runs / depth 32.

## Subdirectory Memory

Package-specific rules are in subdirectory `CLAUDE.md` files (loaded on-demand when working in that directory):
- `packages/contracts/CLAUDE.md` -- Solidity/Foundry rules, contract details, testing expectations
- `packages/shared/CLAUDE.md` -- math parity rules, change protocol
- `packages/services/CLAUDE.md` -- API conventions, x402 status
- `apps/web/CLAUDE.md` -- wagmi conventions, demo readiness

## Lessons Learned (from PR reviews)

See `docs/solutions/` for detailed write-ups. Key patterns to avoid:

1. **Stale async state**: Every polling hook MUST use fetchId + inFlight guards. Disconnect MUST invalidate in-flight work. (001)
2. **Unit mismatches**: Never subtract shares from assets. TS math functions MUST match Solidity signatures exactly. (002)
3. **Dead states**: Before setting a "claimable" status, verify there's something to claim. Every state must be reachable. (003)
4. **Event accuracy**: Events MUST emit actual outcomes, not intended values. New struct fields need corresponding event fields. (004)
5. **CEI always**: State changes before external calls. Before transferring to a contract, verify it can process the tokens. (005)
6. **Button priority**: Transaction status (pending/confirming/success) ALWAYS takes priority over UI state conditions. (006)
7. **Config validation**: Production env vars MUST throw on zero/empty defaults. Never hardcode env var names in multiple places. (007)
8. **Boundary validation**: Validate at EVERY boundary. `parseDecimal` is the single entry point for user numeric input. (008)
9. **Test coverage**: Invariant test handlers MUST assert they actually executed meaningful actions. 100% failure rate = broken test. (009)
10. **Regex `\s` overmatch**: In character classes, `\s` matches tabs/newlines/carriage returns — not just spaces. Use a literal space when you mean space. (008 updated)
11. **BigInt-to-Number overflow**: Every `Number(bigint)` conversion MUST be guarded by `> BigInt(Number.MAX_SAFE_INTEGER)`. Exponential BigInt growth (multiplied probabilities) will silently lose precision. (012)
12. **NaN bypass on partial input**: `parseFloat(".")` returns NaN but `"."` is truthy. Every numeric input must add `isNaN(parsedValue)` to button disabled conditions. (008 updated)
13. **Vacuous conditional assertions**: Never wrap `expect()` inside `if (condition)` — if the condition is false, zero assertions run and the test passes vacuously. Assert unconditionally. (009 updated)
14. **BigInt division by zero**: `BigInt / 0n` throws `RangeError` (unlike Number which returns Infinity). Guard every BigInt divisor with `> 0n`. (012 updated)
15. **Test selector ambiguity**: When tabs and action buttons share text content, `getAllByRole("button").find(text)` matches the wrong one. Use `data-testid` or CSS class filtering. (013)
16. **In-flight fetch race conditions**: When async fetches can be invalidated (user changes input mid-flight), use a fetchId ref pattern: increment on trigger, check before applying results, and reset loading state in the cleanup effect -- not just in the fetch callback. Otherwise stale results overwrite fresh state or loading spinners get stuck. (014)
17. **BigInt falsiness**: `BigInt(0)` is falsy in JavaScript. `if (bigintVar)` evaluates false for `0n`. Always use `bigintVar !== undefined` for existence checks on BigInt values. Using truthiness creates phantom defaults (e.g., `balance ? x : fallback` sends fallback when balance is legitimately zero). (014)
18. **API type boundary mismatches**: When sending BigInt-sourced IDs to JSON APIs, `BigInt.toString()` produces a string, but Zod `z.number()` schemas reject strings. Use `Number(bigint)` for small IDs. The JSON serialization boundary (BigInt -> JSON -> Zod) is where type assumptions silently break. (014)
19. **Silent fetch failures**: Never `catch {}` a user-facing API call. Always surface errors to the user, even if just "unavailable." Silent failures make features appear broken with no feedback. Validate response shape before use -- API contracts drift. (014)
20. **Dead exports from refactoring**: When removing a function call, grep for the callee. If zero callers remain and it's not a public API, delete it. Exported dead code passes typecheck and builds, so it's invisible without explicit search. (015)
21. **Zero BigInt at API boundaries**: `formatUnits(0n, 6)` produces `"0"` which Zod `> 0` rejects. Guard with `value !== undefined && value > 0n ? convert(value) : fallback`. This is the third variant of the zero-value problem (see #8, #12, #17). (015)
22. **Type guard exhaustiveness**: A type guard asserting `data is T` MUST validate ALL fields of T, not just the ones currently consumed. Partial guards create unsound narrowing -- TypeScript trusts the assertion, so unchecked fields become runtime `undefined` behind a `string`/`number` type. (015)
23. **Spec completeness**: Every interface, struct, or contract type referenced in a spec document MUST have an explicit definition in that document. Readers cannot infer method signatures from call sites alone. (015)
24. **Lazy singleton retry storms**: When a lazy-init singleton fails initialization, set `disabled = true` on ALL failure paths. Otherwise every subsequent request retries, producing log spam and wasted I/O. (016)
25. **Eager combinatorial materialization**: Never materialize full `C(n,k)` sets before filtering. Use backtracking with early termination (`if (results.length >= max) return`). `C(20,5)` = 15,504 items; `C(30,5)` = 142,506. (016)
26. **useEffect declaration order on mount**: React effects fire in declaration order. A "reset" effect after a "watch" effect clobbers the watch on initial mount. Use `prevRef` to gate resets on specific prop transitions (e.g., `false -> true`), not every mount. (016)
27. **SVG stroke reveal needs Euclidean distances**: `strokeDashoffset` based on `segmentIndex / totalSegments * pathLength` assumes uniform segments. Real SVG paths have variable segment lengths. Compute cumulative `Math.sqrt(dx*dx + dy*dy)` per segment. (016)
28. **Test hermeticity for feature toggles**: Tests that depend on the ABSENCE of an env var must `delete process.env.KEY` in `beforeAll` and restore in `afterAll`. Dev environment leaks into CI otherwise. (016)
29. **Unused dependencies from removed features**: `pnpm install` adds to package.json but removing consuming code doesn't remove the declaration. Grep for imports before shipping any PR that deletes or replaces functionality. (016)
30. **ID namespace collisions across data sources**: When multiple systems produce numeric IDs (contract deploy order vs. catalog sequence vs. API), ranges WILL collide. Use non-overlapping offsets (e.g., NBA legs start at 1000) or tag IDs with source. Never assume different ID spaces won't overlap. (017)
31. **Stale object refs after async state replacement**: When `selectedItems` holds references from `allItems`, replacing `allItems` leaves `selectedItems` pointing at stale objects with outdated fields (e.g., `onChain: true` from mock data). Add a reconciliation `useEffect` keyed on the primary collection. (017)
32. **Persisted UI state referencing unavailable options**: Session-stored category/filter values may reference options that no longer exist (API failure, feature flag off). Always validate restored values against current available options and reset to a safe default on mismatch. (017)
33. **Cross-environment config trust**: Static config files (JSON mappings, deploy artifacts) must include and validate environment metadata (chain ID, network). Never apply a config without checking it matches the current runtime. A stale mapping from the wrong chain silently corrupts on-chain operations. (017)
34. **Race-unsafe sequential ID derivation**: Never derive on-chain IDs from local counters (`legCount + created`). Concurrent writers invalidate the assumption. Re-read authoritative state after tx receipt or parse the creation event. (017)
35. **Snapshot tests silently capturing error shapes**: Snapshot tests auto-pass on first run by writing whatever they receive. If the request is malformed and returns an error, the snapshot baseline becomes the error shape. Always assert `status === 200` before `toMatchSnapshot()`. (017)
36. **Completed-event data leaking into active pipelines**: Data pipeline filters must be consistent across all paths (primary, fallback, cache). A safety-critical filter (e.g., excluding finalized games) applied only on the primary path but not the fallback creates an exploit window. Extract shared filter functions. (017)

After every non-trivial bug fix, document in `docs/solutions/` with: Problem, Root Cause, Solution, Prevention (category-level).

## Post-Review Protocol

When `/review` produces findings and code fixes are implemented:
1. **Write tests for every code change** before committing. No untested fix ships.
2. Tests must cover the specific behavior the fix introduces (e.g., guard clause returns expected response, middleware produces expected headers, size limits reject oversized payloads).
3. Run `make gate` to verify all tests pass.
4. Update `todos/` files: mark implemented items as `complete`, rename file (`pending` -> `complete`). Naming convention: `NNN-{pending|complete}-p{1|2|3}-short-description.md` where p1=critical, p2=important, p3=minor.
5. **Commit and push BEFORE replying to comments.** Replies must reference the commit SHA that contains the fix. Without pushing first, there is no SHA to link.
6. **Reply to PR review comments** after the push lands. For each reviewer comment (Copilot, Cursor Bug Bot, humans):
   - If fixed: reply with the commit SHA (e.g., `Fixed in abc1234`) and a one-sentence explanation of the fix.
   - If deferred: reply acknowledging the issue, link to the tracking todo, and explain why it's deferred.
   - If no action needed (informational/already handled): reply briefly explaining the current state.
   - Never leave review comments unanswered.
7. **Compound the knowledge.** For each non-trivial fix:
   - Update or create a `docs/solutions/` entry (Problem, Root Cause, Solution, Prevention).
   - Add a one-liner to the "Lessons Learned" index in this file.
   - If the fix reveals a new category-level rule, add it to the relevant `CLAUDE.md` (root or subdirectory).

## Compaction Guidance

When compacting a long session, always preserve:
- Current goal + PR scope
- List of modified files
- Commands run + results
- Remaining TODOs / blockers
- Which gap analysis items were addressed
