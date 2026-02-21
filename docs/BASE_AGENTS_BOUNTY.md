# Base Agents Bounty -- Agents Serve Humans

**Bounty:** Base ($10K) -- Self-sustaining autonomous agents
**Network:** Base Sepolia (chain ID 84532)
**Deployer:** `0x1214ACab3De95D9C72354562D223f45e16a80389`

## Overview

ParlayCity ships two autonomous agents that maintain protocol infrastructure on Base Sepolia. **Humans make all betting decisions.** Agents handle the plumbing: discovering real-world events, bringing them on-chain, resolving outcomes, and settling tickets.

- **Market Discovery Agent** -- discovers real NBA games from BallDontLie API, registers them as bettable legs on LegRegistry, and auto-resolves completed games via AdminOracleAdapter.
- **Settler Bot** -- polls for tickets whose legs have all been resolved, then calls the permissionless `settleTicket()` to finalize payouts.

Both agents operate autonomously without human intervention. They interact exclusively through permissionless contract entry points and public APIs.

## Architecture

```mermaid
flowchart TB
    subgraph "External Data"
        BDL[BallDontLie API<br/>Real NBA Games]
    end

    subgraph "Market Discovery Agent"
        MA_D[Phase A: Discovery<br/>Fetch upcoming games]
        MA_R[Phase B: Resolution<br/>Fetch completed games]
    end

    subgraph "Base Sepolia (Chain 84532)"
        LR[LegRegistry<br/>0x2244...3bc]
        OA[AdminOracleAdapter<br/>0x4d2a...f22]
        PE[ParlayEngine<br/>0x8463...Dd2]
        HV[HouseVault<br/>0xeF93...979]
    end

    subgraph "Human Users"
        HU[Browse markets<br/>Buy tickets<br/>Cashout / Claim]
    end

    subgraph "Settler Bot"
        SB[Poll tickets<br/>Check resolution<br/>settleTicket tx]
    end

    subgraph "Services API :3001"
        MK[/markets<br/>Multi-category catalog]
        AQ[/premium/agent-quote<br/>x402-gated + 0G AI]
    end

    subgraph "0G Compute Network"
        ZG[0G Inference<br/>A0GI token payment<br/>Verified AI response]
    end

    BDL --> MA_D
    BDL --> MA_R
    MA_D -->|createLeg| LR
    MA_R -->|x402 payment| AQ
    AQ -->|A0GI tokens| ZG
    MA_R -->|resolve| OA
    OA --> LR
    HU -->|buyTicket| PE
    HU --> MK
    HU -.->|optional x402| AQ
    PE --> HV
    SB -->|settleTicket| PE
    SB -->|canResolve| OA
```

## Agent 1: Market Discovery Agent

**Purpose:** Autonomous market infrastructure. Discovers real NBA games, registers them as bettable legs on-chain, and resolves outcomes when games finish. This is the primary agent for the Base Agents bounty.

**Source:** [`scripts/market-agent.ts`](../scripts/market-agent.ts)

### How it works

Each polling cycle (default 60s) runs two phases:

**Phase A -- Discovery:**
1. Calls `fetchNBAMarkets()` from BallDontLie API (upcoming games, team stats, probability estimates)
2. Reads all on-chain legs from LegRegistry, builds a normalized question lookup map
3. For each NBA leg not already registered: calls `createLeg()` on LegRegistry
4. Skips games starting within 30 minutes (cutoff guard -- tx might land after game starts)
5. Uses explicit nonce management for batched registrations (avoids "nonce too low" on Sepolia)

**Phase B -- Resolution (with x402 + 0G AI):**
1. Calls `fetchCompletedGames(lookbackDays)` from BallDontLie API (games with `status === "Final"`)
2. Reads on-chain legs, builds a `sourceRef -> legId` lookup map
3. **Pays for x402 risk assessment** -- calls `POST /premium/agent-quote` with x402 payment header. If 0G inference is available (`ZG_PRIVATE_KEY`), the response includes verified AI analysis from the 0G compute network (paid with A0GI tokens).
4. For each completed game, resolves its on-chain legs:
   - **Moneyline** (`bdl:game:{id}`): Won if home wins, Lost if away wins, Voided on tie
   - **Over/Under** (`bdl:game:{id}:ou`): Parses line from question text, Won if total exceeds line
5. Checks `getStatus(legId)` before resolving (idempotent -- skips already-resolved legs)
6. Calls `AdminOracleAdapter.resolve(legId, status, outcome)`

### Key Design Choices

- **Real data, not synthetic:** Every market comes from a real NBA game. Probabilities are estimated from team season averages (BDL team stats endpoint), not hardcoded.
- **Idempotent:** Both discovery (question-text matching) and resolution (`getStatus` check) are safe to run repeatedly.
- **Cutoff guard:** Games starting within 30 minutes are skipped to prevent registering legs that would immediately fail the `cutoffTime > block.timestamp` check.
- **Safety guard:** Refuses to use default Anvil keys on remote RPCs (`requireExplicitKeyForRemoteRpc`).
- **Structured logging:** Every action emits JSON with timestamp, cycle number, action type, game/leg IDs, and tx hash.

### Production Path

The current implementation uses `AdminOracleAdapter` as a demo shim -- the agent's wallet has admin rights to resolve legs directly. In production:

1. Resolution would go through `OptimisticOracleAdapter` (already deployed at `0xaB07...8d5`)
2. The agent posts a bond when asserting an outcome
3. Anyone can challenge the assertion during the dispute window
4. If unchallenged, the agent earns its bond back plus a reward
5. This creates economic incentives for honest reporting and a permissionless challenge mechanism

## Agent 2: Settler Bot

**Purpose:** Permissionless settlement keeper. Ensures resolved tickets release vault reserves promptly, maintaining protocol liquidity health.

**Source:** [`scripts/settler-bot.ts`](../scripts/settler-bot.ts)

### How it works

1. Polls `ParlayEngine.ticketCount()` on a configurable interval (default 10s)
2. For each active ticket, reads leg data from `LegRegistry` and checks `OracleAdapter.canResolve()` for every leg
3. When all legs of a ticket are resolvable, calls `settleTicket(ticketId)` -- a fully permissionless function with no access control
4. Logs settlement outcomes (Won/Lost/Voided) with transaction hashes

### Key Design Choices

- **Permissionless entry point:** `settleTicket()` has no `onlyOwner` or role check. Anyone can call it. The protocol WANTS external settlement.
- **Graceful degradation:** Individual ticket settlement failures don't crash the bot.
- **Chain detection:** Auto-detects Base Sepolia vs local Anvil via RPC URL.

## Self-Sustaining Economics

Two real payment flows demonstrated on-chain:

### Payment Flow 1: x402 Protocol (USDC on Base Sepolia)

The Market Discovery Agent pays for risk assessment via x402 before resolving games:

```
Agent -> POST /premium/agent-quote (X-402-Payment header)
       -> 402 response with `accepts` array (scheme, network, price, payTo)
       -> Agent sends payment proof
       -> 200 response with quote + risk + AI insight
```

x402 middleware verifies payment headers using `@x402/express` + `ExactEvmScheme`. In production mode, this verifies real on-chain USDC transfers via the x402 facilitator. Revenue flows to `X402_RECIPIENT_WALLET`.

### Payment Flow 2: 0G Compute Network (A0GI tokens)

When the agent-quote endpoint is called, it optionally invokes 0G inference:

```
Services API -> 0G Compute Broker (A0GI token payment)
             -> Provider inference (qwen-2.5-7b-instruct)
             -> Verified response (cryptographic proof)
             -> AI risk narrative returned to agent
```

The 0G broker manages a token ledger on the 0G testnet. Each inference call costs A0GI tokens, creating real on-chain payment for AI compute.

### Revenue Loops

1. **Market Discovery Agent:** Pays x402 USDC for risk intelligence, earns keeper fees for resolution. In production (OptimisticOracle), earns bond rewards for correct resolution.
2. **Settler Bot:** Earns keeper tips from protocol fees. Releasing vault reserves enables more LP yield and new ticket sales.
3. **x402 Risk API:** Generates micropayment revenue from humans and agents who consume risk analysis.
4. **Composability:** Both agents use only permissionless entry points (`createLeg`, `resolve`, `settleTicket`). Any developer can build additional agents on the same infrastructure.

## Deployed Contracts

All contracts deployed and verified on Base Sepolia:

| Contract | Address | Role |
|----------|---------|------|
| MockUSDC | `0xBf68FAa69faA3b42FFDEA2C033dF795706F6362b` | Mintable test USDC (10k max/call) |
| HouseVault | `0xeF9334cA8C7cb7F081e4A53005020CD2F939A979` | ERC4626 LP vault, 90/5/5 fee routing |
| ParlayEngine | `0x8463CF3D7EE71Be38dDD10f83BA64689033eFDd2` | ERC721 ticket NFTs, permissionless settlement |
| LegRegistry | `0x2244D0f74469BD0ef8C47e7E5f7631E529D4c3bc` | 47+ registered legs across 7+ categories |
| LockVault | `0x75457799813D894078FEbec6Fed6602938635435` | Synthetix-style fee distribution |
| AdminOracleAdapter | `0x4d2a37b47C5950Fa314E2cd6620CD01161B5eF22` | Bootstrap oracle (demo) |
| OptimisticOracleAdapter | `0xaB07986A968B5F8E70ebc5d5ce7f47E117Bbd8d5` | Production oracle (bond-based) |

Full deployment record: [`deployments/base-sepolia.json`](../deployments/base-sepolia.json)

## Live Transaction Evidence

On-chain activity is verifiable on [Base Sepolia Basescan](https://sepolia.basescan.org).

**Agent wallet:** [`0x1214ACab3De95D9C72354562D223f45e16a80389`](https://sepolia.basescan.org/address/0x1214ACab3De95D9C72354562D223f45e16a80389)

### Market Discovery Agent -- NBA Leg Registration (LegRegistry)

47 legs registered on-chain (22 seed + 25 NBA from BallDontLie). Sample NBA registration txs:

| Leg | Game | Tx |
|-----|------|----|
| #22 | PHX @ ORL O/U 220 | [`0xd491ed65...`](https://sepolia.basescan.org/tx/0xd491ed65f9faa973a20260ddeb335331f7a568c932697c2b5a1ab2138504de9a) |
| #23 | NOP @ PHI Moneyline | [`0x7d5654b5...`](https://sepolia.basescan.org/tx/0x7d5654b5ce37bb013c6fe4486c7e6a4a1a1d7f17b70f6b56dd313e4aeedeef2e) |
| #24 | MIA @ MEM Moneyline | [`0xe68a44d9...`](https://sepolia.basescan.org/tx/0xe68a44d937bd8b631a9f27bef8e4936b77c56508791598930f194aadb6b82a37) |
| #35 | LAL @ BOS Moneyline | [`0x652af0f7...`](https://sepolia.basescan.org/tx/0x652af0f79a291274703354c637d12435d719504167f375486f5f44ee91cfae87) |

Full list: 25 NBA `createLeg()` transactions from deployer wallet to LegRegistry.

### Settler Bot -- Autonomous Settlement
| Ticket | Result | Tx |
|--------|--------|----|
| #1 | Won (all legs hit) | [`0x657b1751...`](https://sepolia.basescan.org/tx/0x657b17519592b01eb008cf54e7bede61ef99f8134facc118932e894409d425ad) |
| #2 | Lost (leg crashed) | [`0xe22e08ac...`](https://sepolia.basescan.org/tx/0xe22e08acc2288e3be6eccf80c31d23e94c5dd97258c0775360c42d0b3223b9b9) |

### Oracle Resolutions (AdminOracleAdapter)
| Leg | Status | Tx |
|-----|--------|----|
| 3 | Won | [`0x676ab01e...`](https://sepolia.basescan.org/tx/0x676ab01e888230ed0c44a878932f182167ffa532ec2b822bbd89a8f120933815) |
| 5 | Won | [`0x511e04d1...`](https://sepolia.basescan.org/tx/0x511e04d1c14a0624b2141676f990301bebb408245ec43207b98249797eb09406) |
| 10 | Lost | [`0x2ad6304e...`](https://sepolia.basescan.org/tx/0x2ad6304e92dc07514a5496ff84846e40a9cdf4a03f8d1808b90db8e4ad345107) |

### Market Agent Idempotency Run (2026-02-21)

Single-cycle run on Sepolia confirming agent logic:
- Discovered 25 NBA markets from BallDontLie API
- All 50 legs already registered (idempotent skip -- no duplicate registrations)
- Found 19 completed games, checked resolution status for each
- Structured JSON logs emitted for every action

### How to Verify
- All txs above are from the agent wallet (`0x1214...0389`) interacting with LegRegistry and AdminOracleAdapter on Base Sepolia (chain 84532)
- Market Discovery Agent calls `createLeg()` to register real NBA markets and `resolve()` to finalize outcomes based on BallDontLie game results
- Settler Bot calls `settleTicket()` -- a fully permissionless function with no access control
- Both agents log structured JSON decisions to stdout for audit trails
- On-chain legs verifiable: `cast call 0x2244...3bc "getLeg(uint256)" 23 --rpc-url https://sepolia.base.org` returns NBA game data with `bdl:game:{id}` sourceRef

## How to Run

### Prerequisites
- `.env` with `DEPLOYER_PRIVATE_KEY`, `BDL_API_KEY`, and optionally `BASE_SEPOLIA_RPC_URL`
- Deployer wallet funded with Base Sepolia ETH

### Commands

```bash
# Both agents (background, with logs)
make agents-sepolia

# Individual agents
make market-agent-sepolia   # Market discovery + resolution
make settler-sepolia         # Settlement keeper

# Stop all agents
make agents-stop

# Check logs
tail -f .pids/market-agent.log
tail -f .pids/settler.log

# Single run (discover + resolve, then exit)
ONCE=true make market-agent-sepolia

# Dry run (log without on-chain writes)
DRY_RUN=true make market-agent-sepolia

# Local development (requires Anvil + BDL_API_KEY)
make market-agent
```

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `RPC_URL` | `http://127.0.0.1:8545` | Chain RPC endpoint |
| `PRIVATE_KEY` | Anvil key | Agent wallet private key |
| `BDL_API_KEY` | (required) | BallDontLie API key |
| `LEG_REGISTRY_ADDRESS` | from .env.local | LegRegistry contract |
| `ADMIN_ORACLE_ADDRESS` | from .env.local | AdminOracleAdapter contract |
| `POLL_INTERVAL_MS` | `60000` | Market agent: cycle interval |
| `LOOKBACK_DAYS` | `3` | How far back to check completed games |
| `DRY_RUN` | `false` | Log without on-chain writes |
| `ONCE` | `false` | Single run then exit |
| `SERVICES_URL` | `http://localhost:3001` | Services API for x402 risk assessment |
| `ZG_PRIVATE_KEY` | (optional) | 0G testnet key for AI inference |
| `ZG_AUTO_FUND_LEDGER` | `false` | Auto-deposit A0GI into 0G ledger |
