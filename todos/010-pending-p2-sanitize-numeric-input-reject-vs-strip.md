---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, frontend, input-validation, pr-9]
dependencies: []
---

# sanitizeNumericInput Strips Instead of Rejecting Non-Decimal Input

## Problem Statement

`sanitizeNumericInput` in `apps/web/src/lib/utils.ts` strips non-digit/dot characters rather than rejecting the input. This silently reinterprets the numeric meaning of pasted/autofilled values:

- `"1e2"` (user means 100) becomes `"12"`
- `"0x1F"` (user means 31) becomes `"01"`
- `"0b101"` (user means 5) becomes `"0101"`

For financial inputs (stake, deposit, withdraw amounts), silent reinterpretation is dangerous. The downstream `parseDecimal` guard doesn't help because the reinterpreted value (`"12"`) is a valid decimal.

## Findings

- Copilot review #3828732396 on PR #9, commit `b5bc00f`
- 3 comments (IDs: 2830334964, 2830334981, 2830334995)
- Primary guard (`blockNonNumericKeys`) prevents typing these characters, so this only fires on paste/autofill/drag-drop
- Replied acknowledging and deferring to next PR

## Proposed Solution

Change `sanitizeNumericInput` to reject (return `""`) when input contains any character not in `[0-9.]`:

```typescript
export function sanitizeNumericInput(value: string): string {
  // Reject if any non-decimal character present
  if (/[^0-9.]/.test(value)) return "";
  // Normalize leading dot
  let sanitized = value.startsWith(".") ? "0" + value : value;
  // Limit to one decimal point
  const parts = sanitized.split(".");
  if (parts.length > 2) {
    sanitized = parts[0] + "." + parts.slice(1).join("");
  }
  return sanitized;
}
```

Update corresponding tests to expect `""` instead of stripped values for scientific notation, hex, binary, octal, and sign-prefixed inputs.

## Acceptance Criteria

- [ ] `sanitizeNumericInput("1e2")` returns `""` (not `"12"`)
- [ ] `sanitizeNumericInput("0x1F")` returns `""` (not `"01"`)
- [ ] `sanitizeNumericInput("+10")` returns `""` (not `"10"`)
- [ ] `sanitizeNumericInput("-5.5")` returns `""` (not `"5.5"`)
- [ ] Valid decimals still pass through: `"123"`, `"10.5"`, `".5"`, `"5."`
- [ ] Tests updated with new expectations
- [ ] `make gate` passes
