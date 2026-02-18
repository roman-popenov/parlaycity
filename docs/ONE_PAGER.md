# ParlayCity -- One Pager

**The first Crash-Parlay AMM.** On-chain parlay betting with live cashout, non-extractive fee routing, and unified vault liquidity. Built at ETHDenver 2026.

---

## The Problem

- **Centralized sportsbooks hide the vig.** DraftKings/FanDuel embed 17-35% margins into parlay odds. The gambler never sees what they're paying. Winning accounts get banned.
- **On-chain markets fragment liquidity.** Polymarket has no parlay product. Kalshi fragments per-combo orderbooks. Azuro has no live cashout. Every bet on every market needs its own liquidity.
- **Parlays are passive.** Traditional parlays are lottery tickets -- buy, wait, pray. No agency, no skill expression beyond initial picks.

## The Solution

- **Crash-parlay game loop.** Your multiplier climbs live as legs resolve. Cash out before a leg crashes, or ride to full payout. Proven mechanic: Aviator generates $14B/month in wagers with 42-77M MAU.
- **Unified vault liquidity.** One USDC vault backs all bets. No liquidity fragmentation. LPs earn from fees + losing bets. 90% of all fees flow to committed liquidity providers.
- **Non-extractive economics.** 2-3.5% explicit fee (vs 17-35% hidden). Zero team take. 10% of every loss funds gambling harm reduction.

## How It Works

```
Gambler stakes $100 USDC
  |
  +-- $2.50 fee (2.5%) --> 90% to Lockers, 5% Safety, 5% Vault
  |
  +-- $97.50 reserved in Vault
        |
        +-- [Leg 1 wins] --> multiplier: 2.5x. Cash out? Or ride?
        +-- [Leg 2 wins] --> multiplier: 6.2x. Cash out? Or ride?
        +-- [Leg 3 loses] --> multiplier crashes to 0.

LP deposits USDC --> earns from: gambler losses + 90% of ALL fees
  |
  +-- locks vUSDC in LockVault --> 30/60/90 day tiers (1.1x-1.5x boost)
```

## What's Built

| Component | Status |
|-----------|--------|
| HouseVault (ERC-4626, 80% utilization cap, 5% per-ticket cap) | Deployed, tested |
| ParlayEngine (ERC-721 tickets, settlement, claim) | Deployed, tested |
| LockVault (30/60/90 day locks, Synthetix-style rewards) | Deployed, tested |
| ParlayMath (Solidity + TypeScript mirror, exact parity) | Deployed, tested |
| Oracle adapters (admin bootstrap + optimistic production) | Deployed, tested |
| Frontend (builder, vault, tickets, MultiplierClimb viz) | Working |
| API (quote, catalog, x402-gated premium analytics) | Working |
| Tests (unit, fuzz, invariant, integration) + CI | Passing |

## What Makes Us Different

1. **Crash-parlay game loop** -- Aviator's engagement mechanic applied to real-event parlays
2. **Non-extractive fee routing** -- 90/5/5 split enforced by smart contract, zero owner take
3. **Social impact layer** -- 10% of every loss funds gambling harm reduction
4. **Loser-to-LP conversion** -- "Become the house" CTA at the crash moment

No other protocol combines all four.

## Bounty Alignment

| Bounty | Prize | Status |
|--------|-------|--------|
| Track prizes (France/Futurllama/Prosperia) | $6K | Ready |
| Base deployment + OnchainKit | $10K | Deploy ready |
| Kite AI x402 payment verification | $10K | Stub exists |
| ADI Paymaster (gasless UX) | $3K | Integration ready |
| ADI Payments (cosmetic purchases) | $3K | Not started |

**Realistic ceiling: $32K**

## Tech Stack

Solidity 0.8.24 (Foundry) | Next.js 14 | wagmi 2 + viem 2 | Express.js | Base (EVM)

## Team

Built by Roman Pope at ETHDenver 2026.
