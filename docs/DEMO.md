# ParlayCity Demo Script

## Setup (30 seconds)

1. Open the app at `http://localhost:3000`
2. Connect wallet (MetaMask or Coinbase Wallet)
3. Ensure you're on Base Sepolia (or Anvil for local)

## Flow 1: LP Deposits (1 minute)

1. Navigate to **/vault**
2. Mint test USDC (button in UI, or `cast send` on local)
3. Approve USDC for vault
4. Deposit 1000 USDC
5. See: TVL updates, shares received, utilization at 0%

**Narrative**: "You're now the house. Your USDC earns the house edge on every parlay."

## Flow 2: Buy a Parlay (2 minutes)

1. Navigate to **/** (Parlay Builder)
2. Browse **category tabs**: All, Crypto, Sports, NBA, ETHDenver, Culture, Tech, DeFi, Meme
3. Mix legs from different categories for a cross-category parlay:
   - Crypto: "ETH above $3000" (60% prob)
   - ETHDenver: "Vitalik at ETHDenver" (35% prob)
   - NBA: "Lakers beat Celtics?" (live from BallDontLie API)
4. Watch the multiplier climb animation as legs are added
5. Enter stake: 10 USDC
6. See quote: ~10.6x multiplier, ~$95 potential payout, fee breakdown
7. Click "Buy Ticket" → approve → confirm
8. See ticket NFT minted, vault utilization increases

**Narrative**: "Mix crypto, sports, and culture bets in one parlay. Each leg you add raises the multiplier -- and the risk. Like a plane climbing higher."

## Flow 3: Settlement (1 minute)

### FAST mode (admin resolves):
1. Admin navigates to **/admin**
2. Resolves each leg (Won/Lost)
3. Ticket auto-settles

### OPTIMISTIC mode:
1. Anyone proposes outcome (posts bond)
2. 30-min challenge window
3. If no challenge → finalize
4. If challenged → arbiter decides, loser slashed

## Flow 4: Claim Payout (30 seconds)

1. Navigate to **/ticket/[id]**
2. See ticket status: Won
3. Click "Claim Payout"
4. USDC transferred from vault to winner

## Flow 5: "Rehab Mode" (30 seconds)

1. After a losing ticket, see CTA: "Tough break. Become the house instead."
2. One-click redirect to vault deposit
3. LP earns edge on future parlays

## Flow 6: Autonomous Agents (1 minute)

1. Show the Market Discovery Agent: `ONCE=true make market-agent-sepolia`
2. Agent discovers NBA games from BallDontLie API, registers them as bettable legs on LegRegistry
3. Agent resolves completed games (moneyline + over/under) via AdminOracleAdapter
4. Show the Settler Bot: `make settler-sepolia`
5. Settler picks up resolved tickets and calls permissionless `settleTicket()`

**Narrative**: "Agents handle the plumbing. They discover real-world events, bring them on-chain, and resolve outcomes. Humans make all betting decisions. The agents earn keeper fees and keep the protocol running autonomously."

## Key Talking Points

- **Fully onchain**: tickets are NFTs, payouts are pull-based, math is transparent
- **Multi-category markets**: crypto, sports, NBA (live data), ETHDenver, culture, tech, DeFi, memes -- all in one builder
- **Live NBA data**: real games from BallDontLie API with team-stats-based probability estimation
- **Agents serve humans**: Market Discovery Agent brings real events on-chain; Settler Bot handles settlement. Humans bet. No autonomous gambling.
- **Hybrid settlement**: starts centralized for speed, upgrades to optimistic for trust
- **House vault**: LPs earn the edge -- not a zero-sum PvP game
- **Base-native**: fast confirmations, low gas, smart wallet ready
- **Composable**: oracle adapters are pluggable, hedge pipeline exists (stubbed)
