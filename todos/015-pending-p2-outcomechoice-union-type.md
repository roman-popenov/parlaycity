---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, typescript, frontend, type-safety, pr-12]
dependencies: []
---

# outcomeChoice Should Be Union Type 1 | 2

## Problem Statement

`outcomeChoice` is typed as `number` in both `SelectedLeg` and `StoredSelection` interfaces, but only values `1` (yes) and `2` (no) are valid. The comment says `// 1 = yes, 2 = no` but TypeScript doesn't enforce it. Using `1 | 2` union type would catch invalid values at compile time instead of relying on runtime validation in `restoreSelections`.

## Findings

- TypeScript reviewer: Finding #3, MEDIUM severity
- File: `apps/web/src/components/ParlayBuilder.tsx:19-21, 27`

## Proposed Solution

```typescript
// Before:
interface SelectedLeg {
  leg: MockLeg;
  outcomeChoice: number; // 1 = yes, 2 = no
}
interface StoredSelection {
  legId: string;
  outcomeChoice: number;
}

// After:
type OutcomeChoice = 1 | 2;
interface SelectedLeg {
  leg: MockLeg;
  outcomeChoice: OutcomeChoice;
}
interface StoredSelection {
  legId: string;
  outcomeChoice: OutcomeChoice;
}
```

**Effort:** Small
**Risk:** None -- `toggleLeg` already only passes literal `1` or `2`

## Acceptance Criteria

- [ ] `outcomeChoice` uses `1 | 2` union type
- [ ] `toggleLeg` handler type-checks cleanly
- [ ] `restoreSelections` validation narrows correctly
- [ ] `make gate` passes
