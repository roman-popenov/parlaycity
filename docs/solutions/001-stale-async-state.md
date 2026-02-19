---
title: Stale async state after wallet disconnect
category: frontend/async
severity: medium
prs: [2]
tags: [wagmi, polling, race-condition, wallet-disconnect]
date: 2026-02-17
---

# Stale Async State After Wallet Disconnect

## Problem
Three related bugs in wagmi polling hooks (`useUserTickets`, `useLockPositions`):
1. **Stale wallet data**: In-flight RPC fetches from wallet A continue after switching to wallet B, repopulating UI with wrong wallet's data.
2. **Overlapping scans**: `setInterval` polling fires new fetches before previous ones complete, causing concurrent RPC loops and duplicate state writes.
3. **Disconnect doesn't invalidate**: Clearing state on disconnect doesn't cancel already-running fetches.

## Root Cause
React `useEffect` polling with `setInterval` has no built-in cancellation for async work. When a wallet disconnects or switches mid-fetch, the async callback still holds a closure over the old `setState` function and writes stale results.

## Solution
Two-guard pattern: `fetchIdRef` (monotonic counter) + `inFlightRef` (boolean):

```typescript
const fetchIdRef = useRef(0);
const inFlightRef = useRef(false);

// On disconnect: bump counter + clear flag
if (!address || !client) {
  fetchIdRef.current++;
  inFlightRef.current = false;
  setTickets([]);
  return;
}

// On fetch: check guards
const localFetchId = ++fetchIdRef.current;
if (inFlightRef.current) return; // skip overlapping
inFlightRef.current = true;
try {
  // ... fetch ...
  if (localFetchId !== fetchIdRef.current) return; // stale
  setTickets(results);
} finally {
  if (localFetchId === fetchIdRef.current) {
    inFlightRef.current = false;
  }
}
```

## Prevention (Category-Level)
- **Rule**: Every polling hook that fetches async data MUST use the fetchId + inFlight guard pattern.
- **Rule**: Disconnect/account-change handlers MUST bump the fetchId counter to invalidate in-flight work.
- **Rule**: All `setState` calls inside async callbacks MUST check `localFetchId === fetchIdRef.current` before writing.
- Added to `apps/web/CLAUDE.md` polling section.
