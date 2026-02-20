---
status: complete
priority: p2
tags: [code-review, crash-game-loop]
---

## Three separate leg loops and voided legs not handled for cashout

**Problem:** Leg resolution used three separate loops for isWon/isLost/hasUnresolved. Voided legs (result === 3) were not accounted for in cashout eligibility, which could incorrectly treat voided legs as won.

**Fix:** Single-pass leg processing. Voided legs count as unresolved for cashout purposes (matching `ParlayEngine.sol:554-557`), not as won. This aligns frontend eligibility logic with the contract's treatment of voided legs.

**Commit:** 4dacfda
