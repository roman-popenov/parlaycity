---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, simplicity, frontend, pr-12]
dependencies: []
---

# Simplify restoreSelections to Use find Instead of Map

## Problem Statement

`restoreSelections` creates a `Map` from `MOCK_LEGS` (3 items) to look up legs by ID. With N=3, `Array.find` is simpler and equally performant.

## Findings

- Code simplicity reviewer: Finding #4 (3 LOC saved)
- File: `apps/web/src/components/ParlayBuilder.tsx:56-65`

## Proposed Solution

```typescript
function restoreSelections(stored: StoredSelection[]): SelectedLeg[] {
  return stored
    .map((s) => ({
      leg: MOCK_LEGS.find((l) => l.id.toString() === s.legId),
      outcomeChoice: s.outcomeChoice,
    }))
    .filter((s): s is SelectedLeg =>
      s.leg !== undefined && (s.outcomeChoice === 1 || s.outcomeChoice === 2)
    );
}
```

**Effort:** Small
**Risk:** None
