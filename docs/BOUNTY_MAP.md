# ETHDenver 2026 Bounty Targets

## Corrected Bounty Strategy

| Our Previous Doc Says | Actual Bounty | Action |
|---|---|---|
| "Base ($10K) -- deploy + OnchainKit" | "Base Self-Sustaining **Autonomous Agents**" | Reframe: market discovery agent + settler bot |
| "ADI Paymaster ($3K) -- gasless UX" | "ERC-4337 Paymaster **Devtools**" | **DROP** -- wants devtools, not app |
| "ADI Payments ($3K) -- cosmetics" | "Payments for **Merchants**" | **DROP** -- merchant-focused |
| Missing | Uniswap Foundation ($5K) -- integrate API | **ADD** -- swap-to-USDC onramp |
| Missing | 0g Labs DeFAI ($7K) | **ADD** -- risk advisor fits |

## Bounty Table

| # | Bounty | Prize | Requirements | Our Position | Confidence | Hours | Owner |
|---|--------|-------|-------------|--------------|------------|-------|-------|
| 1 | Kite AI x402 | $10K | Real x402 payment, agent-consumable API | READY: x402 verification + agent-quote + demo script + submission docs | HIGH | DONE | docs/KITE_AI_BOUNTY.md |
| 2 | Track: New France | $2K | On-chain prediction + vault | Already qualifies | HIGH | 1h | Narrative |
| 3 | Track: Futurllama | $2K | Novel mechanic + agent quoting | Crash-parlay + /quote API | HIGH | 1h | Narrative |
| 4 | Track: Prosperia | $2K | Non-extractive, no owner sweep, social impact | 90/5/5 fee + rehab spec | MEDIUM | 1h | Narrative |
| 5 | Uniswap API | $5K | Integrate Uniswap Trading API | Not started | MEDIUM | 6-8h | Swap-to-USDC |
| 6 | Base Agents | $10K | Self-sustaining autonomous agents on Base | READY: market discovery agent + settler bot + MCP tools + Sepolia deploy + docs | HIGH | DONE | docs/BASE_AGENTS_BOUNTY.md |
| 7 | Coinbase MCP | $10K | MCP server exposing protocol tools for AI agents | READY: 6 MCP tools (list_markets, get_quote, assess_risk, get_vault_health, get_leg_status, get_protocol_config) + JSON-RPC endpoint + AI chat UI | HIGH | DONE | /api/mcp |
| 8 | ADI Open Project | $19K | Open-ended DeFi innovation on Base | Strong candidate | LOW | 2h | Narrative |
| 9 | 0g Labs DeFAI | $7K | DeFi AI agent using 0g inference | Risk advisor fits | LOW-MED | 4-8h | Stretch |

**Realistic: $41K** (1-7) | **Stretch: $67K** (add 8-9)

## NOT Targeting

- **Hedera** ($25K) -- requires Daml/HTS, out of scope for Solidity stack
- **Canton** ($15K) -- requires Daml
- **QuickNode** ($2K) -- Monad/Hyperliquid specific
- **ADI Paymaster** ($3K) -- wants devtools, not app integration (misread)
- **ADI Payments** ($3K) -- wants merchant payment infra, not cosmetic purchases (misread)

## Priority Order

1. **Kite AI x402 ($10K)** -- DONE, real verification + agent demo + docs
2. **Base Agents ($10K)** -- DONE, market discovery agent + settler bot + Sepolia deploy
3. **Coinbase MCP ($10K)** -- DONE, 6 MCP tools + JSON-RPC endpoint + AI chat UI + Vercel deploy
4. **Track prizes ($6K)** -- already qualifying, polish narratives
5. **Uniswap API ($5K)** -- swap-to-USDC onramp, needs API key
6. **ADI Open Project ($19K)** -- high prize but low confidence, needs strong application
7. **0g Labs DeFAI ($7K)** -- stretch goal, wrap risk advisor with 0g inference

## Bounty Deep Dives

### Kite AI x402 ($10K)
**What they want:** Agent-native payment protocol. Endpoints that accept x402 payment headers with real on-chain USDC verification on Base.

**What we have:** `packages/services/src/premium/x402.ts` -- real x402 verification using `@x402/express` `paymentMiddleware` with `ExactEvmScheme`. Production mode verifies USDC payments on Base via facilitator. Dev/test mode falls back to stub. Configurable via env vars (`X402_RECIPIENT_WALLET`, `X402_NETWORK`, `X402_FACILITATOR_URL`, `X402_PRICE`). Two x402-gated endpoints: `/premium/sim` and `/premium/risk-assess`.

**What we built:** Agent demo script (`scripts/agent-demo.ts`) showing autonomous market discovery -> x402 payment -> risk assessment -> buy/skip decision loop. Submission docs at `docs/KITE_AI_BOUNTY.md`. Full x402 handshake (402 -> payment -> 200) demonstrated across 5 rounds with 3 different risk tolerance profiles.

### Base Agents ($10K)
**What they want:** Self-sustaining autonomous agents on Base. Not just "deploy on Base" -- they want agents that can operate autonomously.

**What we have:** Two production-ready autonomous agents deployed on Base Sepolia:
1. **Market Discovery Agent** -- discovers real NBA games from BallDontLie API, registers them as bettable legs on-chain, and auto-resolves completed games. Agents serve humans: brings real-world events on-chain so humans can bet on them.
2. **Settler Bot** -- permissionless settlement keeper, polls for resolved tickets, calls `settleTicket()`. Keeps protocol healthy by releasing vault reserves.

**How to run:** `make agents-sepolia` (both agents) or `make market-agent-sepolia` / `make settler-sepolia` individually. Full narrative at `docs/BASE_AGENTS_BOUNTY.md`.

### Uniswap API ($5K)
**What they want:** Projects integrating the Uniswap Trading API or Universal Router.

**What we have:** USDC-denominated vault and betting system. Users need USDC to participate.

**What we need:** `GET /swap/quote` service endpoint proxying to Uniswap API. `SwapToUSDC.tsx` component on ParlayBuilder and VaultDashboard. Permit2 signing. API key application.

### Coinbase MCP ($10K)
**What they want:** MCP server exposing protocol capabilities for AI agent consumption.

**What we have:** Full MCP implementation:
1. **6 MCP tools** in `apps/web/src/lib/mcp/tools.ts`: `list_markets`, `get_quote`, `assess_risk`, `get_vault_health`, `get_leg_status`, `get_protocol_config`
2. **JSON-RPC endpoint** at `/api/mcp` implementing `tools/list` and `tools/call` methods per MCP protocol
3. **AI Chat UI** with Vercel AI SDK + Claude -- floating chat panel on all pages, tool calls rendered inline
4. **Vercel deployment** at production URL with all env vars configured

**Architecture:** Same tool implementations power both the MCP endpoint (for external AI agents like Claude Desktop) and the AI chat (via AI SDK `tool()` wrappers). No duplication.

### 0g Labs DeFAI ($7K)
**What they want:** DeFi AI agent using 0g inference infrastructure.

**What we have:** Agent-consumable risk advisor API (Kelly criterion, EV, confidence, warnings). Math library for risk computation.

**What we need:** Wrap risk advisor to use 0g inference endpoint for natural language risk explanation. If 0g SDK is lightweight, this could be a simple adapter.

### ADI Open Project ($19K)
**What they want:** Open-ended DeFi innovation on Base.

**What we have:** Full crash-parlay AMM with non-extractive fee routing, live cashout, unified vault liquidity, MCP-enabled AI agent interface. Strong narrative.

**What we need:** Polish submission narrative. Emphasize innovation (crash-parlay mechanic + x402 agent-native + MCP tools + rehab mode).
