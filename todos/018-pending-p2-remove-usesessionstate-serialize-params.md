---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, simplicity, frontend, yagni, pr-12]
dependencies: []
---

# Remove Unused serialize/deserialize Params From useSessionState

## Problem Statement

`useSessionState` accepts `serialize` and `deserialize` function parameters with defaults of `JSON.stringify` and `JSON.parse`. No caller ever passes custom serializers. This is a YAGNI violation that adds unnecessary API surface, complicates the dependency array (with eslint-disable comments), and creates a potential infinite re-render trap if a caller passes an inline arrow function as `serialize`.

## Findings

- Code simplicity reviewer: Finding #1, YAGNI violation (4 LOC)
- TypeScript reviewer: Finding #2, potential infinite re-render with custom serializer
- File: `apps/web/src/lib/utils.ts:70-103`

## Proposed Solution

```typescript
// Before:
export function useSessionState<T>(
  key: string,
  defaultValue: T,
  serialize: (v: T) => string = JSON.stringify,
  deserialize: (s: string) => T = JSON.parse,
): [T, (v: T | ((prev: T) => T)) => void] {

// After:
export function useSessionState<T>(
  key: string,
  defaultValue: T,
): [T, (v: T | ((prev: T) => T)) => void] {
```

Hardcode `JSON.stringify` / `JSON.parse` inline. Removes the two function parameters and simplifies deps arrays.

**Effort:** Small (4 LOC)
**Risk:** None

## Acceptance Criteria

- [ ] `serialize`/`deserialize` params removed from `useSessionState`
- [ ] `JSON.stringify`/`JSON.parse` hardcoded inline
- [ ] eslint-disable comments on deps arrays can be removed or simplified
- [ ] All existing callers still work (none pass custom serializers)
- [ ] `make gate` passes
