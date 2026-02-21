# Services (Express + Zod + x402)

## Routes

Express on port 3001. Rate-limited.

- `GET /markets` -- multi-category market catalog (seed + BDL NBA), supports `?category=` filter
- `GET /markets/categories` -- available categories with market/leg counts
- `POST /quote` -- off-chain parlay quote (resolves legs from full catalog including NBA, must match on-chain execution)
- `GET /exposure` -- mock hedger exposure tracking
- `POST /premium/sim` -- x402-gated analytical simulation
- `POST /premium/risk-assess` -- x402-gated Kelly criterion risk advisor
- `POST /premium/agent-quote` -- x402-gated combined quote + risk for autonomous agents (resolves probabilities from catalog)
- `GET /vault/health` -- vault health assessment (mock data, scaffold for on-chain reads)
- `GET /vault/yield-report` -- yield optimization report (mock data)
- `GET /health`

## Catalog Architecture

The market catalog is a unified system merging multiple data sources:

- `src/catalog/seed.ts` -- 7 hardcoded categories (crypto, sports, ethdenver-2026, culture, tech, defi, meme) with static probabilities
- `src/catalog/bdl.ts` -- live NBA markets from BallDontLie API. Fetches upcoming games, team season averages, estimates moneyline/over-under probabilities. 5-min in-memory cache. Requires `BDL_API_KEY` env var (gracefully disabled if absent). NBA leg IDs start at offset 1000 (`NBA_LEG_ID_OFFSET + game.id * 2`) to avoid collisions with seed IDs. Also exports `fetchCompletedGames(lookbackDays)` for resolution (no cache -- needs fresh data) and `BDLGameResult` type. Used by `scripts/market-agent.ts`.
- `src/catalog/registry.ts` -- unified `getFullLegMap()` merging seed + BDL legs into a single `Map<number, Leg>`. Used by `/quote` and `/premium/agent-quote`. Also exposes `getSeedLegMap()` (sync, seed-only) and `getCategorySummary()`.

When adding a new data source: create a new file in `src/catalog/`, export a `fetchXMarkets(): Promise<Market[]>` function, register it in `registry.ts`.

## Rules

- Validate all inputs with Zod. No untyped request bodies.
- `/quote` math output must match on-chain execution exactly (uses shared math library).
- `/quote` MUST resolve legs from `getFullLegMap()` (not seed-only) so NBA legs are quotable.
- Rate limiting must remain enabled.
- BDL data: always filter out `status === "Final"` games on ALL code paths (primary, fallback, cache). Completed games must never be exposed as active/bettable.

## x402 Status

Production (`NODE_ENV=production`): real x402 verification via `@x402/express` + `ExactEvmScheme`. USDC payment on Base, verified through facilitator. Env vars: `X402_RECIPIENT_WALLET`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `X402_PRICE`.

Non-production (dev/test/CI, or `X402_STUB=true`): stub middleware accepts any non-empty `X-402-Payment` header. Returns x402-compliant 402 responses with `accepts` array.

## Testing

`pnpm test` runs vitest. Test suites:

- `catalog.test.ts` -- market catalog (seed categories, BDL integration, category filtering, registry merge)
- `smoke.test.ts` -- all routes smoke testing + error paths + edge cases
- `snapshots.test.ts` -- API response shape regression (detects field additions/removals/type changes)
- `env-helpers.test.ts` -- BDL environment, config, cache, and season logic edge cases
- `agent-quote.test.ts` -- x402-gated agent quote endpoint
- `api.test.ts` -- core API endpoint behavior
- `math.test.ts` -- math parity between TS and Solidity

Snapshot tests: `stabilize()` replaces dynamic values (timestamps) with type-preserving placeholders (e.g., `0` not `"<DYNAMIC>"`) so `shapeOf()` reports correct types. Always assert `status === 200` before `toMatchSnapshot()`.
