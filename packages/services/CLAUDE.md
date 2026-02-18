# Services (Express + Zod + x402)

## Routes

Express on port 3001. Rate-limited.

- `GET /markets` -- seed market catalog
- `POST /quote` -- off-chain parlay quote (must match on-chain execution)
- `GET /exposure` -- mock hedger exposure tracking
- `POST /premium/sim` -- x402-gated analytical simulation
- `GET /health`

## Rules

- Validate all inputs with Zod. No untyped request bodies.
- `/quote` math output must match on-chain execution exactly (uses shared math library).
- Rate limiting must remain enabled.

## x402 Status

Current: stub middleware only -- checks for non-empty `X-402-Payment` header, no real on-chain payment verification.

Target (for Kite AI $10k bounty): real x402 verification with on-chain payment proof. If stubbed for development, clearly label it and gate with `NODE_ENV`.

## Testing

`pnpm test` runs vitest. Tests cover API endpoints and math parity.
