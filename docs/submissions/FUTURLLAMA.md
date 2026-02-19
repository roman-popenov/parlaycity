# ParlayCity -- Futurllama Track Submission

## Summary

ParlayCity is the first Crash-Parlay AMM -- an on-chain protocol that turns parlay bets into live instruments with real-time cashout, agent-native risk assessment via x402 micropayments, and a unified vault architecture that eliminates liquidity fragmentation.

---

## The Novel Mechanic: Crash-Parlay

Traditional parlays are passive: pick legs, place bet, wait. ParlayCity applies Aviator's crash game loop to real-event parlays, creating a new category of prediction market instrument.

**How it works:**

A user builds a 2-5 leg parlay on real-world outcomes (sports, markets, politics). As each leg resolves favorably, the multiplier climbs -- like Aviator's ascending plane. After each leg wins, the user faces a decision: cash out at the current multiplier, or ride for a higher payout. If a leg loses, the multiplier crashes to zero.

```
3-leg parlay, each leg ~40% probability:

  Buy at $100 (2.5% fee = $2.50)
    |
    +-- Leg 1 wins -> multiplier climbs to 2.5x
    |     Cash out $244? Or ride?
    |
    +-- Leg 2 wins -> multiplier climbs to 6.2x
    |     Cash out $604? Or ride?
    |
    +-- Leg 3 resolving...
          Wins -> full payout: $1,521
          Loses -> crash to $0
```

This transforms parlays from lottery tickets into actively-managed positions with two skill dimensions: picking legs (market knowledge) and timing exits (risk management).

**Why this is novel on-chain:** No deployed protocol combines unified vault liquidity with a crash-parlay cashout mechanic. Azuro has a singleton pool but no live cashout. Overtime Markets has a vault but no crash mechanic. Polymarket has no parlay product at all. Kalshi fragments per-combo orderbooks with no guaranteed exit.

**Scale of the underlying mechanic:** Aviator generates $14B/month in wagers with 42-77M monthly active users. Crash games account for 58% of social casino content share growth (Eilers & Krejcik). ParlayCity applies this proven engagement loop to real-event outcomes instead of pure randomness.

---

## Agent-Native Quoting via x402

ParlayCity's risk assessment API is gated by the x402 payment protocol -- AI agents pay USDC micropayments on Base to access premium analytics.

**How it works:**

1. An agent discovers available markets via the public `/markets` endpoint
2. The agent requests a risk assessment via `/premium/risk-assess` -- this endpoint requires x402 payment
3. The `@x402/express` middleware verifies the USDC payment on Base using `ExactEvmScheme`
4. The agent receives Kelly criterion analysis, expected value, confidence scores, and risk warnings
5. Based on the assessment, the agent decides whether to place a bet, skip, or adjust position

**Implementation:** Real x402 verification using `@x402/express` with `paymentMiddleware`. Production mode verifies USDC payments on Base via the facilitator contract. Dev/test mode falls back to a stub. Two gated endpoints: `/premium/sim` (Monte Carlo simulation) and `/premium/risk-assess` (risk analysis with Kelly criterion, EV, and warnings).

This is not a hypothetical -- the verification infrastructure is deployed and tested. Agents can autonomously discover markets, pay for analysis, and make betting decisions in a fully permissionless loop.

---

## Unified Vault Architecture

Every bet in ParlayCity draws from a single USDC vault. This solves the liquidity fragmentation problem that plagues per-market orderbook designs:

- **HouseVault (ERC-4626-like):** LPs deposit USDC, receive vUSDC shares. The vault underwrites all bets with an 80% utilization cap and 5% per-ticket payout cap.
- **Fee routing:** 90% of all fees flow to committed LPs (lockers). 5% to a safety buffer. 5% stays in the vault. This is enforced by the smart contract, not by admin discretion.
- **No liquidity fragmentation:** Unlike Polymarket (per-market orderbooks) or Kalshi (per-combo RFQ), a single pool backs every parlay. Thin markets don't suffer from poor spreads because they share the same liquidity.

**Comparable protocols:** GMX GLP (25% APR, $500M TVL), Hyperliquid HLP (42% CAGR lifetime), Overtime Markets (106% cumulative return Y1). Same architecture, proven at scale.

---

## Non-Extractive Economics

ParlayCity's fee model is designed to be the most transparent in prediction markets:

| Platform | Parlay Fee | Where It Goes | Visible? |
|----------|-----------|---------------|----------|
| DraftKings | 17-35% (hidden) | Corporate profit | No |
| FanDuel | 17-35% (hidden) | Corporate profit | No |
| Overtime | ~5% spread | LP + token burns | Partially |
| ParlayCity | 2-3.5% (explicit) | 90% LPs, 5% safety, 5% vault | Yes, on-chain |

Zero team take. No governance token. No founder allocation. The protocol earns from the structural house edge (17-35% on parlays compound against the gambler) and the explicit fee.

**Social impact layer:** 10% of every losing stake is routed to gambling harm reduction via Gitcoin-style donation routing. When a bettor's multiplier crashes, they see a "Become the House" call-to-action -- converting losing gamblers into LPs at the moment they're most receptive to switching sides.

---

## What's Built

| Component | Status |
|-----------|--------|
| HouseVault (ERC-4626, 80% util cap, 5% payout cap, 90/5/5 fee routing) | Deployed, tested |
| ParlayEngine (ERC-721 tickets, 3 payout modes, cashout with slippage) | Deployed, tested |
| LockVault (30/60/90-day tiers, Synthetix-style rewards) | Deployed, tested |
| ParlayMath (Solidity + TypeScript mirror, exact parity) | Deployed, tested |
| Oracle adapters (admin bootstrap + optimistic production) | Deployed, tested |
| Frontend (builder, vault, tickets, MultiplierClimb viz) | Working |
| x402 risk assessment API (real USDC verification on Base) | Working |
| Test suite (unit, fuzz, invariant, integration) + CI | Passing |

---

## Technical Stack

Solidity 0.8.24 (Foundry) | Next.js 14 | wagmi 2 + viem 2 | Express.js | Base (EVM)

Monorepo with shared math library ensuring Solidity-TypeScript parity. pnpm workspaces. GitHub Actions CI with quality gate (`make gate`).
