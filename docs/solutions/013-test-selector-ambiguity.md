---
title: Test button selector matches wrong element (tab vs action)
category: testing/frontend
severity: medium
prs: [9]
commits: [b5bc00f]
tags: [react-testing, button-selector, tab-button, action-button, getAllByRole, ambiguous-selector]
date: 2026-02-19
---

# Test Button Selector Matches Wrong Element (Tab vs Action)

## Problem
`screen.getAllByRole("button").find((b) => b.textContent === "Deposit")` matched the tab navigation button instead of the form action button. Both buttons render identical text content ("Deposit"), but the tab button is never disabled. Tests asserting `expect(btn).toBeDisabled()` passed or failed depending on which button was found first in the DOM.

The same ambiguity exists for "Withdraw" and "Lock" tabs/actions.

## Root Cause
The VaultDashboard component renders two buttons with the same text for each operation:
1. A **tab button** (navigation, `rounded-lg px-4 py-2`) — always enabled
2. An **action button** (form submit, `w-full rounded-xl bg-gradient-to-r`) — conditionally disabled

`getAllByRole("button")` returns both. `.find((b) => b.textContent === text)` returns whichever appears first in DOM order, which is the tab button (rendered before the form). This made `toBeDisabled()` assertions fail since the tab button is always enabled.

Some existing tests (e.g., "enables deposit button for exactly 1 USDC") passed by coincidence because in disconnected state the action button shows "Connect Wallet" instead of "Deposit", making the tab button the *only* match.

## Solution
Filter by CSS class that uniquely identifies action buttons:

```typescript
const findActionButton = (text: string) =>
  screen.getAllByRole("button").find(
    (b) => b.textContent === text && b.className.includes("w-full"),
  );
```

Better long-term: use `data-testid` attributes on action buttons to avoid coupling tests to CSS classes.

## Prevention (Category-Level)
- **Rule**: When a component renders multiple buttons with the same text (tabs + actions), never select by text content alone. Use `data-testid`, `aria-label`, or CSS class filtering.
- **Rule**: If `getAllByRole("button").find(...)` matches more than expected, the selector is ambiguous. Add a uniqueness constraint.
- **Rule**: When a test passes, verify it's testing the right element. A passing `toBeDisabled()` on the wrong button gives false confidence.
- **Rule**: Prefer `data-testid` over CSS class filtering for test selectors — CSS classes can change during styling refactors without warning test authors.

## Related Issues
- See also: [006-button-state-mismatch.md](006-button-state-mismatch.md) — button disabled/styling state disagreements
- See also: [009-false-positive-tests.md](009-false-positive-tests.md) — tests passing without exercising intended code
