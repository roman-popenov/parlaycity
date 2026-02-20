---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, performance, frontend, react, pr-12]
dependencies: []
---

# Guard Risk-Clear Effect to Skip No-Op setState Calls

## Problem Statement

The risk-clearing effect (line 137) fires on every keystroke in the stake input and unconditionally calls `setRiskAdvice(null)`, `setRiskError(null)`, `setRiskLoading(false)`. When these values are already null/false, the calls are no-ops at reconciliation but React still schedules unnecessary re-render work (2 renders per keystroke instead of 1).

## Findings

- Performance oracle: Finding #2.1, MEDIUM impact
- File: `apps/web/src/components/ParlayBuilder.tsx:137-143`

## Proposed Solution

```typescript
useEffect(() => {
  if (riskAdvice !== null) setRiskAdvice(null);
  if (riskError !== null) setRiskError(null);
  if (riskLoading) setRiskLoading(false);
  riskFetchIdRef.current++;
}, [selectedLegs, stake, payoutMode]);
```

**Effort:** Small (3 if-guards)
**Risk:** None

## Acceptance Criteria

- [ ] Risk-clear effect guards setState calls with current-value checks
- [ ] No extra re-renders when risk advice is not displayed
- [ ] `make gate` passes
