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

make gate              # test-all + typecheck + build-web (CI quality gate)
make typecheck         # tsc --noEmit (apps/web)
make build-web         # next build
make coverage          # forge coverage --report summary
```

Single contract test: `cd packages/contracts && forge test -vvv --match-test <TestName>`

Per-package: `pnpm --filter web dev`, `pnpm --filter web test`, `pnpm --filter services test`, `pnpm -r lint`

## Architecture (Current State)

**Contracts:** ERC4626-like HouseVault (USDC, vUSDC shares, 80% utilization cap, 5% max payout, 90/5/5 fee routing via `routeFees`). ParlayEngine (ERC721 tickets, baseFee=100bps + perLegFee=50bps). LegRegistry (admin-managed outcomes). LockVault (30/60/90 day locks, Synthetix-style rewards, fee income via `notifyFees` from HouseVault). ParlayMath (pure library mirrored in TS). Oracles: AdminOracleAdapter (bootstrap) + OptimisticOracleAdapter (production). Deploy order in `script/Deploy.s.sol`.

**Frontend:** Next.js 14 pages: `/` (builder), `/vault`, `/tickets`, `/ticket/[id]`. wagmi 2 + viem 2 + ConnectKit. Polling 5s/10s with stale-fetch guards.

**Services:** Express port 3001. Routes: `/markets`, `/quote`, `/exposure`, `/premium/sim` (x402-gated stub), `/health`.

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

## Gap Analysis

### EXISTS (working, tested, deployed)
- HouseVault: deposit, withdraw, reserve/release/pay, yield adapter, 90/5/5 fee routing via `routeFees`
- ParlayEngine: buyTicket, settleTicket, claimPayout, partial void, ERC721
- LegRegistry: CRUD, validation, oracle adapter references
- LockVault: lock/unlock/earlyWithdraw, Synthetix-style fee distribution via `notifyFees`, penalty
- ParlayMath: multiplier, edge, payout (Solidity + TypeScript mirror)
- AdminOracleAdapter + OptimisticOracleAdapter
- MockYieldAdapter + AaveYieldAdapter (not in default deploy)
- Frontend: parlay builder, vault dashboard, tickets list, ticket detail, MultiplierClimb viz
- Services: catalog, quote, exposure (mock), x402-gated premium/sim (real @x402/express verification)
- Tests: unit, fuzz, invariant, integration (contracts), vitest (services + web)
- CI: GitHub Actions (3 jobs), Makefile quality gate
- Deploy script + sync-env

### NEEDS BUILDING
- SafetyModule contract (insurance buffer, yield deployment)
- Loss distribution routing (80/10/10 split on losing stakes to LP/AMM/rehab)
- Cashout mechanism (`cashoutTicket` on ParlayEngine or separate contract)
- Automatic penalty distribution (replace sweepPenaltyShares manual sweep)
- ERC-4337 paymaster integration (gasless buyTicket/cashout/lock via Base Paymaster)
- Per-market exposure tracking and caps
- Utilization-based dynamic pricing (riskPremiumBps)
- Rehab mode UX (losing users -> LP conversion CTA)
- Good cause donation routing (Gitcoin-style)

### DISCONNECTED (exists but not wired)
- `LockVault.sweepPenaltyShares`: penalty shares accumulate silently until owner sweeps
- `MultiplierClimb` component exists but cashout game loop does not
- `IHedgeAdapter` interface exists, services mock exists, but no deployed contract
- `AaveYieldAdapter` exists in src but default deploy only uses MockYieldAdapter

## PR Strategy

- Small PRs against `main`. Main stays green.
- Sequence: PR0 (docs/narrative) -> PR1 (FeeRouter) -> PR2 (SafetyModule) -> PR3 (cashout) -> PR4 (x402 real verification) -> PR5 (paymaster + OnchainKit) -> PR6 (crash UX + rehab) -> PR7 (stretch)
- Every PR must pass `make gate` before merge.
- Contract PRs must include tests AND a security note.

## Environment

`apps/web/.env.local` is auto-generated by `make deploy-local` (via `scripts/sync-env.sh`). Contains contract addresses and chain ID. WalletConnect project ID must be set manually.

## Tests

```
packages/contracts/test/unit/       # Per-contract unit tests
packages/contracts/test/fuzz/       # Fuzz tests (vault, math)
packages/contracts/test/invariant/  # Invariant tests (totalReserved <= totalAssets)
packages/contracts/test/Integration.t.sol  # Full lifecycle
packages/services/test/             # API + math tests (vitest)
apps/web/src/*/__tests__/           # Frontend tests (vitest)
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

After every non-trivial bug fix, document in `docs/solutions/` with: Problem, Root Cause, Solution, Prevention (category-level).

## Post-Review Protocol

When `/review` produces findings and code fixes are implemented:
1. **Write tests for every code change** before committing. No untested fix ships.
2. Tests must cover the specific behavior the fix introduces (e.g., guard clause returns expected response, middleware produces expected headers, size limits reject oversized payloads).
3. Run `make gate` to verify all tests pass.
4. Update `todos/` files: mark implemented items as `complete`, rename file (`pending` -> `complete`).
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
