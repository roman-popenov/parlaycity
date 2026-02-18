# Shared Math -- ParlayMath Parity Rules

## Non-negotiable

`packages/shared/src/math.ts` must match `ParlayMath.sol` exactly:
- Same integer arithmetic
- Same rounding behavior
- Same constants
- Same PPM (1e6) / BPS (1e4) scales

## Constants

```
BASE_FEE_BPS      = 100
PER_LEG_FEE_BPS   = 50
MAX_UTILIZATION_BPS = 8000
MAX_PAYOUT_BPS    = 500
```

## TS Implementation Rules

- Use `bigint` for exact integer math when needed
- No floating point for monetary values
- Off-chain quotes must always match on-chain execution

## Change Protocol

1. Change Solidity (`ParlayMath.sol`)
2. Change TypeScript (`math.ts`)
3. Add/adjust parity tests
4. Run `make test-all`
