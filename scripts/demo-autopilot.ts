/**
 * Demo Autopilot -- auto-resolves legs and settles tickets for demos.
 *
 * Watches for active tickets, resolves their legs one at a time with a
 * configurable delay between each, then auto-settles. No manual terminal
 * switching needed -- just buy a ticket and watch the rocket climb.
 *
 * Resolution is fully sequential: one leg at a time, one ticket at a time.
 * This ensures the rocket animation on the frontend plays smoothly.
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/demo-autopilot.ts
 *   # or
 *   make demo-autopilot
 *
 * Env vars:
 *   RESOLVE_DELAY_MS   -- delay between leg resolutions (default: 10000)
 *   FIRST_LEG_DELAY_MS -- extra delay before resolving a ticket's first leg (default: 15000)
 *   POLL_INTERVAL_MS   -- how often to check for new tickets (default: 3000)
 *   CRASH_LEG_INDEX    -- crash the Nth leg (0-indexed) of each ticket (default: none)
 *   CRASH_ODDS         -- probability (0-100) that any given ticket crashes (default: 30)
 *   RPC_URL            -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY        -- defaults to Anvil account #0
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
  type PublicClient,
  type WalletClient,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

import { loadEnvLocal, requireExplicitKeyForRemoteRpc, safeBigIntToNumber, safeParseNumber } from "./lib/env";

// -- ABI fragments -----------------------------------------------------------

const ENGINE_ABI = parseAbi([
  "function ticketCount() view returns (uint256)",
  "function getTicket(uint256 ticketId) view returns ((address buyer, uint256 stake, uint256[] legIds, bytes32[] outcomes, uint256 multiplierX1e6, uint256 potentialPayout, uint256 feePaid, uint8 mode, uint8 status, uint256 createdAt, uint8 payoutMode, uint256 claimedAmount, uint256 cashoutPenaltyBps))",
  "function settleTicket(uint256 ticketId)",
]);

const REGISTRY_ABI = parseAbi([
  "function getLeg(uint256 legId) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
]);

const ORACLE_ABI = parseAbi([
  "function getStatus(uint256 legId) view returns (uint8 status, bytes32 outcome)",
  "function resolve(uint256 legId, uint8 status, bytes32 outcome)",
]);

// -- Config ------------------------------------------------------------------

const TicketStatus = { Active: 0, Won: 1, Lost: 2, Voided: 3, Claimed: 4 } as const;
const LegStatus = { Unresolved: 0, Won: 1, Lost: 2, Voided: 3 } as const;

const YES_OUTCOME = keccak256(toHex("Yes"));
const NO_OUTCOME = keccak256(toHex("No"));

function getConfig() {
  const envLocal = loadEnvLocal();

  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  requireExplicitKeyForRemoteRpc(rpcUrl);

  const privateKey = (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

  const engineAddr = (process.env.PARLAY_ENGINE_ADDRESS ??
    envLocal.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ?? "") as Address;
  const registryAddr = (process.env.LEG_REGISTRY_ADDRESS ??
    envLocal.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ?? "") as Address;

  const resolveDelay = safeParseNumber(process.env.RESOLVE_DELAY_MS, 10000, "RESOLVE_DELAY_MS");
  const firstLegDelay = safeParseNumber(process.env.FIRST_LEG_DELAY_MS, 15000, "FIRST_LEG_DELAY_MS");
  const pollInterval = safeParseNumber(process.env.POLL_INTERVAL_MS, 3000, "POLL_INTERVAL_MS");
  // CRASH_LEG_INDEX: crash the Nth leg (0-indexed position) of each ticket
  const crashLegIndex = process.env.CRASH_LEG_INDEX !== undefined
    ? safeParseNumber(process.env.CRASH_LEG_INDEX, 0, "CRASH_LEG_INDEX")
    : null;
  // 30% chance a ticket crashes (losing stake stays in vault = realistic economics)
  const crashOdds = safeParseNumber(process.env.CRASH_ODDS, 30, "CRASH_ODDS");

  if (!engineAddr) throw new Error("Missing PARLAY_ENGINE_ADDRESS");
  if (!registryAddr) throw new Error("Missing LEG_REGISTRY_ADDRESS");

  const chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  return { rpcUrl, privateKey, engineAddr, registryAddr, resolveDelay, firstLegDelay, pollInterval, crashLegIndex, crashOdds, chain };
}

// -- Helpers -----------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseOutcomeChoice(outcomeBytes: `0x${string}`): number {
  try {
    const v = Number(BigInt(outcomeBytes));
    return v === 1 || v === 2 ? v : 1;
  } catch {
    return 1; // default to Yes
  }
}

// -- Main loop ---------------------------------------------------------------

let running = true;

// Track which ticket IDs we've started resolving (for first-leg delay)
const ticketFirstSeen = new Map<number, number>(); // ticketId -> timestamp
// Per-ticket crash decision (determined once on first encounter)
const ticketCrashIndex = new Map<number, number | null>(); // ticketId -> leg INDEX to crash (or null)
// Track tickets that are fully processed (settled or all legs resolved + settled)
const processedTickets = new Set<number>();

/**
 * Resolve a single leg on-chain and verify the result.
 * Returns true if the leg was successfully resolved (or already resolved).
 */
async function resolveLeg(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  oracleAddr: Address,
  legId: number,
  asLost: boolean,
  outcomeChoice: number,
  ticketId: number,
  legIndex: number,
): Promise<boolean> {
  // Check if already resolved on-chain
  const [currentStatus] = await publicClient.readContract({
    address: oracleAddr,
    abi: ORACLE_ABI,
    functionName: "getStatus",
    args: [BigInt(legId)],
  }) as [number, `0x${string}`];

  if (currentStatus !== LegStatus.Unresolved) {
    if (currentStatus === LegStatus.Voided) {
      console.log(`  [ticket #${ticketId}] Leg ${legIndex}/${legId} already resolved -> VOIDED (neutral, continuing)`);
      return true;
    }
    const bettorWon = outcomeChoice === 2
      ? currentStatus === LegStatus.Lost
      : currentStatus === LegStatus.Won;
    const label = bettorWon ? "WON" : "LOST";
    console.log(`  [ticket #${ticketId}] Leg ${legIndex}/${legId} already resolved -> ${label} (oracle=${currentStatus})`);
    return true;
  }

  // Determine oracle result that makes the ticket win (or lose if crash)
  const betYes = outcomeChoice !== 2;
  const oracleYes = asLost ? !betYes : betYes;
  const status = oracleYes ? LegStatus.Won : LegStatus.Lost;
  const outcome = oracleYes ? YES_OUTCOME : NO_OUTCOME;
  const label = asLost ? "LOST (crash)" : "WON";

  try {
    const hash = await walletClient.writeContract({
      address: oracleAddr,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [BigInt(legId), status, outcome],
      chain: walletClient.chain,
      account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Verify on-chain state matches what we sent
    const [verifyStatus] = await publicClient.readContract({
      address: oracleAddr,
      abi: ORACLE_ABI,
      functionName: "getStatus",
      args: [BigInt(legId)],
    }) as [number, `0x${string}`];

    if (verifyStatus !== status) {
      console.error(`  [ticket #${ticketId}] WARNING: Leg ${legIndex}/${legId} oracle mismatch! Sent ${status}, got ${verifyStatus}`);
    }

    console.log(`  [ticket #${ticketId}] Leg ${legIndex}/${legId} -> ${label} (oracle=${verifyStatus}, tx=${receipt.transactionHash.slice(0, 10)}...)`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already resolved")) {
      console.log(`  [ticket #${ticketId}] Leg ${legIndex}/${legId} -> already resolved`);
      return true;
    }
    console.error(`  [ticket #${ticketId}] Failed leg ${legIndex}/${legId}: ${msg.slice(0, 150)}`);
    return false;
  }
}

async function settleTicket(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  engineAddr: Address,
  ticketId: number,
) {
  try {
    const hash = await walletClient.writeContract({
      address: engineAddr,
      abi: ENGINE_ABI,
      functionName: "settleTicket",
      args: [BigInt(ticketId)],
      chain: walletClient.chain,
      account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const updated = await publicClient.readContract({
      address: engineAddr,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [BigInt(ticketId)],
    });

    const statusNames: Record<number, string> = {
      0: "Active", 1: "Won", 2: "Lost", 3: "Voided", 4: "Claimed",
    };
    console.log(`  [ticket #${ticketId}] Settled -> ${statusNames[updated.status] ?? "?"} (${receipt.transactionHash.slice(0, 10)}...)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [ticket #${ticketId}] Settle failed: ${msg.slice(0, 150)}`);
  }
}

/**
 * Process a single ticket: resolve all legs sequentially, then settle.
 * Each leg resolution waits for the configured delay before proceeding.
 */
async function processTicket(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  cfg: ReturnType<typeof getConfig>,
  ticketId: number,
) {
  const ticket = await publicClient.readContract({
    address: cfg.engineAddr,
    abi: ENGINE_ABI,
    functionName: "getTicket",
    args: [BigInt(ticketId)],
  });

  if (ticket.status !== TicketStatus.Active) {
    processedTickets.add(ticketId);
    return;
  }

  // Decide crash fate once per ticket
  if (!ticketCrashIndex.has(ticketId)) {
    if (cfg.crashLegIndex !== null && cfg.crashLegIndex < ticket.legIds.length) {
      ticketCrashIndex.set(ticketId, cfg.crashLegIndex);
      console.log(`[autopilot] Ticket #${ticketId} will crash on leg index ${cfg.crashLegIndex} (leg ID ${ticket.legIds[cfg.crashLegIndex]})`);
    } else if (Math.random() * 100 < cfg.crashOdds) {
      const crashIdx = ticket.legIds.length - 1; // last leg
      ticketCrashIndex.set(ticketId, crashIdx);
      console.log(`[autopilot] Ticket #${ticketId} will crash on leg index ${crashIdx} (leg ID ${ticket.legIds[crashIdx]})`);
    } else {
      ticketCrashIndex.set(ticketId, null);
      console.log(`[autopilot] Ticket #${ticketId} will win all ${ticket.legIds.length} legs`);
    }
  }
  const crashIdx = ticketCrashIndex.get(ticketId) ?? null;

  // Resolve legs sequentially
  for (let i = 0; i < ticket.legIds.length; i++) {
    if (!running) return;

    const legIdBig = ticket.legIds[i];
    const legId = safeBigIntToNumber(legIdBig, "legId");
    const outcomeChoice = parseOutcomeChoice(ticket.outcomes[i] as `0x${string}`);

    // Check if already resolved
    const leg = await publicClient.readContract({
      address: cfg.registryAddr,
      abi: REGISTRY_ABI,
      functionName: "getLeg",
      args: [legIdBig],
    });
    const oracleAddr = leg.oracleAdapter as Address;

    const [currentStatus] = await publicClient.readContract({
      address: oracleAddr,
      abi: ORACLE_ABI,
      functionName: "getStatus",
      args: [legIdBig],
    }) as [number, `0x${string}`];

    if (currentStatus !== LegStatus.Unresolved) {
      if (currentStatus === LegStatus.Voided) {
        console.log(`  [ticket #${ticketId}] Leg ${i}/${legId} already resolved -> VOIDED (neutral, continuing)`);
        continue;
      }
      const bettorWon = outcomeChoice === 2
        ? currentStatus === LegStatus.Lost
        : currentStatus === LegStatus.Won;
      console.log(`  [ticket #${ticketId}] Leg ${i}/${legId} already resolved -> ${bettorWon ? "WON" : "LOST"}`);
      if (!bettorWon) {
        console.log(`  [ticket #${ticketId}] Early crash (shared leg resolved unfavorably)`);
        break;
      }
      continue;
    }

    // Wait before resolving (this is the dramatic delay the user sees)
    await sleep(cfg.resolveDelay);
    if (!running) return;

    const asLost = crashIdx !== null && i === crashIdx;
    const ok = await resolveLeg(publicClient, walletClient, account, oracleAddr, legId, asLost, outcomeChoice, ticketId, i);
    if (!ok) return; // Don't settle if a resolve failed

    // If this was the crash leg, stop resolving more legs
    if (asLost) break;
  }

  // Settle
  if (running) {
    await settleTicket(publicClient, walletClient, account, cfg.engineAddr, ticketId);
    processedTickets.add(ticketId);
  }
}

async function cycle(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  cfg: ReturnType<typeof getConfig>,
) {
  const ticketCount = safeBigIntToNumber(
    await publicClient.readContract({
      address: cfg.engineAddr,
      abi: ENGINE_ABI,
      functionName: "ticketCount",
    }),
    "ticketCount",
  );

  if (ticketCount === 0) return;

  for (let tid = 0; tid < ticketCount; tid++) {
    if (!running) break;
    if (processedTickets.has(tid)) continue;

    // First-leg delay: give the user time to navigate to the ticket page
    if (!ticketFirstSeen.has(tid)) {
      ticketFirstSeen.set(tid, Date.now());
      console.log(`[autopilot] New ticket #${tid} detected, waiting ${cfg.firstLegDelay / 1000}s before resolving...`);
    }
    const elapsed = Date.now() - (ticketFirstSeen.get(tid) ?? Date.now());
    if (elapsed < cfg.firstLegDelay) continue;

    // Process this ticket fully (resolve all legs + settle)
    await processTicket(publicClient, walletClient, account, cfg, tid);
  }
}

async function main() {
  const cfg = getConfig();

  console.log("[autopilot] ParlayCity Demo Autopilot");
  console.log(`[autopilot] RPC: ${cfg.rpcUrl}`);
  console.log(`[autopilot] Engine: ${cfg.engineAddr}`);
  console.log(`[autopilot] First leg delay: ${cfg.firstLegDelay / 1000}s (time to navigate)`);
  console.log(`[autopilot] Resolve delay: ${cfg.resolveDelay / 1000}s between legs`);
  console.log(`[autopilot] Poll interval: ${cfg.pollInterval / 1000}s`);
  if (cfg.crashLegIndex !== null) {
    console.log(`[autopilot] Crash leg index: ${cfg.crashLegIndex} (0-indexed position in each ticket)`);
  } else {
    console.log(`[autopilot] Crash odds: ${cfg.crashOdds}% per ticket (last leg crashes)`);
  }
  console.log("[autopilot] Buy a ticket and watch the rocket climb!");
  console.log("");

  const account = privateKeyToAccount(cfg.privateKey);
  const publicClient = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
    account,
  });

  process.on("SIGINT", () => { console.log("\n[autopilot] Shutting down..."); running = false; });
  process.on("SIGTERM", () => { console.log("\n[autopilot] Shutting down..."); running = false; });

  while (running) {
    try {
      await cycle(publicClient, walletClient, account, cfg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[autopilot] Cycle error: ${msg.slice(0, 200)}`);
    }
    await sleep(cfg.pollInterval);
  }

  console.log("[autopilot] Stopped.");
}

main().catch((err) => {
  console.error("[autopilot] Fatal:", err);
  process.exit(1);
});
