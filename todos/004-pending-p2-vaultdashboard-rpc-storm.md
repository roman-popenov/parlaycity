---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, performance, frontend, pr-9]
dependencies: []
---

# VaultDashboard Fires 15+ RPC Calls Per Polling Cycle

## Problem Statement

`VaultDashboard.tsx` uses multiple independent `useReadContract` hooks, each with its own `refetchInterval` (5s or 10s). This produces 15+ individual RPC calls per cycle. On Base mainnet with rate-limited RPC endpoints, this can hit rate limits and cause failed reads / flickering UI.

Pre-existing issue, but this PR adds more hooks (withdraw/lock minimum guards).

Flagged by: performance-oracle.

## Findings

- `apps/web/src/components/VaultDashboard.tsx` -- 15+ useReadContract calls
- Each hook polls independently, no batching
- wagmi supports `multicall` batching via `useReadContracts` (plural)
- 5s polling for share prices is aggressive; 10s would suffice
- Component is 599 lines, handling deposit/withdraw/lock/positions/rewards/stats

## Proposed Solutions

### Option A: Consolidate into useReadContracts (multicall)
Replace individual `useReadContract` hooks with a single `useReadContracts` call that batches all reads into one multicall.
- Pros: Dramatic reduction in RPC calls (15 -> 1-2 per cycle)
- Cons: Requires refactoring hook consumption pattern
- Effort: Medium
- Risk: Low

### Option B: Increase polling interval to 10s for non-critical reads
Keep individual hooks but reduce polling frequency for share prices, utilization, etc.
- Pros: Quick fix, halves RPC load
- Cons: Still N individual calls per cycle
- Effort: Small
- Risk: Low

## Recommended Action

Option B for hackathon (quick win). Option A post-hackathon.

## Technical Details

- Affected files: `apps/web/src/components/VaultDashboard.tsx`
- wagmi docs: `useReadContracts` with `multicall: true`
- Pre-existing issue, not introduced by this PR

## Acceptance Criteria

- [ ] Non-critical reads use 10s polling interval
- [ ] No visible UI regression (values still update reasonably)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified during PR #9 review | Pre-existing, worsened by new hooks |

## Resources

- PR #9: feat/risk-vault-services
- wagmi docs: useReadContracts multicall batching
