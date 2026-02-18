# Crash-Parlay Cashout Spec

**Status: NOT YET IMPLEMENTED.** This is the core game mechanic differentiating ParlayCity from all competitors.

## Cashout Pricing

```
V_fair    = potentialPayout * P_remaining
V_cashout = V_fair * (1 - cashoutFeeBps - riskSpreadBps)
```

Where `P_remaining` = product of implied probabilities for unresolved legs.

If a leg loses -> value goes to 0 -> plane crashes.

## Cashout Flow

1. User calls `cashoutTicket(ticketId, minOut)` (slippage protection)
2. Engine validates: ticket is ACTIVE, caller is owner, at least one leg unresolved
3. Compute `V_cashout` from current leg states and remaining probabilities
4. Require `V_cashout >= minOut` (slippage check)
5. Vault pays `V_cashout` to user
6. Ticket marked as CASHED_OUT (burned or status update)
7. Reserved liability for that ticket is released
8. `V_cashout` must never exceed reserved liability (invariant)

## Constraints

- Cashout is only available while at least one leg is unresolved
- If all legs resolved (won or lost), settlement path applies instead
- `V_cashout <= potentialPayout` always (can never pay more than reserved)
- Oracle staleness: if probability data is stale, cashout should revert or use conservative pricing
- Reentrancy: cashout modifies state and transfers tokens -- must follow checks-effects-interactions

## Dual Execution Lanes (stretch)

- **Instant AMM:** Small bets (stake < rfqThreshold), filled immediately against vault
- **RFQ/batch:** Large bets, signed quotes from market makers, settled in batch window

The AMM lane uses vault pricing directly. The RFQ lane allows market makers to provide tighter spreads on large tickets, reducing price impact for sophisticated users.

## Frontend Integration

The `MultiplierClimb` component already exists but the cashout game loop does not. The crash UX needs:
- Real-time multiplier display that updates as legs resolve
- "Cash Out Now" button with current value
- Visual "crash" animation when a leg loses
- Sound effects (optional, user-controlled)
