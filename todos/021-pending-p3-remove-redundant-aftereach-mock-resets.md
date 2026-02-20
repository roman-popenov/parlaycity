---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, testing, simplicity, pr-12]
dependencies: []
---

# Remove Redundant afterEach Mock Resets in Test File

## Problem Statement

The `afterEach` block (lines 618-642) manually resets every mock function to its default return value after `vi.restoreAllMocks()` on line 617. Since the module-level mocks use `vi.fn(() => ...)`, `vi.restoreAllMocks()` already restores to the original implementation. The 25 lines of manual resets are redundant boilerplate.

## Findings

- Code simplicity reviewer: Finding #7 (25 LOC)
- Performance oracle: Finding #5.1
- File: `apps/web/src/components/__tests__/ParlayBuilder.test.tsx:618-642`

## Proposed Solution

Remove lines 618-642. Keep `vi.restoreAllMocks()`. Run `make test-all` to verify.

**Effort:** Small (delete 25 LOC)
**Risk:** Low -- verify tests pass after removal
