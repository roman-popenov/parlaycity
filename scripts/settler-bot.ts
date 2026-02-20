/**
 * Settler Bot -- auto-settles resolved ParlayCity tickets.
 *
 * Polls the chain for active tickets whose legs have all been resolved by
 * oracle adapters, then calls settleTicket() on each one (permissionless).
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/settler-bot.ts
 *
 * Env vars (or reads from apps/web/.env.local):
 *   RPC_URL               -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY           -- defaults to Anvil account #0
 *   PARLAY_ENGINE_ADDRESS -- overrides .env.local
 *   LEG_REGISTRY_ADDRESS  -- overrides .env.local
 *   POLL_INTERVAL_MS      -- defaults to 10000
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

// -- ABI fragments (only what we need) ------------------------------------

const ENGINE_ABI = parseAbi([
  "function ticketCount() view returns (uint256)",
  "function getTicket(uint256 ticketId) view returns ((address buyer, uint256 stake, uint256[] legIds, bytes32[] outcomes, uint256 multiplierX1e6, uint256 potentialPayout, uint256 feePaid, uint8 mode, uint8 status, uint256 createdAt, uint8 payoutMode, uint256 claimedAmount, uint256 cashoutPenaltyBps))",
  "function settleTicket(uint256 ticketId)",
]);

const ORACLE_ABI = parseAbi([
  "function canResolve(uint256 legId) view returns (bool)",
  "function getStatus(uint256 legId) view returns (uint8 status, bytes32 outcome)",
]);

const REGISTRY_ABI = parseAbi([
  "function getLeg(uint256 legId) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
  "function legCount() view returns (uint256)",
]);

// -- Enums ----------------------------------------------------------------

const TicketStatus = { Active: 0, Won: 1, Lost: 2, Voided: 3, Claimed: 4 } as const;
const LegStatus = { Unresolved: 0, Won: 1, Lost: 2, Voided: 3 } as const;

const STATUS_NAMES: Record<number, string> = {
  [TicketStatus.Active]: "Active",
  [TicketStatus.Won]: "Won",
  [TicketStatus.Lost]: "Lost",
  [TicketStatus.Voided]: "Voided",
  [TicketStatus.Claimed]: "Claimed",
};

// -- Config ---------------------------------------------------------------

function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(process.cwd(), "../../apps/web/.env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

function getConfig() {
  const envLocal = loadEnvLocal();

  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const privateKey = (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

  const engineAddr = (process.env.PARLAY_ENGINE_ADDRESS ??
    envLocal.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ??
    "") as Address;
  const registryAddr = (process.env.LEG_REGISTRY_ADDRESS ??
    envLocal.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ??
    "") as Address;

  const pollInterval = Number(process.env.POLL_INTERVAL_MS ?? "10000");

  if (!engineAddr) throw new Error("Missing PARLAY_ENGINE_ADDRESS");
  if (!registryAddr) throw new Error("Missing LEG_REGISTRY_ADDRESS");

  const chain: Chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  return { rpcUrl, privateKey, engineAddr, registryAddr, pollInterval, chain };
}

// -- Main loop ------------------------------------------------------------

let running = true;

async function settle(
  publicClient: PublicClient,
  walletClient: WalletClient,
  engineAddr: Address,
  registryAddr: Address,
) {
  const ticketCount = await publicClient.readContract({
    address: engineAddr,
    abi: ENGINE_ABI,
    functionName: "ticketCount",
  });

  const count = Number(ticketCount);
  if (count === 0) {
    console.log(`[settler] No tickets yet`);
    return;
  }

  let settled = 0;

  for (let id = 0; id < count; id++) {
    if (!running) break;

    const ticket = await publicClient.readContract({
      address: engineAddr,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [BigInt(id)],
    });

    // Only settle active tickets
    if (ticket.status !== TicketStatus.Active) continue;

    // Check if all legs are resolvable
    let allResolvable = true;
    for (const legId of ticket.legIds) {
      const leg = await publicClient.readContract({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: "getLeg",
        args: [legId],
      });

      const canResolve = await publicClient.readContract({
        address: leg.oracleAdapter as Address,
        abi: ORACLE_ABI,
        functionName: "canResolve",
        args: [legId],
      });

      if (!canResolve) {
        allResolvable = false;
        break;
      }
    }

    if (!allResolvable) continue;

    // All legs resolved -- settle the ticket
    console.log(`[settler] Settling ticket #${id} (${ticket.legIds.length} legs)...`);

    try {
      const hash = await walletClient.writeContract({
        address: engineAddr,
        abi: ENGINE_ABI,
        functionName: "settleTicket",
        args: [BigInt(id)],
        chain: walletClient.chain,
        account: walletClient.account!,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Re-read ticket to get final status
      const updated = await publicClient.readContract({
        address: engineAddr,
        abi: ENGINE_ABI,
        functionName: "getTicket",
        args: [BigInt(id)],
      });

      const statusName = STATUS_NAMES[updated.status] ?? `Unknown(${updated.status})`;
      console.log(
        `[settler] Settled ticket #${id} -> ${statusName} (tx: ${receipt.transactionHash.slice(0, 10)}...)`,
      );
      settled++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't crash on individual ticket failures
      console.error(`[settler] Failed to settle ticket #${id}: ${msg.slice(0, 200)}`);
    }
  }

  if (settled > 0) {
    console.log(`[settler] Settled ${settled} ticket(s) this cycle`);
  }
}

async function main() {
  const cfg = getConfig();
  console.log("[settler] Starting ParlayCity Settler Bot");
  console.log(`[settler] RPC: ${cfg.rpcUrl}`);
  console.log(`[settler] Engine: ${cfg.engineAddr}`);
  console.log(`[settler] Registry: ${cfg.registryAddr}`);
  console.log(`[settler] Poll interval: ${cfg.pollInterval}ms`);

  const account = privateKeyToAccount(cfg.privateKey);
  console.log(`[settler] Account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
    account,
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[settler] Shutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    console.log("\n[settler] Shutting down...");
    running = false;
  });

  // Initial poll
  console.log("[settler] Running initial poll...");
  await settle(publicClient, walletClient, cfg.engineAddr, cfg.registryAddr);

  // Poll loop
  while (running) {
    await new Promise((r) => setTimeout(r, cfg.pollInterval));
    if (!running) break;

    const ts = new Date().toISOString();
    console.log(`[settler] [${ts}] Polling...`);
    await settle(publicClient, walletClient, cfg.engineAddr, cfg.registryAddr);
  }

  console.log("[settler] Stopped.");
}

main().catch((err) => {
  console.error("[settler] Fatal:", err);
  process.exit(1);
});
