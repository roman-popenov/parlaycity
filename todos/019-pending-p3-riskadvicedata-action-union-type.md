---
status: pending
priority: p3
issue_id: "019"
tags: [code-review, typescript, frontend, type-safety, pr-12]
dependencies: []
---

# RiskAdviceData.action Should Be Union Type

## Problem Statement

`RiskAdviceData.action` is typed as `string` but the render logic checks for specific values (`"BUY"`, `"REDUCE_STAKE"`, and an implied `"SKIP"`). A union type would catch typos and make the exhaustive check explicit.

## Findings

- TypeScript reviewer: Finding #7, LOW severity
- File: `apps/web/src/components/ParlayBuilder.tsx:34, 511`

## Proposed Solution

```typescript
interface RiskAdviceData {
  action: "BUY" | "REDUCE_STAKE" | "SKIP";
  // ...
}
```

**Effort:** Small
**Risk:** None
