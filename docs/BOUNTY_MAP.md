# ETHDenver 2026 Bounty Targets

## Bounty Table

| Bounty | Prize | Requirements | Our Position | Confidence | Work Needed |
|--------|-------|-------------|--------------|------------|-------------|
| New France Village | $2K | On-chain prediction + vault | Already qualifies | HIGH | Polish narrative |
| Futurllama | $2K | Novel mechanic + agent quoting | Crash-parlay + /quote API | HIGH | Polish narrative |
| Prosperia | $2K | Non-extractive, no owner sweep, social impact | 90/5/5 fee + rehab layer | HIGH | Ship FeeRouter |
| Base | $10K | Base Sepolia deployment, Base-native UX, OnchainKit | Deploy script ready | HIGH | Deploy + OnchainKit |
| Kite AI x402 | $10K | Real x402 payment verification, agent-consumable API | Stub exists | HIGH | @x402/express integration |
| ADI Paymaster | $3K | Gasless UX via Base Paymaster (0xf5d2...0430) | Not started | MED | ERC-4337 integration |
| ADI Payments | $3K | In-app cosmetic purchases (ticket skins, profile) | Not started | MED | Ticket skins / profile items |
| ADI Open Project | $19K | Open-ended DeFi innovation on Base | Strong candidate | LOW | Application + narrative |
| 0g Labs DeFAI | $7K | Risk explainer agent using 0g inference | Not started | LOW | Agent integration |

**Realistic ceiling: $32K** (all HIGH + ADI Paymaster)
**Max theoretical: $58K** (all bounties)

## NOT Targeting

- **Hedera** ($25K) -- requires Daml/HTS, out of scope for Solidity stack
- **Canton** ($15K) -- requires Daml
- **QuickNode** ($2K) -- Monad/Hyperliquid specific

## Priority Order

1. **Track prizes ($6K)** -- already qualifying, polish narrative for each track
2. **Base deployment ($10K)** -- deploy script works on Anvil, need Base Sepolia + OnchainKit
3. **Kite AI x402 ($10K)** -- stub middleware exists, need @x402/express real verification
4. **ADI Paymaster ($3K)** -- Base Paymaster available on Sepolia, needs wagmi integration
5. **ADI Payments ($3K)** -- cosmetic purchase system, independent workstream
6. **ADI Open Project ($19K)** -- high prize but low confidence, needs strong application
7. **0g Labs DeFAI ($7K)** -- stretch goal, risk explainer agent

## Bounty Deep Dives

### Kite AI x402 ($10K)
**What they want:** Agent-native payment protocol. Endpoints that accept x402 payment headers with real on-chain USDC verification on Base.

**What we have:** `packages/services/src/premium/x402.ts` -- stub middleware that checks for non-empty `X-402-Payment` header. Returns proper 402 responses with `"accepts": "USDC on Base"`.

**What we need:** Install `@x402/express` package. Replace stub with real payment verification middleware. Configure USDC payment amount, recipient address, and Base network. The premium analytics endpoint (`POST /premium/sim`) is the natural x402-gated endpoint.

### ADI Paymaster ($3K)
**What they want:** Gasless user experience using Base Paymaster for sponsored transactions.

**What we have:** Full wagmi 2 + viem 2 setup with ConnectKit. All write hooks follow `isPending -> isConfirming -> isSuccess` pattern.

**What we need:** Configure Base Paymaster at `0xf5d253B62543C6Ef526309D497f619CeF95aD430` in wagmi config. Wrap write operations to use paymaster for gas sponsorship. Test on Base Sepolia.

### Base ($10K)
**What they want:** Projects deployed on Base Sepolia with Base-native UX and OnchainKit integration.

**What we have:** Deploy script (`script/Deploy.s.sol`) works on local Anvil. wagmi config supports `baseSepolia` chain. Frontend auto-syncs contract addresses from deploy output.

**What we need:** Add `deploy-sepolia` Makefile target with Base Sepolia RPC. Deploy and verify contracts. Add OnchainKit components (identity, wallet, potentially swap). Verify frontend connects to Sepolia deployment.

### 0g Labs DeFAI ($7K)
**What they want:** DeFi AI agent using 0g inference infrastructure.

**What we have:** Agent-consumable `/quote` API. Math library that can compute risk metrics (Kelly criterion, EV, win probability).

**What we need:** Build a risk explainer agent that uses 0g inference to analyze parlay bets, explain risk/reward, suggest optimal position sizes. Could integrate with premium `/sim` endpoint.
