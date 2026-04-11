# A-DAY — 48-hour scaling sprint

Backlog for the weekend heads-down session. Target: get parlay-voo from "hackathon build that feels slow" to "production-ready for 250 users, with a clear path to 1000."

Full analysis and evidence lives in `~/.claude/plans/agile-crafting-lightning.md`. This doc is the working checklist.

## How to use this list

Don't just run top-to-bottom. Alternate **scaling work** (S-#) and **feature work** (F-#), and pick the next item by its **value / time** ratio — highest wins. Rules of thumb:

- A 30-minute task that unblocks three later tasks beats a 3-hour task that stands alone.
- A scaling task that changes how users *feel* the app (home page latency, tickets page loading) beats one that only shows up under load you don't have yet.
- If a scaling task becomes a prerequisite for a feature you want to ship (e.g. need the indexer before the leaderboard feature), promote it.
- If two tasks tie, pick the one you'll actually finish — momentum matters more than optimality.

Mark tasks `[x]` when done. Don't delete — keeps a log of what shipped vs what got deferred.

## Already done (Friday night)

- [x] **Alchemy private RPC swap.** `packages/nextjs/src/lib/wagmi.ts` now uses a `fallback` transport: Alchemy primary, public Base Sepolia as backup. Reads `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` from env. `scripts/sync-env.sh` preserves the var across deploys so `make deploy-*` won't wipe it. Add `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=<alchemy-url>` to `packages/nextjs/.env.local` and restart `next dev`.

## Scaling backlog

### S-1 — Tune React Query defaults [x]
- **Time:** 5 minutes
- **Value:** High. Halves background-tab RPC load and kills redundant refetches on route navigation. Whole app feels snappier with zero risk.
- **Files:** `packages/nextjs/src/components/providers.tsx`
- **Change:** pass `defaultOptions` to `new QueryClient()`:
  ```ts
  {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
  }
  ```
- **Do this first.** It's the highest ratio task in the whole doc.

### S-2 — RPC call counter (debug overlay)
- **Time:** 1 hour
- **Value:** Medium now, high later. Lets you measure whether subsequent optimizations actually helped. Without this you're flying blind.
- **Files:** `packages/nextjs/src/lib/hooks.ts` (`useContractClient` at ~line 22), new component `packages/nextjs/src/components/DebugRpcCounter.tsx`
- **Change:** wrap the viem client's `readContract` so every call increments `window.__rpcCalls`. Add a fixed-position overlay visible only when `?debug=1` query param is set. Show calls/min rolling average.
- **Why before the big optimizations:** you want a baseline reading on `/`, `/tickets`, `/vault` before touching the hooks.

### S-3 — Batch reads in useVaultStats + useParlayConfig
- **Time:** 2 hours
- **Value:** High. Home page mount drops from ~10 RPC round trips to ~2. Most visible improvement users will feel.
- **Files:** `packages/nextjs/src/lib/hooks.ts:149-216` (useVaultStats), `packages/nextjs/src/lib/hooks.ts:218-288` (useParlayConfig)
- **Change:** replace clusters of `useReadContract` with a single `useReadContracts` per hook. wagmi auto-batches into Multicall3 (already deployed on Base Sepolia at `0xcA11bde05977b3631167028862bE2a173976CA11`). Preserve the same return shape so callers don't need to change.

### S-4 — Upstash Redis + cache `/api/markets`
- **Time:** 2-3 hours
- **Value:** High. Kills the broken module-level cache in `bdl.ts` that blows up on Vercel serverless cold starts. Also protects your BDL quota.
- **Files:** new env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), `packages/nextjs/src/lib/redis.ts` (new), `packages/nextjs/src/app/api/markets/route.ts`, later `/api/agent-stats` and `/api/quote`
- **Change:** install `@upstash/redis`. Wrap each cacheable route with `redis.get → fallback fetch → redis.set(..., { ex: TTL })`. TTLs: markets 300s, agent-stats 60s, quote 600s keyed on `sha256(sortedLegIds + stake)`. Leave `/api/chat` uncached.
- **Bonus:** rip the broken in-memory cache out of `bdl.ts:36-42` while you're there so nobody gets confused later.

### S-5 — Rate limiting on expensive API routes
- **Time:** 1 hour (after S-4, shares the Redis dependency)
- **Value:** Medium. Protects your Claude API spend and BDL quota from a single abusive client. Not urgent before you have public users, but trivially cheap once Redis is in.
- **Files:** `packages/nextjs/src/lib/ratelimit.ts` (new), `/api/chat`, `/api/premium/agent-quote`
- **Change:** `@upstash/ratelimit` with sliding-window limits. Start at 10 req/min per IP. Return 429 with `Retry-After`.

### S-6 — Ponder indexer + Neon Postgres (the big one)
- **Time:** 3-5 days (won't fit in a 48-hour window — start it, finish next week)
- **Value:** Very high, but only after the smaller wins. This is the thing that lets you actually hit 1000 users. Without it, `/tickets` breaks around 30-50 concurrent users because of the O(N) scan in `hooks.ts:308-397`.
- **Files:** new package `packages/indexer/` (Ponder), new `/api/tickets` route, rewrite of `useUserTickets` (`hooks.ts:308-397`) and `useLockPositions` (`hooks.ts:1034-1120`)
- **Change:** Ponder schema for `Ticket`, `LockPosition`, event handlers for `TicketPurchased`, `TicketSettled`, `LockCreated`, etc. Deploy Ponder on Railway (not Vercel — needs continuous uptime and a websocket RPC). Replace client-side chain scans with `SELECT ... WHERE owner = $1` via new `/api/tickets?owner=` route.
- **Priority hint:** if the weekend's goal is "shippable feel" rather than "1000-user load," this is a Sunday-night start, not a Saturday-morning start. Everything above will already make the app feel great to the handful of users you actually have.

### S-7 — Move cache into `/api/quote` + `/api/agent-stats`
- **Time:** 30 minutes each (after S-4)
- **Value:** Medium. These are the other two routes with either broken or missing caching. Cheap to clean up once Redis is wired.
- **Files:** `packages/nextjs/src/app/api/quote/route.ts`, `packages/nextjs/src/app/api/agent-stats/route.ts:58-64`

### S-8 — Kill the Makefile (optional, Option A from planning)
- **Time:** 1-2 hours
- **Value:** Quality-of-life only. No performance impact. Do this if the Makefile is still annoying you by Sunday afternoon and you have spare cycles.
- **Files:** `Makefile` (delete), `package.json` root (add scripts), `packages/nextjs/package.json` (tweak scripts), `packages/foundry/package.json` (add forge wrappers), possibly `scripts/dev.sh` for the multi-process dev loop
- **Change:** replace `make dev / make deploy-local / make gate / make test-all` with `pnpm dev / pnpm deploy:local / pnpm gate / pnpm test`. Keep the same behavior, just through package.json scripts.

### S-9 — `deployedContracts.ts` auto-generation (optional, Option B from planning)
- **Time:** 3-4 hours
- **Value:** Medium-low. Kills the hand-maintained 407-line ABI file at `packages/nextjs/src/lib/contracts.ts`, which drifts every time you touch a contract. Worth doing if you're about to edit contracts heavily.
- **Files:** new forge script `packages/foundry/script/GenerateAbis.s.sol` or a tsx script that reads `packages/foundry/out/**/*.json`, writes `packages/nextjs/src/contracts/deployedContracts.ts`. Update `hooks.ts` imports.
- **Natural bundling:** do this during S-3 if you find yourself already rewriting how hooks consume ABIs.

## Feature backlog

Add your own below. For each, jot down: time estimate, value, blockers (which scaling task it depends on, if any). Then slot them into the alternation sequence.

### F-1 — Implement real AMM pool
- **Time:** 1 day
- **Value:** high, the product is not complete until we have an actual lock up mechanism driven by market dynamics
- **Blockers:** currect lock functionality has return periods and values hard-coded 
- **Notes:**

### F-2 — Add live polymarket data
- **Time:** 2 days
- **Value:** medium, will need this for the launch and settlement
- **Blockers:** values are hard-coded as of right now, some agent workloads probably depend on this as well. Possible need to remove Kelly and Betty agents to accomplish this. Better data retention needed (Postgres)
- **Notes:** Live polymarket data will be used to 1) find real bets with their live odds 2) settle active bets

### F-3 — (your idea here)
- **Time:**
- **Value:**
- **Blockers:**
- **Notes:**

## Suggested Saturday morning order

Assuming no features are blockers yet, the pure-scaling momentum sequence is:

1. **S-1** (5 min) — instant win
2. **S-2** (1 hr) — measure the baseline *before* more changes
3. Pick a feature from your F-list
4. **S-3** (2 hr) — the visible multicall batching improvement
5. Pick another feature
6. **S-4** (2-3 hr) — Redis + `/api/markets` cache
7. **S-5** (1 hr) — rate limiting, bundled with S-4
8. Feature push through Saturday evening
9. **S-6** kickoff Sunday (start Ponder; finish next week)

## Bailout rules

- If something in the backlog is taking 2x its estimate, stop and reassess. Don't grind.
- If a feature idea would land in a day what a scaling task would land in an hour, flip the sequence — ship the win that the user sees, bank the backlog item for next weekend.
- End Sunday night with `make gate` green (or `pnpm gate` if you did S-8). No half-merged branches going into Monday.
