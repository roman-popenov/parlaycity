# Judges Questions -- ParlayVoo at ETHDenver 2026

Comprehensive answers to anticipated judge questions about architecture, payment flows, bounty positions, and technical decisions.

## Quick Summary

ParlayVoo is a Crash-Parlay AMM on Base. Users buy parlay tickets (2-5 legs), watch a multiplier climb as each leg resolves, and choose whether to cash out early or ride to full payout. The "crash" mechanic (inspired by Aviator) makes parlays a live, interactive instrument.

**Live demo:** https://hackathon-kappa-one.vercel.app
**Contracts:** Base Sepolia (chain 84532), all verified on Basescan
**Repo:** https://github.com/roman-popenov/parlaycity

---

## Bounty Targets & How We Qualify

### 1. Kite AI x402 -- $10K

**What they want:** Agent-native payments using x402 protocol. Real on-chain payment verification, not mocked.

**What we built:**
- Three x402-gated premium API endpoints (`/premium/sim`, `/premium/risk-assess`, `/premium/agent-quote`)
- Real payment verification using `@x402/express` + `ExactEvmScheme` in production mode
- Coinbase facilitator handles USDC settlement on Base
- Agent demo script showing full 402 -> payment -> 200 handshake across 5 rounds

**Payment flow:**
```
Agent -> POST /premium/agent-quote
      -> HTTP 402 (body: { accepts: [{ scheme: "exact", price: "$0.01", network: "eip155:84532", payTo: "0x..." }] })
      -> Agent signs gasless USDC transfer via x402 facilitator on Base
      -> Retry with X-402-Payment header
      -> HTTP 200 (body: { quote, risk, aiInsight? })
```

**Key files:** `packages/services/src/premium/x402.ts`, `scripts/agent-demo.ts`
**Submission doc:** `docs/KITE_AI_BOUNTY.md`

---

### 2. Base Agents -- $10K

**What they want:** Self-sustaining autonomous agents on Base. Agents that operate autonomously and serve humans.

**What we built:**

**Agent 1: Market Discovery Agent** (`scripts/market-agent.ts`)
- Discovers real NBA games from BallDontLie API
- Registers them as bettable legs on LegRegistry (on-chain on Base Sepolia)
- Auto-resolves completed games via AdminOracleAdapter
- 47 legs registered on-chain (21 seed + 26 NBA), all verifiable on Basescan

**Agent 2: Settler Bot** (`scripts/settler-bot.ts`)
- Polls for resolved tickets
- Calls permissionless `settleTicket()` to finalize payouts and release vault reserves
- No access control -- anyone can run a settler

**Agent 3: Risk Agent** (`scripts/risk-agent.ts`)
- Autonomous betting agent powered by 0G AI inference
- Discovers markets, builds candidate parlays, pays for risk assessment via x402
- Makes structured buy/skip decisions using Kelly criterion sizing
- Supports on-chain ticket purchase with configurable payout modes

**How agents serve humans:**
- Market Agent brings real-world events on-chain so humans can bet on them
- Settler Bot keeps the protocol healthy by releasing vault reserves
- Risk Agent demonstrates AI-assisted decision-making for risk evaluation

**Self-sustaining economics:**
1. Market Agent earns keeper fees for resolution (in production: bond rewards via OptimisticOracle)
2. Settler Bot earns tips from protocol fees for settlement
3. Risk API generates micropayment revenue from x402 calls

**Submission doc:** `docs/BASE_AGENTS_BOUNTY.md`

---

### 3. Coinbase MCP -- $10K

**What they want:** MCP server exposing protocol capabilities for AI agent consumption via Model Context Protocol.

**What we built:**
- 6 MCP tools implemented in `apps/web/src/lib/mcp/tools.ts`:

| Tool | Description | Data Source |
|------|-------------|-------------|
| `list_markets` | Browse markets by category (7 categories + live NBA) | API catalog + BDL |
| `get_quote` | Compute parlay quote (multiplier, payout, fees) | Shared math library |
| `assess_risk` | Kelly criterion risk analysis | Risk engine |
| `get_vault_health` | Vault assets, reserves, utilization | On-chain reads (viem) |
| `get_leg_status` | Individual leg resolution status | On-chain reads (viem) |
| `get_protocol_config` | Protocol fees, caps, contract addresses | Config + on-chain |

- **MCP JSON-RPC endpoint** at `/api/mcp` -- implements `tools/list` and `tools/call` per MCP protocol
- **AI Chat UI** -- floating chat panel powered by Vercel AI SDK + Claude, uses the same tool functions
- **Deployed on Vercel** with full tool access to Base Sepolia contracts

**Architecture:** Same tool implementations power both the MCP endpoint (for external AI agents like Claude Desktop) and the AI chat (via Vercel AI SDK `tool()` wrappers). No duplication.

---

### 4. 0G Labs DeFAI -- $7K

**What they want:** DeFi AI agent using 0G inference infrastructure for verifiable AI compute.

**What we built:**
- 0G Compute Network integration in `packages/services/src/premium/0g-inference.ts`
- When `/premium/agent-quote` is called, it optionally invokes 0G inference for natural language risk analysis
- Uses `@0glabs/0g-serving-broker` for broker management
- Model: `qwen-2.5-7b-instruct` (or best available)
- Response includes cryptographic verification via 0G's `processResponse()`

**0G payment flow (separate from x402):**
```
Services API -> 0G Compute Broker
             -> A0GI token payment (on 0G testnet)
             -> Provider inference (qwen-2.5-7b-instruct)
             -> Cryptographic response verification
             -> AI risk narrative returned to agent
```

**The `aiInsight` field in agent-quote responses:**
```json
{
  "aiInsight": {
    "analysis": "This 3-leg parlay has positive EV with low correlation...",
    "model": "qwen-2.5-7b-instruct",
    "provider": "0xProviderAddress",
    "verified": true
  }
}
```

**Key distinction:** The `verified: true` flag means the 0G network cryptographically verified the response came from the claimed provider running the claimed model. This is verifiable AI, not just AI.

---

### 5. Track Prizes -- $6K total

**New France ($2K):** On-chain prediction market + ERC4626 vault with real liquidity management.

**Futurllama ($2K):** Novel crash-parlay mechanic (not just a parlay). The Aviator-style cashout turns static bets into live instruments. Agent-consumable `/quote` API.

**Prosperia ($2K):** Non-extractive fee routing (90% to LPs, 5% to stakers, 5% to protocol). No owner sweep capability. Rehab mode spec channels a portion of losing stakes to responsible gaming.

---

### 6. Uniswap API -- $5K (stretch)

**Status:** Not yet implemented. Would add swap-to-USDC onramp via Uniswap Trading API.

---

### 7. ADI Open Project -- $19K (stretch)

**Position:** Strong narrative candidate. Full crash-parlay AMM with non-extractive fee routing, live cashout, unified vault liquidity, MCP-enabled AI agent interface, x402 agent payments.

---

## Frequently Asked Questions

### "Do you pay for 0G inference via x402?"

**No.** These are two completely separate payment flows on different networks with different tokens:

| | x402 Payment | 0G Inference Payment |
|---|---|---|
| **What it pays for** | API access to premium endpoints | AI compute (inference) |
| **Token** | USDC | A0GI |
| **Network** | Base (Sepolia for testnet) | 0G testnet |
| **Protocol** | x402 (HTTP 402 payment negotiation) | 0G Compute Network (broker/ledger) |
| **Who pays** | The agent calling our API | Our service backend calling 0G |
| **Verification** | Coinbase x402 facilitator verifies on-chain USDC transfer | 0G broker verifies provider signature |

**Flow when both are active:**
```
1. Agent -> POST /premium/agent-quote
2.          -> HTTP 402 "Payment Required" (x402 protocol)
3. Agent -> signs USDC payment via x402 facilitator on Base
4. Agent -> retries with X-402-Payment header
5.          -> Our server validates x402 USDC payment (Base)
6.          -> Our server computes quote + risk (local math)
7.          -> Our server calls 0G inference (pays A0GI tokens on 0G testnet)
8.          -> 0G returns verified AI analysis
9.          -> HTTP 200 { quote, risk, aiInsight }
```

The agent pays USDC via x402 for the API call. Our backend pays A0GI for the AI compute. The agent never directly interacts with 0G. Two independent payment rails serving different purposes.

**Why two payment systems?**
- x402 is for **API monetization** -- agents pay per-call for premium risk analysis
- 0G is for **verifiable AI compute** -- we pay for provably correct inference from a specific model
- Together they demonstrate composable agent economics: the agent's x402 payment covers both the risk computation and the AI insight, with our service abstracting the 0G complexity

### "Is the x402 verification real or mocked?"

**Real in production.** `packages/services/src/premium/x402.ts` uses `@x402/express` with `ExactEvmScheme` + `HTTPFacilitatorClient` pointing to the Coinbase facilitator. In production (`NODE_ENV=production`), every payment header is verified on-chain.

In dev/test (`NODE_ENV !== production` or `X402_STUB=true`), a stub middleware accepts any non-empty `X-402-Payment` header. This makes local development frictionless while production remains secure.

### "Are the NBA markets real?"

**Yes.** BallDontLie API provides real NBA game data. Our Market Discovery Agent:
1. Fetches upcoming games from BDL (next 7 days)
2. Pulls team season averages (points scored, points allowed)
3. Estimates moneyline probabilities using logistic regression on point differentials
4. Estimates over/under lines from team scoring averages
5. Registers these as bettable legs on LegRegistry (on-chain, Base Sepolia)
6. When games finish, fetches results and resolves legs on-chain

47 legs currently registered on LegRegistry at `0x2244...3bc`. Verifiable via `cast call` or Basescan.

### "How does the crash mechanic work?"

The "crash" is our differentiator. Standard parlays are binary (win all or lose all). Our crash-parlay works like Aviator:

1. **Buy ticket** with 2-5 legs and a stake
2. **Multiplier climbs** as each leg resolves favorably (e.g., 2.5x after leg 1, 4.8x after leg 2)
3. **At any point**, the user can **cash out early** at the current multiplier (with a penalty for unrealized risk)
4. If a leg **crashes** (resolves unfavorably), the multiplier drops to zero
5. If **all legs hit**, full payout at the final multiplier

Three payout modes:
- **Classic** -- all-or-nothing, no early cashout
- **Progressive** -- partial payouts as each leg resolves
- **Early Cashout** -- user can exit at any time with slippage protection

Math in `ParlayMath.sol` + `packages/shared/src/math.ts` (identical outputs, PPM scale).

### "How is the vault non-extractive?"

Fee routing is hardcoded in `HouseVault.routeFees()`:
- **90%** to LPs (stays in vault, increases share value)
- **5%** to LockVault (Synthetix-style staking rewards for locked LP positions)
- **5%** protocol fee (operational costs)

**No owner drain path.** The owner can manage protocol parameters (fee rates, utilization caps) but has no `withdraw` or `drain` function for user/LP funds. No `selfdestruct`, no proxy upgrades. The 90/5/5 split is enforced on-chain.

### "What's the tech stack?"

| Layer | Technology |
|-------|------------|
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin 5.x |
| Frontend | Next.js 14 (App Router), React 18, Tailwind, wagmi 2, viem 2, ConnectKit |
| AI Chat | Vercel AI SDK + Claude (streaming, tool calling) |
| MCP | Custom JSON-RPC endpoint at `/api/mcp` |
| Services | Express.js, Zod validation, x402 middleware |
| Agents | TypeScript scripts (market-agent, settler-bot, risk-agent) |
| AI Inference | 0G Compute Network (`@0glabs/0g-serving-broker`) |
| Payments | x402 (`@x402/express`, USDC on Base) |
| Data | BallDontLie API (real NBA markets) |
| Deploy | Vercel (frontend), Base Sepolia (contracts) |

### "How do I test the MCP tools?"

```bash
# List available tools
curl -X POST https://hackathon-kappa-one.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call a tool (list markets)
curl -X POST https://hackathon-kappa-one.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_markets","arguments":{}}}'

# Call a tool (get vault health)
curl -X POST https://hackathon-kappa-one.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_vault_health","arguments":{}}}'
```

Or use the AI Chat on the deployed site -- it calls the same tools.

### "What's deployed on-chain?"

| Contract | Address | Purpose |
|----------|---------|---------|
| MockUSDC | `0xBf68...362b` | Mintable test USDC (10k max/call) |
| HouseVault | `0xeF93...a979` | ERC4626-like vault, USDC, 90/5/5 fees |
| ParlayEngine | `0x8463...Dd2` | ERC721 tickets, permissionless settlement |
| LegRegistry | `0x2244...3bc` | 47 legs (21 seed + 26 NBA) |
| LockVault | `0x7545...5435` | Synthetix-style staking rewards |
| AdminOracleAdapter | `0x4d2a...f22` | Bootstrap oracle (demo) |
| OptimisticOracleAdapter | `0xaB07...8d5` | Production oracle (bond-based) |

All verified on [Base Sepolia Basescan](https://sepolia.basescan.org/address/0x1214ACab3De95D9C72354562D223f45e16a80389).

### "What's the difference between ParlayVoo and ParlayCity?"

**ParlayVoo** is the consumer-facing brand name. **ParlayCity** is the protocol's working/internal name used during development. Same project, same team.

---

## Bounty Confidence Matrix

| Bounty | Prize | Confidence | Status | Key Evidence |
|--------|-------|------------|--------|-------------|
| Kite AI x402 | $10K | HIGH | DONE | Real `ExactEvmScheme` verification, agent demo script, 3 gated endpoints |
| Base Agents | $10K | HIGH | DONE | 3 autonomous agents, 47 on-chain legs, permissionless settlement, Base Sepolia |
| Coinbase MCP | $10K | HIGH | DONE | 6 MCP tools, JSON-RPC endpoint, AI chat UI, Vercel deploy |
| 0G Labs DeFAI | $7K | MEDIUM | DONE | 0G broker integration, verified inference, A0GI payment |
| New France | $2K | HIGH | Qualifies | On-chain prediction + ERC4626 vault |
| Futurllama | $2K | HIGH | Qualifies | Crash-parlay mechanic + agent quoting |
| Prosperia | $2K | MEDIUM | Qualifies | 90/5/5 non-extractive fees, no owner sweep |
| Uniswap API | $5K | LOW | Not started | Would need swap-to-USDC integration |
| ADI Open | $19K | LOW | Narrative | Strong project, competitive pool |

**Realistic total: $43K** (x402 + Base + MCP + 0G + track prizes)
**Stretch total: $67K** (add Uniswap + ADI)
