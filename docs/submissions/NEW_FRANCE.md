# ParlayCity -- New France Village Track Submission

## Summary

ParlayCity is the first Crash-Parlay AMM: an on-chain prediction market protocol where parlay bets become live instruments with real-time cashout. Users build 2-5 leg parlays on real-world events, watch their multiplier climb as legs resolve, and choose when to exit -- before a leg crashes the position to zero.

The protocol is built on Base with a unified USDC vault architecture, ERC-721 ticket NFTs, and a Synthetix-style lock mechanism for liquidity providers.

---

## What We Built

**On-chain prediction market + vault, fully functional on EVM.**

ParlayCity is not a frontend wrapper around an existing protocol. Every component is purpose-built:

**Smart Contracts (Solidity 0.8.24, Foundry):**
- **HouseVault** -- ERC-4626-like USDC vault with 80% utilization cap and 5% per-ticket payout cap. LPs deposit USDC, receive vUSDC shares, and earn from both fees and the structural house edge on losing parlays. Fee routing (90/5/5 split) is enforced deterministically by the contract.
- **ParlayEngine** -- Mints ERC-721 ticket NFTs, computes multipliers via on-chain math, manages the full ticket lifecycle (buy, settle, claim, progressive claim, early cashout with slippage protection). Supports Classic, Progressive, and EarlyCashout payout modes.
- **LockVault** -- 30/60/90-day lock tiers with Synthetix-style reward accumulation. Lockers receive 90% of all protocol fees, weighted by tier (1.1x/1.25x/1.5x).
- **ParlayMath** -- Pure library computing multipliers, edges, payouts, and cashout values. Mirrored exactly in TypeScript for frontend parity.
- **Oracle Adapters** -- Pluggable settlement via `IOracleAdapter`. AdminOracleAdapter for bootstrap, OptimisticOracleAdapter with bonds and challenge windows for production.

**Test Suite:**
- Unit, fuzz (256 runs), invariant (64 runs, depth 32), and integration tests
- Core invariant: `totalReserved <= totalAssets()` -- the vault can always cover all reserved payouts
- Solidity-TypeScript math parity tests ensure no drift between on-chain and off-chain computation

**Frontend (Next.js 14, wagmi 2, viem 2):**
- Parlay builder with real-time quote previews
- Vault dashboard (deposit, withdraw, lock, unlock)
- Ticket list and detail pages with MultiplierClimb visualization
- x402-gated premium analytics

**Services (Express.js):**
- Market catalog, quote engine, exposure tracking
- x402 payment-gated risk assessment using `@x402/express` with real USDC verification on Base

---

## Why This Qualifies for New France

The New France Village track asks for on-chain prediction markets and vault-based DeFi. ParlayCity delivers both in a single protocol:

**On-chain prediction:** Every parlay is a structured prediction on real-world outcomes. The multiplier is computed from on-chain probability data using deterministic math. Settlement is permissionless -- anyone can call `settleTicket()`. No keeper dependency, no access control on resolution.

**Vault architecture:** The HouseVault is the counterparty to all bets. This is the same vault-as-counterparty model proven at scale by GMX ($500M TVL), Hyperliquid, and Overtime Markets. LPs earn from the structural house edge (17-35% on parlays, the highest-margin bet type in sports betting) plus explicit fee share.

**The novel combination:** No deployed protocol combines unified vault liquidity with a crash-parlay cashout mechanic on real-event parlays. Azuro has a singleton pool but no live cashout. Overtime has a vault but no crash mechanic. Polymarket has no parlay product at all. ParlayCity is the first to apply Aviator's proven engagement loop ($14B/month in wagers, 42-77M MAU) to the highest-margin prediction market instrument.

---

## Technical Innovation

**Crash-parlay as a financial primitive.** Traditional parlays are passive lottery tickets. ParlayCity transforms them into actively-managed positions:

```
Leg 1 wins -> multiplier: 1.0x -> 2.5x    Cash out at 2.5x?
Leg 2 wins -> multiplier: 2.5x -> 6.2x    Cash out at 6.2x?
Leg 3 loses -> multiplier crashes to 0      Too late.
```

The cashout price is computed from remaining implied probabilities with a spread:

```
V_fair    = potentialPayout * P_remaining
V_cashout = V_fair * (1 - cashoutFeeBps - riskSpreadBps)
```

This creates a second skill dimension beyond leg selection: position management. A bettor who correctly assesses that remaining legs are riskier than priced can exit for profit. This is risk management, not coin flipping.

**Non-extractive economics.** The fee is 2-3.5% (explicit, visible) vs 17-35% (hidden in odds) at DraftKings/FanDuel. 90% of fees flow to committed liquidity providers. Zero team take. No governance token. The protocol is self-sustaining from day one.

---

## Safety Guarantees

The protocol prioritizes depositor safety with four on-chain invariants:

1. **Solvency:** `totalReserved <= 80% * totalAssets()` -- 20% always unencumbered
2. **Concentration:** No single ticket can claim more than 5% of vault TVL
3. **Custody:** The engine never holds USDC. Funds flow directly to the vault.
4. **No admin drain:** No `selfdestruct`, no proxy upgrade, no admin withdrawal function

These are not promises -- they are smart contract invariants verified with fuzz and invariant testing.

---

## Links

- Deployed on Base (EVM)
- Full test suite: `make gate` (contracts + services + frontend typecheck + build)
- Architecture: see `docs/ARCHITECTURE.md`
- Economics: see `docs/ECONOMICS.md`
