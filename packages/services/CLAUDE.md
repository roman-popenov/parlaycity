# Services (Express + Zod + x402)

## Routes

Express on port 3001. Rate-limited.

- `GET /markets` -- multi-category market catalog (seed + BDL NBA), supports `?category=` filter
- `GET /markets/categories` -- available categories with market/leg counts
- `POST /quote` -- off-chain parlay quote (must match on-chain execution)
- `GET /exposure` -- mock hedger exposure tracking
- `POST /premium/sim` -- x402-gated analytical simulation
- `POST /premium/risk-assess` -- x402-gated Kelly criterion risk advisor
- `POST /premium/agent-quote` -- x402-gated combined quote + risk for autonomous agents (resolves probabilities from catalog)
- `GET /vault/health` -- vault health assessment (mock data, scaffold for on-chain reads)
- `GET /vault/yield-report` -- yield optimization report (mock data)
- `GET /health`

## Rules

- Validate all inputs with Zod. No untyped request bodies.
- `/quote` math output must match on-chain execution exactly (uses shared math library).
- Rate limiting must remain enabled.

## x402 Status

Production (`NODE_ENV=production`): real x402 verification via `@x402/express` + `ExactEvmScheme`. USDC payment on Base, verified through facilitator. Env vars: `X402_RECIPIENT_WALLET`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `X402_PRICE`.

Non-production (dev/test/CI, or `X402_STUB=true`): stub middleware accepts any non-empty `X-402-Payment` header. Returns x402-compliant 402 responses with `accepts` array.

## Testing

`pnpm test` runs vitest. Tests cover API endpoints and math parity.
