/**
 * Market Discovery Agent -- discovers real NBA games from BallDontLie,
 * registers them as bettable legs on-chain, and auto-resolves completed games.
 *
 * Humans make all betting decisions. This agent handles market infrastructure.
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/market-agent.ts
 *   make market-agent           # local Anvil
 *   make market-agent-sepolia   # Base Sepolia
 *
 * Env vars (or reads from apps/web/.env.local):
 *   RPC_URL               -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY           -- defaults to Anvil account #0 (local only)
 *   BDL_API_KEY           -- (required) BallDontLie API key
 *   LEG_REGISTRY_ADDRESS  -- overrides .env.local
 *   ADMIN_ORACLE_ADDRESS  -- overrides .env.local
 *   POLL_INTERVAL_MS      -- defaults to 60000 (60s)
 *   LOOKBACK_DAYS         -- how far back to check results (default: 3)
 *   DRY_RUN               -- log without on-chain writes (default: false)
 *   ONCE                  -- single run then exit (default: false)
 *   SERVICES_URL          -- defaults to http://localhost:3001
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

import { loadEnvLocal, requireExplicitKeyForRemoteRpc, safeBigIntToNumber, safeParseNumber } from "./lib/env";
import { fetchNBAMarkets, fetchCompletedGames, isBDLEnabled } from "../packages/services/src/catalog/bdl";

// -- ABI fragments -----------------------------------------------------------

const REGISTRY_ABI = parseAbi([
  "function legCount() view returns (uint256)",
  "function getLeg(uint256 legId) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
  "function createLeg(string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM)",
]);

const ORACLE_ABI = parseAbi([
  "function getStatus(uint256 legId) view returns (uint8 status, bytes32 outcome)",
  "function resolve(uint256 legId, uint8 status, bytes32 outcome)",
]);

// -- Outcome encoding (matches demo-autopilot.ts) ----------------------------

const YES_OUTCOME = keccak256(toHex("Yes"));
const NO_OUTCOME = keccak256(toHex("No"));

// LegStatus enum from AdminOracleAdapter
const LegStatus = { Pending: 0, Won: 1, Lost: 2, Voided: 3 } as const;

// -- Structured logging ------------------------------------------------------

interface MarketAgentLog {
  timestamp: string;
  cycle: number;
  action: "DISCOVER" | "REGISTER" | "RESOLVE" | "SKIP" | "X402_RISK";
  gameId?: number;
  legId?: number;
  detail: string;
  dryRun: boolean;
  txHash?: string;
  aiInsight?: { model: string; verified: boolean; analysis: string };
}

function emitLog(entry: MarketAgentLog) {
  console.log(JSON.stringify(entry));
}

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[market-agent] [${ts}] ${msg}`);
}

// -- Helpers -----------------------------------------------------------------

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// -- Config ------------------------------------------------------------------

function getConfig() {
  const envLocal = loadEnvLocal();

  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  requireExplicitKeyForRemoteRpc(rpcUrl);

  const privateKey = (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

  const registryAddr = (process.env.LEG_REGISTRY_ADDRESS ??
    envLocal.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ??
    "") as Address;

  const adminOracleAddr = (process.env.ADMIN_ORACLE_ADDRESS ??
    envLocal.NEXT_PUBLIC_ADMIN_ORACLE_ADDRESS ??
    "") as Address;

  if (!registryAddr) throw new Error("Missing LEG_REGISTRY_ADDRESS");
  if (!adminOracleAddr) throw new Error("Missing ADMIN_ORACLE_ADDRESS");

  const chain: Chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  const pollInterval = safeParseNumber(process.env.POLL_INTERVAL_MS, 60000, "POLL_INTERVAL_MS");
  const lookbackDays = safeParseNumber(process.env.LOOKBACK_DAYS, 3, "LOOKBACK_DAYS");
  const dryRun = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
  const once = (process.env.ONCE ?? "false").toLowerCase() === "true";
  const servicesUrl = process.env.SERVICES_URL ?? "http://localhost:3001";

  return { rpcUrl, privateKey, registryAddr, adminOracleAddr, chain, pollInterval, lookbackDays, dryRun, once, servicesUrl };
}

// -- Read on-chain legs into lookup maps -------------------------------------

async function buildOnChainMaps(publicClient: PublicClient, registryAddr: Address) {
  const legCount = safeBigIntToNumber(
    await publicClient.readContract({
      address: registryAddr,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    }),
    "legCount",
  );

  const questionMap = new Map<string, number>(); // normalized question -> legId
  const sourceRefMap = new Map<string, number>(); // sourceRef -> legId

  for (let i = 0; i < legCount; i++) {
    const leg = await publicClient.readContract({
      address: registryAddr,
      abi: REGISTRY_ABI,
      functionName: "getLeg",
      args: [BigInt(i)],
    });
    questionMap.set(normalize(leg.question), i);
    if (leg.sourceRef) {
      sourceRefMap.set(leg.sourceRef, i);
    }
  }

  return { legCount, questionMap, sourceRefMap };
}

// -- Phase A: Discovery ------------------------------------------------------

async function discover(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  registryAddr: Address,
  adminOracleAddr: Address,
  questionMap: Map<string, number>,
  cycle: number,
  dryRun: boolean,
  chain: Chain,
): Promise<number> {
  const markets = await fetchNBAMarkets();
  if (markets.length === 0) {
    log("No NBA markets from BDL (API disabled or no upcoming games)");
    return 0;
  }

  emitLog({
    timestamp: new Date().toISOString(),
    cycle,
    action: "DISCOVER",
    detail: `Found ${markets.length} NBA markets from BDL`,
    dryRun,
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffGuardSec = 30 * 60; // 30 minutes

  // Collect legs to register
  const toRegister: Array<{
    question: string;
    sourceRef: string;
    cutoffTime: number;
    earliestResolve: number;
    probabilityPPM: number;
    gameId?: number;
  }> = [];

  for (const market of markets) {
    for (const leg of market.legs) {
      const normalizedQ = normalize(leg.question);

      // Already registered
      if (questionMap.has(normalizedQ)) {
        emitLog({
          timestamp: new Date().toISOString(),
          cycle,
          action: "SKIP",
          detail: `Already registered: "${leg.question.slice(0, 50)}..."`,
          dryRun,
        });
        continue;
      }

      // Cutoff guard: skip games starting within 30 min
      if (leg.cutoffTime > 0 && leg.cutoffTime - nowSec < cutoffGuardSec) {
        emitLog({
          timestamp: new Date().toISOString(),
          cycle,
          action: "SKIP",
          detail: `Too close to cutoff (${Math.round((leg.cutoffTime - nowSec) / 60)}min): "${leg.question.slice(0, 50)}..."`,
          dryRun,
        });
        continue;
      }

      toRegister.push({
        question: leg.question,
        sourceRef: leg.sourceRef,
        cutoffTime: leg.cutoffTime > nowSec ? leg.cutoffTime : nowSec + 7 * 24 * 3600,
        earliestResolve: leg.earliestResolve > leg.cutoffTime ? leg.earliestResolve : leg.cutoffTime + 4 * 3600,
        probabilityPPM: leg.probabilityPPM,
        gameId: Number(market.id.replace("nba-", "")),
      });
    }
  }

  if (toRegister.length === 0) {
    log("No new legs to register");
    return 0;
  }

  if (dryRun) {
    for (const leg of toRegister) {
      emitLog({
        timestamp: new Date().toISOString(),
        cycle,
        action: "REGISTER",
        gameId: leg.gameId,
        detail: `DRY RUN: would register "${leg.question.slice(0, 60)}..."`,
        dryRun: true,
      });
    }
    return toRegister.length;
  }

  // Explicit nonce management for batch registrations
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  let registered = 0;

  for (const leg of toRegister) {
    log(`Registering: "${leg.question.slice(0, 60)}..." (nonce: ${nonce})`);

    try {
      const hash = await walletClient.writeContract({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: "createLeg",
        args: [
          leg.question,
          leg.sourceRef,
          BigInt(leg.cutoffTime),
          BigInt(leg.earliestResolve),
          adminOracleAddr,
          BigInt(leg.probabilityPPM),
        ],
        nonce,
        chain,
        account,
      });

      nonce++;
      await publicClient.waitForTransactionReceipt({ hash });

      // Derive actual on-chain ID
      const legCountAfter = safeBigIntToNumber(
        await publicClient.readContract({
          address: registryAddr,
          abi: REGISTRY_ABI,
          functionName: "legCount",
        }),
        "legCountAfter",
      );
      const newId = legCountAfter - 1;
      questionMap.set(normalize(leg.question), newId);

      emitLog({
        timestamp: new Date().toISOString(),
        cycle,
        action: "REGISTER",
        gameId: leg.gameId,
        legId: newId,
        detail: `Registered leg #${newId}: "${leg.question.slice(0, 50)}..."`,
        dryRun: false,
        txHash: hash,
      });
      registered++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Failed to register leg: ${msg.slice(0, 200)}`);
    }
  }

  log(`Registered ${registered}/${toRegister.length} new legs`);
  return registered;
}

// -- x402 Risk Assessment (pays for AI insight before resolving) -------------

interface X402RiskResult {
  confidence: number;
  action: string;
  reasoning: string;
  aiInsight?: { model: string; verified: boolean; analysis: string };
}

/**
 * Call the x402-gated /premium/agent-quote endpoint to get AI-powered
 * risk assessment before resolving a game. This demonstrates the agent
 * paying for intelligence via x402 protocol (USDC on Base Sepolia).
 *
 * If 0G inference is available (ZG_PRIVATE_KEY set on services), the
 * response includes verified AI analysis from the 0G compute network.
 */
async function getX402RiskAssessment(
  servicesUrl: string,
  legIds: number[],
  cycle: number,
): Promise<X402RiskResult | null> {
  try {
    const body = {
      legIds,
      outcomes: legIds.map(() => "0x0000000000000000000000000000000000000000000000000000000000000001"),
      stake: "1",
      bankroll: "1000",
      riskTolerance: "moderate",
    };

    const res = await fetch(`${servicesUrl}/premium/agent-quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-402-Payment": "market-agent-resolution-payment",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 402) {
      log("x402 payment required for risk assessment (expected in production)");
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      log(`x402 risk assessment failed: ${res.status} ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as {
      risk: { confidence: number; action: string; reasoning: string };
      aiInsight?: { model: string; verified: boolean; analysis: string };
    };

    emitLog({
      timestamp: new Date().toISOString(),
      cycle,
      action: "X402_RISK",
      detail: `x402 risk assessment: action=${data.risk.action} confidence=${data.risk.confidence.toFixed(2)}${data.aiInsight ? ` [0G: ${data.aiInsight.model}, verified=${data.aiInsight.verified}]` : ""}`,
      dryRun: false,
      aiInsight: data.aiInsight,
    });

    return {
      confidence: data.risk.confidence,
      action: data.risk.action,
      reasoning: data.risk.reasoning,
      aiInsight: data.aiInsight,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`x402 risk assessment unavailable: ${msg.slice(0, 200)}`);
    return null;
  }
}

// -- Phase B: Resolution -----------------------------------------------------

async function resolve(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  registryAddr: Address,
  sourceRefMap: Map<string, number>,
  cycle: number,
  dryRun: boolean,
  chain: Chain,
  lookbackDays: number,
  servicesUrl: string,
): Promise<number> {
  const completedGames = await fetchCompletedGames(lookbackDays);
  if (completedGames.length === 0) {
    log("No completed games to resolve");
    return 0;
  }

  emitLog({
    timestamp: new Date().toISOString(),
    cycle,
    action: "DISCOVER",
    detail: `Found ${completedGames.length} completed NBA games`,
    dryRun,
  });

  // Collect leg IDs that need resolution for x402 risk assessment
  const pendingLegIds: number[] = [];
  for (const game of completedGames) {
    const mlId = sourceRefMap.get(game.sourceRefMoneyline);
    if (mlId !== undefined) pendingLegIds.push(mlId);
    const ouId = sourceRefMap.get(game.sourceRefOU);
    if (ouId !== undefined) pendingLegIds.push(ouId);
  }

  // Pay for x402 risk assessment before resolving (0G AI insight if available)
  if (pendingLegIds.length > 0) {
    // Use first 2 legs for the assessment (agent-quote requires 2-5 legs)
    const assessLegIds = pendingLegIds.slice(0, Math.max(2, Math.min(5, pendingLegIds.length)));
    await getX402RiskAssessment(servicesUrl, assessLegIds, cycle);
  }

  let resolved = 0;
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });

  for (const game of completedGames) {
    // -- Moneyline resolution --
    const mlLegId = sourceRefMap.get(game.sourceRefMoneyline);
    if (mlLegId !== undefined) {
      const result = await tryResolveleg(
        publicClient, walletClient, account, registryAddr,
        mlLegId, game, "moneyline", cycle, dryRun, chain, nonce,
      );
      if (result.resolved) { resolved++; nonce = result.nonce; }
      else { nonce = result.nonce; }
    }

    // -- Over/Under resolution --
    const ouLegId = sourceRefMap.get(game.sourceRefOU);
    if (ouLegId !== undefined) {
      const result = await tryResolveleg(
        publicClient, walletClient, account, registryAddr,
        ouLegId, game, "ou", cycle, dryRun, chain, nonce,
      );
      if (result.resolved) { resolved++; nonce = result.nonce; }
      else { nonce = result.nonce; }
    }
  }

  if (resolved > 0) {
    log(`Resolved ${resolved} leg(s) this cycle`);
  }
  return resolved;
}

async function tryResolveleg(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  registryAddr: Address,
  legId: number,
  game: Awaited<ReturnType<typeof fetchCompletedGames>>[number],
  type: "moneyline" | "ou",
  cycle: number,
  dryRun: boolean,
  chain: Chain,
  nonce: number,
): Promise<{ resolved: boolean; nonce: number }> {
  // Read leg to get oracle adapter
  const leg = await publicClient.readContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "getLeg",
    args: [BigInt(legId)],
  });

  const oracleAddr = leg.oracleAdapter as Address;

  // Check if already resolved
  const [currentStatus] = await publicClient.readContract({
    address: oracleAddr,
    abi: ORACLE_ABI,
    functionName: "getStatus",
    args: [BigInt(legId)],
  });

  if (currentStatus !== LegStatus.Pending) {
    emitLog({
      timestamp: new Date().toISOString(),
      cycle,
      action: "SKIP",
      legId,
      gameId: game.gameId,
      detail: `Already resolved (status=${currentStatus})`,
      dryRun,
    });
    return { resolved: false, nonce };
  }

  // Determine outcome
  let status: number;
  let outcome: `0x${string}`;
  let detail: string;

  if (type === "moneyline") {
    if (game.homeScore > game.awayScore) {
      status = LegStatus.Won;
      outcome = YES_OUTCOME;
      detail = `${game.homeTeam} beat ${game.awayTeam} ${game.homeScore}-${game.awayScore} -> Won (Yes)`;
    } else if (game.homeScore < game.awayScore) {
      status = LegStatus.Lost;
      outcome = NO_OUTCOME;
      detail = `${game.homeTeam} lost to ${game.awayTeam} ${game.homeScore}-${game.awayScore} -> Lost (No)`;
    } else {
      status = LegStatus.Voided;
      outcome = NO_OUTCOME;
      detail = `${game.homeTeam} tied ${game.awayTeam} ${game.homeScore}-${game.awayScore} -> Voided`;
    }
  } else {
    // O/U: parse line from question text
    const lineMatch = leg.question.match(/over\s+([\d.]+)/i);
    const line = lineMatch ? parseFloat(lineMatch[1]) : 0;
    const total = game.homeScore + game.awayScore;

    if (line === 0) {
      log(`Could not parse O/U line from question: "${leg.question}"`);
      return { resolved: false, nonce };
    }

    if (total > line) {
      status = LegStatus.Won;
      outcome = YES_OUTCOME;
      detail = `Total ${total} > line ${line} -> Won (Over)`;
    } else {
      status = LegStatus.Lost;
      outcome = NO_OUTCOME;
      detail = `Total ${total} <= line ${line} -> Lost (Under)`;
    }
  }

  if (dryRun) {
    emitLog({
      timestamp: new Date().toISOString(),
      cycle,
      action: "RESOLVE",
      legId,
      gameId: game.gameId,
      detail: `DRY RUN: ${detail}`,
      dryRun: true,
    });
    return { resolved: true, nonce };
  }

  // Resolve on-chain
  try {
    const hash = await walletClient.writeContract({
      address: oracleAddr,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [BigInt(legId), status, outcome],
      nonce,
      chain,
      account,
    });

    nonce++;
    await publicClient.waitForTransactionReceipt({ hash });

    emitLog({
      timestamp: new Date().toISOString(),
      cycle,
      action: "RESOLVE",
      legId,
      gameId: game.gameId,
      detail,
      dryRun: false,
      txHash: hash,
    });
    return { resolved: true, nonce };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Failed to resolve leg #${legId}: ${msg.slice(0, 200)}`);
    return { resolved: false, nonce };
  }
}

// -- Main loop ---------------------------------------------------------------

let running = true;

async function runCycle(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  cfg: ReturnType<typeof getConfig>,
  cycle: number,
) {
  log(`--- Cycle ${cycle} ---`);

  // Build fresh on-chain maps each cycle
  const { questionMap, sourceRefMap } = await buildOnChainMaps(publicClient, cfg.registryAddr);
  log(`On-chain: ${questionMap.size} legs indexed`);

  // Phase A: Discover and register new legs
  await discover(
    publicClient, walletClient, account,
    cfg.registryAddr, cfg.adminOracleAddr,
    questionMap, cycle, cfg.dryRun, cfg.chain,
  );

  // Rebuild sourceRefMap after registration (new legs may have been added)
  const updated = await buildOnChainMaps(publicClient, cfg.registryAddr);

  // Phase B: Resolve completed games (with x402 risk assessment + 0G AI)
  await resolve(
    publicClient, walletClient, account,
    cfg.registryAddr, updated.sourceRefMap,
    cycle, cfg.dryRun, cfg.chain, cfg.lookbackDays, cfg.servicesUrl,
  );

  log(`--- Cycle ${cycle} complete ---`);
}

async function main() {
  // Validate BDL_API_KEY before anything else
  if (!isBDLEnabled()) {
    console.error("[market-agent] BDL_API_KEY is not set. Cannot discover NBA markets.");
    process.exit(1);
  }

  const cfg = getConfig();

  log("Starting ParlayCity Market Discovery Agent");
  log(`RPC: ${cfg.rpcUrl}`);
  log(`Registry: ${cfg.registryAddr}`);
  log(`AdminOracle: ${cfg.adminOracleAddr}`);
  log(`Services: ${cfg.servicesUrl} (x402 risk + 0G AI)`);
  log(`Poll interval: ${cfg.pollInterval}ms`);
  log(`Lookback days: ${cfg.lookbackDays}`);
  log(`Dry run: ${cfg.dryRun}`);
  log(`Mode: ${cfg.once ? "single run" : "loop"}`);

  const account = privateKeyToAccount(cfg.privateKey);
  log(`Account: ${account.address}`);

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
    log("Shutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    log("Shutting down...");
    running = false;
  });

  // Run first cycle
  await runCycle(publicClient, walletClient, account, cfg, 1);

  if (cfg.once) {
    log("Single-run mode. Exiting.");
    return;
  }

  // Poll loop
  let cycle = 1;
  while (running) {
    await new Promise((r) => setTimeout(r, cfg.pollInterval));
    if (!running) break;
    cycle++;
    try {
      await runCycle(publicClient, walletClient, account, cfg, cycle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Cycle ${cycle} failed: ${msg}`);
    }
  }

  log("Stopped.");
}

main().catch((err) => {
  console.error("[market-agent] Fatal:", err);
  process.exit(1);
});
