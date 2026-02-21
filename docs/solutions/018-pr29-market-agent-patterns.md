# PR #29 -- Market Discovery Agent Patterns

**Category:** review/multi-pattern | **PR:** 29 | **Commit:** `5153a73`, `8608734`

## Overview

PR #29 adds a Market Discovery Agent (`scripts/market-agent.ts`) that autonomously discovers NBA games from BallDontLie, registers them as on-chain legs, and resolves completed games via AdminOracleAdapter with x402 risk assessment. The commit `8608734` fixes cross-chain contract read failures. Five novel patterns emerged.

## Pattern 1: Explicit Nonce Management for Batched On-Chain Writes

**Problem:** Registering multiple legs in a loop with `writeContract` requires each transaction to have a sequential nonce. Without explicit nonce management, the RPC node may assign the same nonce to concurrent sends (especially with fast loops on testnet), causing reverts or replacement.

**Root Cause:** `writeContract` by default lets the RPC assign the nonce, but when sending multiple transactions before any are mined, the RPC may return the same `getTransactionCount` for each. On Anvil this is less noticeable (instant mining), but on Sepolia with ~2s block times, batch sends frequently collide.

**Solution:** Read the current nonce once (`getTransactionCount`), pass it explicitly to each `writeContract` call, and increment locally after each send:

```typescript
let nonce = await publicClient.getTransactionCount({ address: account.address });
for (const item of batch) {
  const hash = await walletClient.writeContract({ ...args, nonce, chain, account });
  nonce++;
  await publicClient.waitForTransactionReceipt({ hash });
}
```

**Prevention:** Any script that sends multiple transactions in sequence to the same chain must either (a) `await` receipt between each send (safe but slow), or (b) manage nonces explicitly with local increment. For high-throughput batches, explicit nonce + fire-and-wait-later is the pattern. Always re-read nonce at the start of a new batch phase (discovery vs. resolution) since other processes may have sent transactions between phases.

## Pattern 2: Cross-Chain Contract Read Pinning

**Problem:** wagmi's `usePublicClient()` returns a client for the wallet's currently connected chain. When the wallet is on Base Sepolia but `.env.local` has Anvil contract addresses (or vice versa), every `readContract` call returns `0x` (empty data) -- causing silent failures like "ticketCount returned no data."

**Root Cause:** `usePublicClient()` without a `chainId` argument follows the wallet's active chain. Contract reads against an address that doesn't exist on that chain return `0x` rather than throwing, because at the EVM level it's a valid (but empty) `staticcall`.

**Solution:** Create a `useContractClient()` hook that pins reads to `NEXT_PUBLIC_CHAIN_ID`:

```typescript
function useContractClient() {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  return usePublicClient({ chainId: chainId || undefined });
}
```

All 15 read-hook call sites use this instead of `usePublicClient()`. Write hooks still require the wallet to be on the correct chain (wagmi enforces this via `useWriteContract`).

**Prevention:** In multi-chain dApps, reads and writes have different chain requirements. Reads should be pinned to the chain where contracts are deployed (from env config). Writes require the wallet to be on the correct chain. Never assume `usePublicClient()` returns a client for your deployment chain -- it follows the wallet.

## Pattern 3: Idempotent Agent Discovery and Resolution

**Problem:** An autonomous agent running on a polling loop (every 60s) will encounter the same games and legs repeatedly. Without idempotency, it would attempt to re-register already-registered legs and re-resolve already-resolved outcomes, wasting gas and producing errors.

**Root Cause:** Polling-based agents inherently see the same data across cycles. The agent's state is ephemeral (no persistent database), so it must re-derive "what exists" from on-chain state each cycle.

**Solution:** Two-layer idempotency:

1. **Discovery:** Build a `questionMap` (normalized question text -> legId) from all on-chain legs at the start of each cycle. Skip any BDL market whose normalized question already exists. Normalization: `trim().toLowerCase()`.
2. **Resolution:** Before resolving, call `getStatus(legId)` on the oracle adapter. If status != Pending (already Won/Lost/Voided), skip. This is a pure read, costs no gas.

```typescript
// Discovery idempotency
const normalizedQ = normalize(leg.question);
if (questionMap.has(normalizedQ)) continue;

// Resolution idempotency
const [currentStatus] = await publicClient.readContract({
  address: oracleAddr, abi: ORACLE_ABI,
  functionName: "getStatus", args: [BigInt(legId)],
});
if (currentStatus !== LegStatus.Pending) continue;
```

**Prevention:** Every autonomous agent that modifies on-chain state must have pre-flight idempotency checks. For creation: check existence by content hash or unique identifier. For state transitions: check current state before writing. These checks should be reads (free), not writes (cost gas). Rebuild lookup maps from authoritative on-chain state each cycle rather than relying on local cache that can drift.

## Pattern 4: Cutoff Guards for Time-Sensitive Operations

**Problem:** The agent discovers games that start in the next 7 days, but a game starting in 10 minutes shouldn't be registered as a bettable leg -- there's not enough time for users to discover, evaluate, and place bets. Registering near-cutoff legs wastes gas and creates a poor user experience.

**Root Cause:** The BDL API returns all games in the date range regardless of proximity to start time. Without a time guard, the agent would register games that are effectively un-bettable.

**Solution:** 30-minute cutoff guard: skip any game whose `cutoffTime` is less than 30 minutes from now:

```typescript
const cutoffGuardSec = 30 * 60;
if (leg.cutoffTime > 0 && leg.cutoffTime - nowSec < cutoffGuardSec) {
  // Skip -- too close to game start
  continue;
}
```

**Prevention:** Any automated system that registers time-bounded events (bets, auctions, deadlines) needs a minimum lead-time guard. The guard value should be tunable (env var or config) and account for: user discovery time, transaction confirmation time, and the operational cost of registering something that expires before anyone can use it.

## Pattern 5: Remote RPC Key Guard

**Problem:** The market-agent defaults `PRIVATE_KEY` to Anvil account #0 (`0xac0974...`) for local development convenience. If someone runs the agent against a remote RPC (Sepolia, mainnet) without explicitly setting `PRIVATE_KEY`, the default Anvil key would be used -- which either (a) fails silently (no ETH on real chain) or (b) exposes the well-known Anvil key to the public mempool.

**Root Cause:** Convenience defaults that are safe locally become dangerous when the context changes. The `RPC_URL` and `PRIVATE_KEY` are independent config, but have a security-critical dependency: Anvil keys must never be used on non-local chains.

**Solution:** `requireExplicitKeyForRemoteRpc()` checks if the RPC URL points to a non-local network and throws if `PRIVATE_KEY` is not explicitly set:

```typescript
function requireExplicitKeyForRemoteRpc(rpcUrl: string): void {
  const isLocal = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost") || rpcUrl.includes("0.0.0.0");
  if (!isLocal && !process.env.PRIVATE_KEY) {
    throw new Error("RPC_URL points to remote network but PRIVATE_KEY not set. Refusing Anvil key on non-local chain.");
  }
}
```

**Prevention:** When a script has convenience defaults for local development (default keys, default RPCs, test tokens), add a cross-validation guard that refuses to combine local defaults with remote contexts. The check should be at startup, before any state changes. Pattern: if `context == remote` then `require(credential == explicit)`.

---

## Summary Table

| # | Pattern | Severity | Fix Commit |
|---|---------|----------|------------|
| 1 | Explicit nonce management for batch txs | Medium | `5153a73` |
| 2 | Cross-chain contract read pinning | High | `8608734` |
| 3 | Idempotent agent discovery + resolution | Medium | `5153a73` |
| 4 | Cutoff guards for time-sensitive operations | Low | `5153a73` |
| 5 | Remote RPC key guard | High | `5153a73` |
