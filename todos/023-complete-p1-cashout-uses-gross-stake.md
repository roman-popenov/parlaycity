---
status: complete
priority: p1
tags: [code-review, crash-game-loop]
---

## Cashout computation used gross stake instead of effectiveStake

**Problem:** Cashout value was computed using `ticket.stake` (gross), which includes the fee. This overstated the cashout value by the fee amount, giving users more than the contract would actually pay out.

**Fix:** Compute `effectiveStake = onChainTicket.stake - onChainTicket.feePaid` in `ticket/[id]/page.tsx`, matching the contract logic in `ParlayEngine.sol:613`.

**Commit:** 4dacfda
