---
status: complete
priority: p2
tags: [code-review, crash-game-loop]
---

## Lossy float round-trip when computing odds from PPM probability

**Problem:** PPM probability was converted to a float (divide by 1e6) then inverted back with `1/effectiveProb`, losing precision through the float round-trip. Integer arithmetic should never leave integer domain unnecessarily.

**Fix:** Keep integer PPM throughout. `effectivePPM = outcomeChoice === 2 ? PPM - rawPPM : rawPPM`. Odds computed as `PPM / effectivePPM` (integer division), staying in PPM scale.

**Commit:** 4dacfda
