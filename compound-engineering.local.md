---
review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

- Monorepo: TypeScript services + Next.js frontend + Solidity contracts (Foundry)
- Financial protocol: extra scrutiny on BigInt/Number boundaries, PPM/BPS scale mismatches, and token arithmetic
- All numeric input must go through `parseDecimal` — reject scientific notation, hex, octal, sign prefixes
- Shared math parity invariant: `math.ts` must match `ParlayMath.sol` exactly (same rounding, same integer arithmetic)
- x402 payment gating on premium endpoints — verify stub vs production config consistency
- Mock data in vault/risk endpoints — flag any mock that could leak into production
