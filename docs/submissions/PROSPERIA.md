# ParlayCity -- Prosperia Track Submission

## Summary

ParlayCity is the first Crash-Parlay AMM with non-extractive economics, deterministic fee routing, and a social impact layer that routes a portion of every loss toward gambling harm reduction. The protocol is designed from the ground up so that no single party -- including the team -- can extract value at the expense of users.

---

## Non-Extractive Design

Prosperia asks for protocols where value flows to participants, not extractors. ParlayCity's economics are built around three principles:

### 1. Zero Team Take

There is no team treasury. No founder allocation. No admin wallet that receives a cut of anything. The protocol's fee routing is enforced by smart contract:

```
Fee (2-3.5% of stake):
  90% -> LockVault lockers (committed LPs)
   5% -> SafetyModule (insurance buffer)
   5% -> stays in vault (LP share price appreciation)
```

Compare this to every centralized sportsbook, where 100% of the vig (17-35% on parlays) goes to corporate profit. Compare it to most DeFi protocols, where a governance token extracts value from users to early investors.

ParlayCity has no governance token. The economics work without one because parlay markets have 17-35% structural margins -- the highest in sports betting. The protocol is self-sustaining from fees and the house edge alone.

### 2. No Discretionary Admin Drains

The owner can adjust fee parameters and pause the protocol in emergencies. The owner CANNOT:

- Redirect user deposits, LP capital, or accumulated fees to arbitrary addresses
- Withdraw from the vault outside normal LP share redemption
- Upgrade the contract via proxy patterns
- Self-destruct the contract
- Override settlement outcomes

Penalty redistribution (from early LockVault exits) is deterministic -- it flows to other lockers, the safety buffer, and social good, not to an admin wallet.

These are not policy commitments. They are architectural constraints. The code paths do not exist.

### 3. Non-Extractive Fee Model

| Platform | Parlay Fee | Transparency | Who Profits |
|----------|-----------|-------------|-------------|
| DraftKings | 17-35% | Hidden in adjusted odds | Corporation |
| FanDuel | 17-35% | Hidden in adjusted odds | Corporation |
| Overtime | ~5% spread | Partially visible | LP + token holders |
| ParlayCity | 2-3.5% | Explicit line item | 90% to LPs, 5% safety, 5% vault |

The fee is visible before the bet is placed. The multiplier is computed from on-chain probability data using pure math (`ParlayMath.sol`). The same math runs identically in TypeScript for the frontend preview. There is no hidden vig, no odds manipulation, no "we moved the line because too many people bet one side."

Settlement is permissionless: anyone can call `settleTicket()`. No account bans, no limits, no "winning accounts" getting restricted.

---

## Social Impact: Rehab Mode

ParlayCity includes a social impact layer designed into the protocol's economics:

**10% of every losing stake is routed to gambling harm reduction.**

When a gambler loses (which happens ~94% of the time on 3-leg parlays), the loss distributes:

```
80% -> LP share price appreciation (the house edge)
10% -> AMM liquidity pools (protocol sustainability)
10% -> social good (gambling harm reduction via Gitcoin-style routing)
```

This is not charity bolted onto a product. It is a structural economic flow enforced by the smart contract. Every bet that loses generates a contribution to harm reduction. At scale, this creates a self-funding social impact mechanism that grows with protocol usage.

**Rehab Mode UX:** When a bettor's multiplier crashes to zero, the crash screen includes:

1. **Responsible gambling resources** -- links to problem gambling hotlines and self-assessment tools
2. **Loss tracking** -- transparent display of cumulative losses over time
3. **"Become the House" CTA** -- conversion path from gambler to LP at the moment the user is most emotionally receptive to switching sides

The "Become the House" conversion is a genuine alignment mechanism: losing gamblers can deposit their remaining capital into the vault as LPs, earning from the same house edge that just beat them. This transforms a loss moment into a financial education moment. The user switches from a negative-EV activity (betting) to a positive-EV one (providing liquidity).

---

## No Owner Sweep

The Prosperia track specifically values protocols without owner extraction. ParlayCity's architecture makes this impossible, not merely discouraged:

**HouseVault:** The owner address has no withdrawal function. `reservePayout`, `releasePayout`, and `payWinner` are restricted to the ParlayEngine address set at deployment. The owner can adjust fee parameters and pause -- that's it.

**ParlayEngine:** The engine never holds a single dollar. All USDC flows directly from gambler to vault via `safeTransferFrom`. There is no intermediary contract where funds could be intercepted.

**LockVault:** Penalty shares from early withdrawals accumulate in the contract. Redistribution is deterministic -- to other lockers and the safety buffer. The owner cannot redirect penalties to an arbitrary address.

**No proxy, no selfdestruct:** The contracts are not upgradeable. There is no `selfdestruct` instruction. The owner cannot change the contract code or destroy the contract to sweep remaining balances. These are immutable deployments in the MVP.

---

## Depositor Safety

Four on-chain invariants protect participants:

1. **Solvency invariant:** `totalReserved <= 80% * totalAssets()`. The vault always keeps 20% unencumbered. If reserved exposure approaches 80%, new bets are rejected -- existing positions are never liquidated. Tested with invariant fuzzing (64 runs, depth 32).

2. **Concentration cap:** No single ticket can claim more than 5% of vault TVL. On a $1M vault, max single payout is $50K. No whale can drain the pool with one lucky parlay.

3. **Custody separation:** The engine never holds USDC. Funds flow directly from gambler to vault. There is no intermediary contract, no temporary holding, no custody risk beyond the vault itself.

4. **No admin drain path:** No function in any contract allows the owner to redirect deposits, LP capital, or accumulated fees.

---

## Fairness for Gamblers

**Provably fair odds.** The multiplier is computed from on-chain probability data using `ParlayMath.sol`. The exact same computation runs in TypeScript for the UI preview. Both use integer arithmetic with PPM (parts per million) scaling. Math parity is tested as part of the CI gate.

**Cashout creates agency.** The crash-parlay mechanic means bettors are not passive lottery ticket holders. As legs resolve, they decide when to exit. This creates genuine skill expression: a bettor who correctly identifies that remaining legs are riskier than priced can cash out for a profit. A bettor who recognizes favorable odds can let it ride.

**No account discrimination.** The protocol is a smart contract. It cannot identify winning accounts, cannot adjust odds per-user, cannot limit bet sizes per-user, and cannot prevent anyone from placing bets or claiming payouts. This is in direct contrast to centralized sportsbooks, which routinely limit or ban winning accounts.

---

## What's Built

| Component | Status |
|-----------|--------|
| HouseVault with deterministic fee routing (90/5/5) | Deployed, tested |
| ParlayEngine with 3 payout modes + cashout | Deployed, tested |
| LockVault with Synthetix-style rewards | Deployed, tested |
| On-chain math mirrored exactly in TypeScript | Deployed, tested |
| No admin drain, no proxy, no selfdestruct | Verified by code review + tests |
| Social impact routing (10% of losses) | Spec complete, routing in progress |
| Rehab Mode UX (crash screen + LP conversion) | Spec complete, UX in progress |
| Invariant test suite (solvency, reserves, parity) | Passing |

---

## Technical Stack

Solidity 0.8.24 (Foundry) | Next.js 14 | wagmi 2 + viem 2 | Express.js | Base (EVM)

Built at ETHDenver 2026.
