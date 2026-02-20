---
status: complete
priority: p1
tags: [code-review, crash-game-loop]
---

## Cashout called with zero slippage protection

**Problem:** `cashoutEarly(ticket.id, 0n)` passed zero as the minimum output, providing no slippage protection and allowing frontrunning (e.g., oracle manipulation between TX submission and execution).

**Fix:** Set `minOut = cashoutValue * 98n / 100n` (2% slippage tolerance) in `TicketCard.tsx` before calling `cashoutEarly`.

**Commit:** 4dacfda
