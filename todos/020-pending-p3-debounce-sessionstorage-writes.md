---
status: pending
priority: p3
issue_id: "020"
tags: [code-review, performance, frontend, pr-12]
dependencies: ["018"]
---

# Debounce sessionStorage Writes in useSessionState

## Problem Statement

`useSessionState` writes to sessionStorage synchronously on every value change. For the `stake` input, this means `JSON.stringify` + `sessionStorage.setItem` runs on every keystroke. While negligible for short strings, this is unnecessary I/O that could matter on low-end mobile devices or with larger persisted state.

## Findings

- Performance oracle: Finding #2.2, LOW impact
- File: `apps/web/src/lib/utils.ts:92-100`

## Proposed Solution

```typescript
useEffect(() => {
  if (!hydrated) return;
  const timeoutId = setTimeout(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, 300);
  return () => clearTimeout(timeoutId);
}, [key, value, hydrated]);
```

**Effort:** Small (3 LOC change)
**Risk:** Low -- 300ms delay before persistence. Acceptable for session recovery.
