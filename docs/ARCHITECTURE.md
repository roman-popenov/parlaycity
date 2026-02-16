# ParlayCity Architecture

## Overview

ParlayCity is an onchain parlay betting platform on Base. Users build 2-5 leg parlays, LPs provide house liquidity via a vault, and settlement uses a hybrid model (fast admin resolution for bootstrap, optimistic challenge-based resolution thereafter).

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                  │
│  Parlay Builder │ Ticket View │ Vault │ Settlement │ Admin│
└───────┬──────────────┬──────────────┬───────────────────┘
        │ wagmi/viem   │              │
        ▼              ▼              ▼
┌───────────────┐ ┌──────────┐ ┌──────────────┐
│ ParlayEngine  │ │HouseVault│ │ LegRegistry  │
│   (ERC-721)   │ │ (ERC4626)│ │              │
│               │ │          │ │              │
│ buyTicket()   │◄┤reserve() │ │ getLeg()     │
│ settle()      │ │release() │ │ createLeg()  │
│ claim()       │ │pay()     │ │              │
└───────┬───────┘ └──────────┘ └──────────────┘
        │
        ▼
┌───────────────────────────┐
│    IOracleAdapter         │
├───────────────────────────┤
│ AdminOracleAdapter (FAST) │  ← bootstrap mode
│ OptimisticOracle (OPTIM)  │  ← post-bootstrap
│ UmaOOV3Adapter (stretch)  │  ← future
└───────────────────────────┘

┌─────────────────────────────┐
│     Offchain Services       │
│ Catalog │ Quote │ Hedger    │
│         │       │ x402 Prem │
└─────────────────────────────┘
```

## Contract Architecture

### HouseVault
ERC4626-like vault holding USDC. LPs deposit to earn the house edge. Tracks reserved exposure for active tickets. Pull-based payouts.

### LegRegistry
Admin-managed registry of betting legs (questions). Each leg has a probability, cutoff time, and oracle adapter reference.

### ParlayEngine
Core engine that mints ERC-721 ticket NFTs. Validates parlay construction, computes multipliers/fees via ParlayMath library, manages settlement lifecycle.

### Oracle Adapters
Pluggable settlement via `IOracleAdapter` interface:
- **AdminOracleAdapter**: Owner resolves legs directly (fast demo mode)
- **OptimisticOracleAdapter**: Permissionless propose/challenge with bonds and liveness window
- **UmaOOV3Adapter**: (stretch) Real decentralized oracle

### Hybrid Settlement
`bootstrapEndsAt` timestamp determines mode at ticket purchase time. Before = FAST (admin resolved). After = OPTIMISTIC (challenge-based). Mode is immutable per ticket.

## Offchain Services

All stateless, express-based:
- **Catalog**: Serves seed market data (JSON)
- **Quote**: Computes parlay quotes using shared math library
- **Hedger**: Tracks exposure, simulates hedge actions (stub)
- **Premium**: x402-gated simulation endpoint

## Security Model

See [THREAT_MODEL.md](THREAT_MODEL.md) for full analysis.

Key properties:
- SafeERC20 + ReentrancyGuard on all token interactions
- Pull-based payouts (no push transfers)
- Utilization caps prevent vault insolvency
- Oracle adapter isolation (swap without touching engine)
- Pausable emergency stop on all contracts
