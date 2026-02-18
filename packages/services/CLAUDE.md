# Services (Express + Zod + x402)

## Routes

Express on port 3001. Rate-limited.

- `GET /markets` -- seed market catalog
- `POST /quote` -- off-chain parlay quote (must match on-chain execution)
- `GET /exposure` -- mock hedger exposure tracking
- `POST /premium/sim` -- x402-gated analytical simulation
- `POST /premium/risk-assess` -- x402-gated risk advisor (Kelly criterion, EV, confidence)
- `GET /vault/health` -- vault utilization, concentration, health status
- `GET /vault/yield-report` -- yield adapter performance and recommendations
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
