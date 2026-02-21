# Kite AI x402 Bounty Submission

**Bounty:** Agent-Native Payments & Identity on Kite AI (x402-Powered) -- $10,000

**Project:** ParlayCity -- Crash-Parlay AMM with agent-native x402 payment API

## What is ParlayCity?

ParlayCity is the first Crash-Parlay AMM on Base. Users buy parlay tickets (2-5 legs), watch a multiplier climb as each leg resolves, and choose whether to cash out early or ride to full payout. The "crash" mechanic (inspired by Aviator) makes parlays a live, interactive instrument rather than a static bet.

What makes ParlayCity relevant to Kite AI: the entire risk analysis layer is designed for **autonomous AI agents**, not humans. Agents discover markets, pay for premium analysis via x402, and make autonomous buy/skip decisions based on Kelly criterion sizing -- all without human intervention.

## Why x402?

The x402 payment protocol enables frictionless machine-to-machine payments over HTTP. For ParlayCity, this means:

1. **Zero onboarding**: An agent calls our API, gets a 402 response with payment instructions, signs a gasless USDC transfer on Base, and retries -- all in one automated flow.
2. **Per-call pricing**: Each risk assessment costs $0.01 USDC. No subscriptions, no API keys, no accounts.
3. **Base-native**: Settlement happens on Base via the Coinbase facilitator. Same chain as our contracts.

This is the exact use case x402 was built for: autonomous agents paying for valuable data (risk analysis) without human orchestration.

## Architecture

```
Agent Loop (autonomous):
  1. GET /markets              --> discover available legs (free)
  2. GET /markets/categories   --> filter by category (free)
  3. POST /premium/agent-quote --> x402-gated combined quote + risk analysis
     |
     +-- First call: HTTP 402 (payment required)
     |   Response includes: price, network (Base), facilitator URL, asset (USDC)
     |
     +-- Agent signs gasless USDC transfer via x402 facilitator
     |
     +-- Retry with X-402-Payment header: HTTP 200
         Response: { quote, risk, aiInsight? }
  4. Agent evaluates: Kelly fraction, EV, correlation warnings
  5. Decision: BUY (place on-chain bet) or SKIP
  6. Repeat with new legs
```

### x402 Middleware

```
packages/services/src/premium/x402.ts
```

- Uses `@x402/express` with `ExactEvmScheme` for real on-chain verification
- Coinbase facilitator handles gas and settlement
- Production mode verifies actual USDC payment on Base
- Dev/test mode uses stub for local development
- Configurable via env vars: `X402_RECIPIENT_WALLET`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `X402_PRICE`

### x402-Gated Endpoints

| Endpoint | Purpose | Agent Use Case |
|----------|---------|----------------|
| `POST /premium/agent-quote` | Combined quote + risk in one call | Primary agent endpoint -- single x402 payment for full analysis |
| `POST /premium/sim` | Analytical simulation (win prob, EV, Kelly) | Standalone risk compute |
| `POST /premium/risk-assess` | Risk advisor with correlation detection | Detailed risk breakdown |

### Agent-Quote Response Shape

```json
{
  "quote": {
    "legIds": [12, 45, 78],
    "multiplierX1e6": "8234000",
    "potentialPayout": "82340000",
    "feePaid": "150000",
    "edgeBps": 1847,
    "valid": true
  },
  "risk": {
    "action": "BUY",
    "suggestedStake": "10000000",
    "kellyFraction": 0.034,
    "winProbability": 0.121,
    "expectedValue": 2.34,
    "confidence": 0.7,
    "reasoning": "Positive expected value with moderate Kelly sizing",
    "warnings": [],
    "riskTolerance": "moderate",
    "fairMultiplier": 8.26,
    "netMultiplier": 8.23,
    "edgeBps": 1847
  },
  "aiInsight": {
    "analysis": "The parlay combines uncorrelated events with a favorable edge...",
    "model": "deepseek-chat",
    "provider": "0g",
    "verified": true
  }
}
```

The `aiInsight` field is optional and powered by 0G inference (best-effort, 5s timeout). It provides natural language risk explanation alongside the structured data.

## Demo: Agent Autonomy Loop

Run the demo:

```bash
make dev                          # start local stack
npx tsx scripts/agent-demo.ts     # run autonomous agent
```

The agent demo (`scripts/agent-demo.ts`) runs 5 rounds showing:

1. **Market discovery** -- queries `/markets` to find available legs across categories
2. **Leg selection** -- picks 2-3 legs from different categories (reduces correlation)
3. **x402 handshake** -- sends request without payment (gets 402), parses payment instructions, retries with payment header (gets 200)
4. **Risk analysis** -- displays Kelly fraction, expected value, correlation warnings
5. **Autonomous decision** -- places bet or skips based on risk tolerance profile

Sample output (abbreviated):

```
=== ParlayCity Agent Demo (x402 Payment Protocol) ===
Agent wallet: 0x1234...0389
Network: Base Sepolia (84532)
Bankroll: $1000 USDC | Rounds: 5

--- Round 1/5 ---

  [DISCOVER] Found 7 categories, 47 active legs

  [SELECT] Picked 2 legs:
    Leg 3: "ETH > $3,000 on March 1" -> YES (prob: 65.0%) [crypto]
    Leg 8: "Denver Nuggets win vs Lakers" -> YES (prob: 58.0%) [sports]

  [x402] Calling /premium/agent-quote WITHOUT payment...
  [x402] HTTP 402 Payment Required
  [x402] Price: 0.01 USDC on eip155:84532
  [x402] Facilitator: https://x402.org/facilitator

  [x402] Retrying WITH payment header...
  [x402] HTTP 200 OK -- payment accepted

  [QUOTE] Multiplier: 2.65x | Payout: $13.25 | Fee: $0.08 | Edge: 450bps
  [RISK] Action: BUY | Kelly: 3.4% | EV: +$1.23 | Correlation: diversified

  [DECISION] PLACING BET -- EV positive, Kelly sizing within tolerance
```

## What Makes This a Strong x402 Implementation

1. **Real verification**: Production mode uses `@x402/express` with `ExactEvmScheme` -- actual on-chain USDC payment verification via Coinbase facilitator, not mocked.

2. **Agent-first design**: The `/premium/agent-quote` endpoint is purpose-built for agents. It resolves leg probabilities from the catalog (agents don't need to know them), computes quote + risk in a single call, and returns structured data with clear action recommendations.

3. **Full protocol flow**: The demo shows the complete 402 -> payment -> 200 handshake, not a shortcut. Agents discover the payment requirement dynamically from the 402 response.

4. **Economic model**: x402 creates a sustainable revenue stream for the protocol. Premium risk analysis costs $0.01 USDC per call. Agents that make profitable bets earn back their analysis costs many times over.

5. **Multi-category markets**: 7 categories (crypto, sports, politics, tech, entertainment, science, ETHDenver) with 47+ active legs. NBA markets via BallDontLie API refresh every 5 minutes.

6. **Optional AI insight**: 0G inference integration provides natural language risk analysis alongside structured Kelly/EV data.

## Contracts (Base Sepolia)

All contracts are live and verified on Base Sepolia (chain 84532):

- ParlayEngine (ERC721 tickets, multi-mode payouts)
- HouseVault (ERC4626-like, USDC vault, 90/5/5 fee routing)
- LegRegistry (oracle-backed outcomes)
- LockVault (Synthetix-style staking rewards)

## Repository

```
packages/services/src/premium/     # x402 middleware + gated endpoints
packages/services/src/premium/x402.ts        # x402 middleware (ExactEvmScheme)
packages/services/src/premium/routes.ts      # /sim, /risk-assess, /agent-quote
packages/services/src/premium/risk-engine.ts # Kelly criterion, EV, correlation
scripts/agent-demo.ts              # Autonomous agent demo script
packages/contracts/                # Solidity contracts (Base Sepolia)
apps/web/                          # Frontend (Next.js 14)
```

## Running Locally

```bash
git clone <repo>
make setup && make dev
npx tsx scripts/agent-demo.ts
```

For production x402 verification:

```bash
export NODE_ENV=production
export X402_RECIPIENT_WALLET=0x...
export X402_NETWORK=eip155:84532
npx tsx scripts/agent-demo.ts
```
