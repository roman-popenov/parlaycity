---
status: complete
priority: p3
issue_id: "035"
tags: [code-review, naming, pr20]
dependencies: []
---

# resolvedUpTo semantics mismatch in MultiplierClimb

## Problem Statement

resolvedUpTo counts won legs, not "legs resolved up to index N." If legs 0 and 2 are won but leg 1 is pending, resolvedUpTo=2 marks legs 0 and 1 as resolved even though leg 1 is pending. Rename to wonLegCount or pass per-leg boolean array.

## Acceptance Criteria

- [x] Prop name matches its semantics -- MultiplierClimb uses `legMultipliers` (array of per-leg multipliers) which accurately represents what it displays. No `resolvedUpTo` prop exists in the component. No change needed.
