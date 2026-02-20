---
status: complete
priority: p1
tags: [code-review, crash-game-loop]
---

## Divergent cashout-math.ts copy used gross stake and hardcoded penalty

**Problem:** `cashout-math.ts` was a standalone copy of shared/math.ts that used gross stake and a hardcoded penalty constant. After the other fixes, nothing imported it, but its existence invited future misuse.

**Fix:** Deleted `cashout-math.ts`. Cashout is now computed inline in `page.tsx` using integer PPM math that matches `shared/math.ts` and the on-chain implementation.

**Commit:** 4dacfda
