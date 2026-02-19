# EthSkills Reference (Extracted from austintgriffith/ethskills)
# Patterns and corrections relevant to ParlayCity -- Feb 2026

Source: https://github.com/austintgriffith/ethskills (15 skills)
Purpose: Correct LLM blind spots for Ethereum development. LLMs trained on outdated data will hallucinate gas prices, use deprecated patterns, and miss L2-specific details.

---

## LLM Blind Spots -- Hard Facts

### Gas (as of Feb 2026)
| Operation | Mainnet | Base L2 |
|-----------|---------|---------|
| ETH transfer | ~$0.05 | ~$0.002 |
| ERC-20 transfer | ~$0.15 | ~$0.003 |
| Swap (Uniswap) | ~$0.50 | ~$0.003 |
| NFT mint | ~$0.30 | ~$0.003 |
| Contract deploy | ~$2-5 | ~$0.01-0.05 |

Gas price: **0.05-0.3 gwei** (NOT 10-30 gwei as older training data suggests).
ETH price: ~$1,960 (Feb 2026).
Base L2 fees: sub-penny for most operations.

### Token Decimals
| Token | Decimals | 1 token in wei |
|-------|----------|----------------|
| ETH/WETH | 18 | 1e18 |
| USDC | **6** | 1e6 |
| USDT | **6** | 1e6 |
| DAI | 18 | 1e18 |
| WBTC | **8** | 1e8 |

**Critical for ParlayCity:** We use USDC (6 decimals). `parseUnits("100", 6)` not `parseEther("100")`.

### Key Addresses (Base Mainnet -- our chain)
| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aave V3 Pool (Base) | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Uniswap V4 PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` |

### Chain Selection
| Priority | Chain | Why |
|----------|-------|-----|
| Consumer/low fees | **Base** | Sub-penny, Coinbase onramp, x402 native |
| DeFi composability | Arbitrum | Deepest DeFi liquidity on L2 |
| Public goods | Optimism | RetroPGF, grants |
| Max security | Ethereum mainnet | Most validators, most battle-tested |

ParlayCity deploys on Base (correct choice for consumer betting + x402).

---

## Security Checklist (Pre-Deploy)

### Reentrancy
- CEI pattern: Checks -> Effects -> Interactions. Always.
- `ReentrancyGuard` on all functions that transfer tokens or call external contracts.
- Read-only reentrancy: `view` functions can return stale state during reentrant calls. Watch share price calculations mid-deposit.

### Token Safety
- `SafeERC20` on ALL `.transfer()`, `.transferFrom()`, `.approve()` calls. No exceptions.
- USDT doesn't return bool on `transfer` -- raw calls silently fail.
- Check `decimals()` at integration time, never assume 18.
- Fee-on-transfer tokens: received amount < sent amount. Compare balanceBefore/After.

### Vault-Specific (Applies to HouseVault)
- **ERC4626 inflation attack**: first depositor donates tokens to inflate share price. Mitigate with virtual shares (`_decimalsOffset()`) or minimum first deposit.
- Share price manipulation: use TWAP or virtual offset, not spot price.
- `maxDeposit`/`maxWithdraw` must account for utilization caps.

### Oracle Safety
- **Never read price from DEX pool** -- flash loan manipulable in single tx.
- Chainlink: check `updatedAt` staleness, verify `answer > 0`, handle `latestRoundData` reverts.
- Optimistic oracle: must have dispute window, bond requirement, escalation path.

### Access Control
- `onlyOwner` on parameter-changing functions.
- No `selfdestruct` (deprecated since Cancun upgrade).
- No proxy upgrades in MVP (simplicity > upgradeability for hackathon).
- Time-locks on sensitive parameter changes (post-hackathon).
- Two-step ownership transfer (`Ownable2Step`).

### MEV Awareness
- Sandwich attacks on swaps: use `minAmountOut` with tight slippage.
- Front-running: commit-reveal for sensitive state changes.
- For ParlayCity: `buyTicket` already takes `maxStake` parameter, settlement is permissionless.

### Integer Math
- Solidity 0.8+ has overflow protection. Still watch for:
  - Division truncation (multiply before dividing).
  - BPS vs PPM scale mixing (our invariant #6).
  - Precision loss in share calculations.

### Event Emissions
- Emit events for every state change (deposits, withdrawals, settlements, parameter changes).
- Events are the primary API for indexers and frontends.
- Index fields you'll filter by (address, ticketId).

---

## Ethereum Concepts (Mental Models)

### Nothing Is Automatic
Smart contracts are state machines. They sit idle until someone **calls a function and pays gas**. There is no cron, no scheduler, no background process.

For EVERY state transition, answer:
1. **Who pokes it?** (someone must pay gas)
2. **Why would they?** (what's their incentive?)
3. **Is the incentive sufficient?** (covers gas + profit?)

**ParlayCity application:**
- `settleTicket()` is permissionless (invariant #4) -- anyone can call it. Incentive: claim payout.
- `sweepPenaltyShares()` requires owner poke -- this is a design smell. Should be auto-distributed.
- Yield harvesting from AaveYieldAdapter needs a caller. Consider keeper reward.

### The Hyperstructure Test
"Could this run forever with no team behind it?"
- If yes: hyperstructure (Uniswap, ENS)
- If no: service (dies when team stops operating)

ParlayCity goal: protocol should function without admin intervention for core flows (buy, settle, claim, deposit, withdraw). Admin needed only for adding new legs and parameter tuning.

### Incentive Design Patterns
| Pattern | How It Works | ParlayCity Analog |
|---------|-------------|-------------------|
| Liquidation rewards | Caller gets bonus for keeping system solvent | Settlement reward (future) |
| LP fees | Depositors earn from protocol usage | HouseVault deposit -> fee share |
| Yield harvesting | Caller gets % of harvest | Yield adapter keeper reward |
| Arbitrage | Self-interest maintains correctness | Cashout pricing vs market |

---

## Testing Patterns (Foundry)

### Four Layers
1. **Unit**: Test each function, focus on edge cases (zero, max, unauthorized callers, exact boundaries)
2. **Fuzz**: Any test with parameters gets fuzzed. Use `bound()` over `vm.assume()`. Min 1000 runs.
3. **Fork**: Fork mainnet for external protocol integration tests. Pin block number for reproducibility.
4. **Invariant**: Properties that hold across random call sequences. Handler contract guides exploration.

### What NOT to Test
- OpenZeppelin internals (audited)
- Solidity language mechanics
- Simple getters returning constructor values
- Happy-path-only (test the sad paths)

### Test Focus for ParlayCity
- Vault solvency invariant (totalReserved <= totalAssets) -- EXISTS
- Share price never reaches zero
- Fee arithmetic precision (BPS scale)
- Settlement with all outcome combinations
- Cashout pricing bounds (NEEDS BUILDING)
- Early withdrawal penalty math
- Lock tier weight transitions

---

## Frontend UX Rules

### Transaction Button Pattern
Every onchain button MUST:
1. Disable immediately on click
2. Show spinner text ("Approving...", "Staking...")
3. Stay disabled until **onchain confirmation** (not just wallet signature)
4. Show success/error feedback

**Each button gets its own loading state.** Never share `isLoading` across buttons.

### Four-State Flow
Show exactly ONE button at a time:
1. Not connected -> "Connect Wallet" button (not text)
2. Wrong network -> "Switch to Base" button
3. Needs approval -> "Approve USDC" button
4. Ready -> Action button ("Buy Ticket", "Deposit", etc.)

### USD Values Everywhere
Every token amount displayed must include USD equivalent.
Every amount input must show live USD preview.
`"1,000 USDC (~$1,000)"` not just `"1,000 USDC"`.

### Address Display
Always use proper address components with ENS resolution, blockie avatars, copy-to-clipboard, and block explorer links. Never render raw hex.

---

## Standards Relevant to ParlayCity

### x402 (HTTP Payment Protocol)
We already use this for premium/sim endpoint. Key facts:
- Coinbase-led, deployed on Base
- Server returns `402 Payment Required` with payment details
- Client signs EIP-3009 `transferWithAuthorization` (gasless for payer)
- Facilitator settles payment, server verifies, returns 200

### ERC-8004 (Onchain Agent Identity)
- Registry for autonomous agents (deployed Jan 29, 2026)
- Agents register with service tags, metadata URI
- Reputation scoring via `ReputationRegistry`
- Future: ParlayCity agents could register as settlement bots

### EIP-7702 (Smart EOAs)
- Live since Pectra upgrade (May 2025)
- Regular wallets get smart contract features (batching, sponsorship, session keys)
- Replaces need for separate smart contract wallets in many cases
- Relevant for gasless UX via Base Paymaster integration

### EIP-3009 (transferWithAuthorization)
- USDC supports this natively
- Gasless transfers: user signs, relayer submits
- Used by x402 for payment flows
- Could enable gasless ticket purchases

---

## L2 Landscape (Feb 2026)

| Chain | TPS | Tx Cost | DEX Liquidity | Notes |
|-------|-----|---------|---------------|-------|
| **Base** | ~100 | **$0.001-0.01** | Aerodrome dominates | Coinbase onramp, x402 native |
| Arbitrum | ~100 | $0.01-0.10 | GMX, Camelot | Deepest DeFi |
| Optimism | ~100 | $0.01-0.10 | Velodrome | RetroPGF grants |
| Polygon PoS | ~100 | $0.001-0.01 | QuickSwap | Older, less dev activity |
| zkSync Era | ~50 | $0.01-0.05 | SyncSwap | Native account abstraction |

Base is the correct choice for ParlayCity: cheapest fees, Coinbase onramp integration, x402 support, Aerodrome for USDC liquidity.

Recent upgrades:
- **Pectra** (May 2025): EIP-7702 smart EOAs, doubled blob capacity
- **Fusaka** (Dec 2025): PeerDAS, gas limit doubled to 60M
- Coming: **Glamsterdam** (Q2 2026), **Hegota** (Q4 2026, Verkle Trees)

---

## Tools & Infrastructure

### Foundry (our toolchain)
- `forge test -vvv` for verbose test output
- `forge coverage --report summary` for coverage
- `forge snapshot` for gas benchmarks
- `forge script` for deployment
- `cast` for CLI blockchain interaction

### Blockscout MCP
- Free block explorer with MCP integration
- Agents can query contracts, verify code, read events
- https://mcp.blockscout.com/mcp

### Useful CLIs
- `cast call <addr> "function()" --rpc-url <url>` -- read contract state
- `cast send <addr> "function(args)" --private-key <key>` -- write transactions
- `cast estimate <addr> "function(args)"` -- estimate gas
- `cast abi-encode "function(uint256)" 1000` -- encode calldata

### Secret Management
**NEVER commit to git:**
- Private keys
- RPC URLs with API keys
- Any `.env` file

**Always use:**
- `.env.local` (gitignored)
- `process.env.NEXT_PUBLIC_*` for frontend
- Hardware wallet or `cast wallet` for deployment keys

---

## Wallet Patterns

### Agent Key Safety
For autonomous agents (settlement bots, keepers):
- Dedicated hot wallet with minimal funds
- Spending caps via allowance limits
- Monitor and alert on unusual activity
- Never share keys between agents

### EIP-7702 for Gasless UX
1. User signs EIP-7702 authorization
2. Wallet temporarily delegates to smart contract logic
3. Enables: tx batching (approve+buy in one click), gas sponsorship, session keys
4. Persists until user revokes

### Base Paymaster (our target)
- Coinbase-operated paymaster on Base
- Sponsors gas for approved contract interactions
- User pays zero gas, paymaster covers it
- Requires contract to be whitelisted

---

## dApp Architecture Planning

### Onchain vs Offchain Decision
**Put onchain:** ownership, transfers, commitments, composability, censorship resistance
**Keep offchain:** profiles, search, images, frequently-changing logic, anything without value transfer

### ParlayCity Mapping
| Component | Onchain | Offchain |
|-----------|---------|----------|
| Ticket purchase + settlement | HouseVault + ParlayEngine | - |
| Leg outcomes | LegRegistry + Oracles | Services API for catalog |
| LP deposits/withdrawals | HouseVault | - |
| Fee distribution | LockVault + FeeRouter | - |
| Market catalog + quotes | - | Services API |
| Exposure tracking | - | Services API (future: onchain) |
| User profiles | - | Not needed for MVP |

### MVP Contract Count
> "If you need more than 3 contracts for an MVP, you're over-building."

ParlayCity has 4 core contracts (HouseVault, ParlayEngine, LegRegistry, LockVault) + 2 oracle adapters + 1 yield adapter + 1 math library. This is justified by the protocol complexity but worth noting the ethskills guidance.

---

## Indexing & Events

### Event Design
- Emit events for EVERY state change
- Gas: ~375 base + 375 per indexed topic + 8/byte data
- Index fields you'll filter by (addresses, IDs)
- Events are the primary API for frontends and analytics

### Current State Reads
- Direct RPC for balances and live state (what we do now with wagmi polling)
- Multicall3 for batching multiple reads (address: `0xcA11bde05977b3631167028862bE2a173976CA11`)
- WebSocket subscriptions for real-time via viem

### Future Indexing (Post-Hackathon)
- The Graph subgraph for ticket history, settlement outcomes, LP activity
- Dune Analytics for protocol dashboards
- Consider Ponder for TypeScript-first indexing

---

## Pre-Ship QA Checklist

### Ship-Blocking
- [ ] Wallet connection shows a BUTTON, not text
- [ ] Wrong network shows Switch button
- [ ] One button at a time (Connect -> Network -> Approve -> Action)
- [ ] Every onchain button has its own loader + disabled state
- [ ] Transaction buttons stay disabled through block confirmation
- [ ] No SE2/template branding (we use custom Next.js, not SE2)

### Should Fix
- [ ] Contract addresses displayed with proper component
- [ ] USD values next to all USDC amounts
- [ ] OG image is absolute production URL
- [ ] Polling interval appropriate (5s tickets, 10s vault)
- [ ] RPC uses env variable, not hardcoded
- [ ] Mobile responsive
- [ ] No console errors in production

---

## Resources

- **SpeedRun Ethereum:** https://speedrunethereum.com
- **ETH Tech Tree:** https://www.ethtechtree.com
- **SE2 Docs:** https://docs.scaffoldeth.io/
- **Blockscout MCP:** https://mcp.blockscout.com/mcp
- **ERC-8004:** https://www.8004.org
- **x402:** https://www.x402.org
- **EthSkills (all skills):** https://ethskills.com
