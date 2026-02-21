/**
 * Autonomous ParlayCity Risk Agent
 *
 * Discovers markets, builds candidate parlays, pays for AI-powered risk
 * assessment via x402 (powered by 0G inference), and makes structured
 * buy/skip decisions.
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/risk-agent.ts
 *   make risk-agent          # same thing
 *   make risk-agent-dry      # DRY_RUN=true
 *
 * Env vars:
 *   SERVICES_URL          -- defaults to http://localhost:3001
 *   RISK_TOLERANCE        -- conservative | moderate | aggressive (default: moderate)
 *   DRY_RUN               -- true to log decisions without buying on-chain (default: true)
 *   LOOP_INTERVAL_MS      -- ms between cycles, 0 for single run (default: 30000)
 *   ONCE                  -- true for single run (default: false)
 *   MAX_STAKE_USDC        -- human-readable max stake per ticket (default: 10)
 *   MAX_LEGS              -- max legs per parlay candidate (default: 3)
 *   MAX_CANDIDATES        -- max candidates to evaluate per cycle (default: 5)
 *   CONFIDENCE_THRESHOLD  -- min confidence to buy (default: 0.6)
 *   AGENT_BANKROLL        -- USDC bankroll for Kelly sizing (default: 1000)
 *   AGENT_PAYOUT_MODE     -- 0=CLASSIC, 1=PROGRESSIVE, 2=EARLY_CASHOUT (default: 0)
 *
 * On-chain (only when DRY_RUN=false):
 *   RPC_URL               -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY           -- defaults to Anvil account #1
 *   PARLAY_ENGINE_ADDRESS -- overrides .env.local
 *   USDC_ADDRESS          -- overrides .env.local
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  decodeEventLog,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

import { loadEnvLocal, requireExplicitKeyForRemoteRpc, safeBigIntToNumber, safeParseNumber } from "./lib/env";
import type { AgentQuoteResponse, AiInsight } from "@parlaycity/shared";

// -- ABI fragments (on-chain, only used when DRY_RUN=false) -----------------

const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const ENGINE_ABI = parseAbi([
  "function buyTicketWithMode(uint256[] legIds, bytes32[] outcomes, uint256 stake, uint8 payoutMode) returns (uint256 ticketId)",
  "function getTicket(uint256 ticketId) view returns ((address buyer, uint256 stake, uint256[] legIds, bytes32[] outcomes, uint256 multiplierX1e6, uint256 potentialPayout, uint256 feePaid, uint8 mode, uint8 status, uint256 createdAt, uint8 payoutMode, uint256 claimedAmount, uint256 cashoutPenaltyBps))",
  "function ticketCount() view returns (uint256)",
  "event TicketPurchased(uint256 indexed ticketId, address indexed buyer, uint256[] legIds, bytes32[] outcomes, uint256 stake, uint256 multiplierX1e6, uint256 potentialPayout, uint8 mode, uint8 payoutMode)",
]);

// -- Types ------------------------------------------------------------------

interface MarketLeg {
  id: number;
  question: string;
  probabilityPPM: number;
  active: boolean;
}

interface MarketResponse {
  id: string;
  title: string;
  category: string;
  legs: MarketLeg[];
}

interface DecisionLog {
  timestamp: string;
  cycle: number;
  candidate: number;
  legIds: number[];
  outcomes: string[];
  action: string;
  confidence: number;
  suggestedStake: string;
  expectedValue: number;
  kellyFraction: number;
  reasoning: string;
  warnings: string[];
  aiInsight?: AiInsight;
  dryRun: boolean;
  ticketId?: number;
}

// -- Config -----------------------------------------------------------------

const PAYOUT_MODE_NAMES: Record<number, string> = {
  0: "CLASSIC",
  1: "PROGRESSIVE",
  2: "EARLY_CASHOUT",
};

const YES_OUTCOME = "0x0000000000000000000000000000000000000000000000000000000000000001" as const;

function getConfig() {
  const servicesUrl = process.env.SERVICES_URL ?? "http://localhost:3001";

  const VALID_TOLERANCES = ["conservative", "moderate", "aggressive"] as const;
  type RiskTolerance = (typeof VALID_TOLERANCES)[number];
  const rawTolerance = process.env.RISK_TOLERANCE ?? "moderate";
  const riskTolerance: RiskTolerance = VALID_TOLERANCES.includes(rawTolerance as RiskTolerance)
    ? (rawTolerance as RiskTolerance)
    : "moderate";

  const dryRun = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
  const loopIntervalMs = Math.max(0, safeParseNumber(process.env.LOOP_INTERVAL_MS, 30000, "LOOP_INTERVAL_MS"));
  const once = (process.env.ONCE ?? "false").toLowerCase() === "true" || loopIntervalMs === 0;
  const maxStakeUsdc = safeParseNumber(process.env.MAX_STAKE_USDC, 10, "MAX_STAKE_USDC");
  const maxLegs = Math.min(
    Math.max(Math.floor(safeParseNumber(process.env.MAX_LEGS, 3, "MAX_LEGS")), 2),
    5,
  );
  const maxCandidates = Math.min(
    Math.max(Math.floor(safeParseNumber(process.env.MAX_CANDIDATES, 5, "MAX_CANDIDATES")), 1),
    20,
  );
  const confidenceThreshold = Math.min(1, Math.max(0, safeParseNumber(process.env.CONFIDENCE_THRESHOLD, 0.6, "CONFIDENCE_THRESHOLD")));

  const rawBankroll = process.env.AGENT_BANKROLL ?? "1000";
  const bankroll = isNaN(Number(rawBankroll)) || Number(rawBankroll) <= 0 ? "1000" : rawBankroll;
  const payoutModeRaw = Number(process.env.AGENT_PAYOUT_MODE ?? "0");
  const payoutMode = [0, 1, 2].includes(payoutModeRaw) ? payoutModeRaw : 0;
  const demoForceBuy = (process.env.DEMO_FORCE_BUY ?? "false").toLowerCase() === "true";

  return {
    servicesUrl,
    riskTolerance,
    dryRun,
    loopIntervalMs,
    once,
    maxStakeUsdc,
    maxLegs,
    maxCandidates,
    confidenceThreshold,
    bankroll,
    payoutMode,
    demoForceBuy,
  };
}

/** On-chain config -- only resolved when DRY_RUN=false */
function getOnChainConfig() {
  const envLocal = loadEnvLocal();
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  requireExplicitKeyForRemoteRpc(rpcUrl);

  const privateKey = (process.env.PRIVATE_KEY ??
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d") as `0x${string}`;

  const engineAddr = (process.env.PARLAY_ENGINE_ADDRESS ??
    envLocal.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ??
    "") as Address;
  const usdcAddr = (process.env.USDC_ADDRESS ??
    envLocal.NEXT_PUBLIC_USDC_ADDRESS ??
    "") as Address;

  if (!engineAddr) throw new Error("Missing PARLAY_ENGINE_ADDRESS");
  if (!usdcAddr) throw new Error("Missing USDC_ADDRESS");

  const chain: Chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  return { rpcUrl, privateKey, engineAddr, usdcAddr, chain };
}

// -- Helpers ----------------------------------------------------------------

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[risk-agent] [${ts}] ${msg}`);
}

function logDecision(decision: DecisionLog) {
  console.log(JSON.stringify(decision));
}

// -- Step 1: Discover markets -----------------------------------------------

async function discoverMarkets(servicesUrl: string): Promise<MarketResponse[]> {
  const res = await fetch(`${servicesUrl}/markets`);
  if (!res.ok) throw new Error(`GET /markets failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as MarketResponse[];
}

// -- Step 2: Build candidate parlays ----------------------------------------

interface ParlayCandidate {
  legIds: number[];
  outcomes: string[];
  questions: string[];
  categories: string[];
}

/**
 * Generate parlay candidates from active legs.
 * Strategy: pick legs from different categories to reduce correlation.
 * Produces combinations of 2..maxLegs legs, capped at maxCandidates.
 */
function buildCandidates(
  markets: MarketResponse[],
  maxLegs: number,
  maxCandidates: number,
): ParlayCandidate[] {
  // Collect active legs grouped by category
  const legsByCategory = new Map<string, (MarketLeg & { category: string })[]>();
  for (const market of markets) {
    for (const leg of market.legs) {
      if (!leg.active) continue;
      const entry = { ...leg, category: market.category };
      const arr = legsByCategory.get(market.category) ?? [];
      arr.push(entry);
      legsByCategory.set(market.category, arr);
    }
  }

  const categories = [...legsByCategory.keys()];
  if (categories.length === 0) return [];

  // For each category, sort legs by probability descending (favor likely legs)
  for (const legs of legsByCategory.values()) {
    legs.sort((a, b) => b.probabilityPPM - a.probabilityPPM);
  }

  const candidates: ParlayCandidate[] = [];

  // Strategy: pick the best leg from each of N different categories.
  // Lazy backtracking avoids materializing all C(n,k) combos up front.
  for (let size = 2; size <= Math.min(maxLegs, categories.length); size++) {
    if (candidates.length >= maxCandidates) break;

    const currentCombo: string[] = [];
    const backtrack = (start: number) => {
      if (candidates.length >= maxCandidates) return;
      if (currentCombo.length === size) {
        const combo = [...currentCombo];
        const legs = combo.map((cat) => {
          const catLegs = legsByCategory.get(cat);
          if (!catLegs || catLegs.length === 0) return null;
          return catLegs[0];
        }).filter((l): l is (MarketLeg & { category: string }) => l !== null);
        if (legs.length !== combo.length) return;
        candidates.push({
          legIds: legs.map((l) => l.id),
          outcomes: legs.map(() => YES_OUTCOME),
          questions: legs.map((l) => l.question),
          categories: combo,
        });
        return;
      }
      for (let i = start; i <= categories.length - (size - currentCombo.length); i++) {
        if (candidates.length >= maxCandidates) return;
        currentCombo.push(categories[i]);
        backtrack(i + 1);
        currentCombo.pop();
      }
    };
    backtrack(0);
  }

  // If we have fewer categories than 2, build from the same category
  if (categories.length === 1) {
    const legs = legsByCategory.get(categories[0]);
    if (legs && legs.length >= 2) {
      candidates.push({
        legIds: legs.slice(0, 2).map((l) => l.id),
        outcomes: legs.slice(0, 2).map(() => YES_OUTCOME),
        questions: legs.slice(0, 2).map((l) => l.question),
        categories: [categories[0], categories[0]],
      });
    }
  }

  return candidates.slice(0, maxCandidates);
}

// -- Step 3: Get risk assessment via x402 -----------------------------------

async function getRiskAssessment(
  servicesUrl: string,
  candidate: ParlayCandidate,
  stakeRaw: string,
  bankrollRaw: string,
  riskTolerance: string,
): Promise<AgentQuoteResponse> {
  const body = {
    legIds: candidate.legIds,
    outcomes: candidate.outcomes,
    stake: stakeRaw,
    bankroll: bankrollRaw,
    riskTolerance,
  };

  const res = await fetch(`${servicesUrl}/premium/agent-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-402-Payment": "agent-bot-demo-payment",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`x402 payment required: ${JSON.stringify(err)}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /premium/agent-quote failed: ${res.status} ${text.slice(0, 300)}`);
  }

  return (await res.json()) as AgentQuoteResponse;
}

// -- Step 4: On-chain buy (only when DRY_RUN=false) -------------------------

async function buyOnChain(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  engineAddr: Address,
  usdcAddr: Address,
  legIds: number[],
  outcomes: string[],
  stakeUsdc: string,
  payoutMode: number,
): Promise<number | undefined> {
  const stakeRaw = parseUnits(stakeUsdc, 6);

  // Check balance
  const balance = await publicClient.readContract({
    address: usdcAddr,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (stakeRaw > balance) {
    log(`Insufficient USDC: need ${stakeUsdc}, have ${formatUnits(balance, 6)}`);
    return undefined;
  }

  // Approve if needed
  const allowance = await publicClient.readContract({
    address: usdcAddr,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account.address, engineAddr],
  });

  if (allowance < stakeRaw) {
    log("Approving USDC spend...");
    const approveTx = await walletClient.writeContract({
      address: usdcAddr,
      abi: USDC_ABI,
      functionName: "approve",
      args: [engineAddr, stakeRaw],
      chain: walletClient.chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  // Buy ticket
  log("Buying parlay ticket on-chain...");
  const buyTx = await walletClient.writeContract({
    address: engineAddr,
    abi: ENGINE_ABI,
    functionName: "buyTicketWithMode",
    args: [legIds.map((id) => BigInt(id)), outcomes as `0x${string}`[], stakeRaw, payoutMode],
    chain: walletClient.chain,
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: buyTx });

  // Parse TicketPurchased event
  for (const logEntry of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: ENGINE_ABI,
        data: logEntry.data,
        topics: logEntry.topics,
      });
      if (decoded.eventName === "TicketPurchased") {
        return safeBigIntToNumber(decoded.args.ticketId, "ticketId");
      }
    } catch {
      // Not our event
    }
  }

  // Fallback
  const ticketCount = await publicClient.readContract({
    address: engineAddr,
    abi: ENGINE_ABI,
    functionName: "ticketCount",
  });
  return safeBigIntToNumber(ticketCount - 1n, "ticketId");
}

// -- Main loop --------------------------------------------------------------

let running = true;

async function runCycle(
  cfg: ReturnType<typeof getConfig>,
  cycle: number,
  onChain?: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: ReturnType<typeof privateKeyToAccount>;
    engineAddr: Address;
    usdcAddr: Address;
  },
) {
  log(`--- Cycle ${cycle} ---`);

  // Step 1: Discover markets
  const markets = await discoverMarkets(cfg.servicesUrl);
  const activeLegs = markets.reduce((n, m) => n + m.legs.filter((l) => l.active).length, 0);
  log(`Found ${markets.length} markets, ${activeLegs} active legs`);

  if (activeLegs < 2) {
    log("Not enough active legs to build a parlay. Skipping cycle.");
    return;
  }

  // Step 2: Build candidates
  const candidates = buildCandidates(markets, cfg.maxLegs, cfg.maxCandidates);
  log(`Built ${candidates.length} candidate parlay(s)`);

  // Use human-readable USDC units (strings) for API -- parseUSDC on server converts to raw
  const stakeHuman = String(cfg.maxStakeUsdc);
  const bankrollHuman = cfg.bankroll;

  // Step 3+4: Evaluate each candidate
  for (let i = 0; i < candidates.length; i++) {
    if (!running) break;

    const candidate = candidates[i];
    log(`Evaluating candidate ${i + 1}/${candidates.length}: legs [${candidate.legIds.join(", ")}]`);

    let assessment: AgentQuoteResponse;
    try {
      assessment = await getRiskAssessment(
        cfg.servicesUrl,
        candidate,
        stakeHuman,
        bankrollHuman,
        cfg.riskTolerance,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Failed to get assessment for candidate ${i + 1}: ${msg}`);
      continue;
    }

    const { risk } = assessment;
    // Demo mode: force-buy first candidate regardless of Kelly (for on-chain demos)
    const forceBuyThisCandidate = cfg.demoForceBuy && i === 0 && cycle === 1;
    const shouldBuy =
      forceBuyThisCandidate ||
      (risk.action === "BUY" && risk.confidence >= cfg.confidenceThreshold);

    // Determine final stake
    const suggestedNum = Number(risk.suggestedStake);
    const finalStake =
      suggestedNum > 0 && suggestedNum < cfg.maxStakeUsdc
        ? risk.suggestedStake
        : String(cfg.maxStakeUsdc);

    // Build structured decision log
    const decision: DecisionLog = {
      timestamp: new Date().toISOString(),
      cycle,
      candidate: i + 1,
      legIds: candidate.legIds,
      outcomes: candidate.outcomes,
      action: shouldBuy ? (forceBuyThisCandidate ? "BUY(DEMO)" : "BUY") : `SKIP(${risk.action})`,
      confidence: risk.confidence,
      suggestedStake: risk.suggestedStake,
      expectedValue: risk.expectedValue,
      kellyFraction: risk.kellyFraction,
      reasoning: risk.reasoning,
      warnings: risk.warnings,
      aiInsight: assessment.aiInsight,
      dryRun: cfg.dryRun,
    };

    if (shouldBuy && !cfg.dryRun && onChain) {
      try {
        const ticketId = await buyOnChain(
          onChain.publicClient,
          onChain.walletClient,
          onChain.account,
          onChain.engineAddr,
          onChain.usdcAddr,
          candidate.legIds,
          candidate.outcomes,
          finalStake,
          cfg.payoutMode,
        );
        if (ticketId !== undefined) {
          decision.ticketId = ticketId;
          log(`Purchased ticket #${ticketId}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`On-chain buy failed: ${msg}`);
      }
    } else if (shouldBuy && cfg.dryRun) {
      log(`DRY RUN: would buy with $${finalStake} USDC (${PAYOUT_MODE_NAMES[cfg.payoutMode]})`);
    }

    logDecision(decision);
  }

  log(`--- Cycle ${cycle} complete ---`);
}

async function main() {
  const cfg = getConfig();

  log("Starting ParlayCity Autonomous Risk Agent");
  log(`Services: ${cfg.servicesUrl}`);
  log(`Risk tolerance: ${cfg.riskTolerance}`);
  log(`Max stake: $${cfg.maxStakeUsdc} USDC | Bankroll: $${cfg.bankroll} USDC`);
  log(`Max legs: ${cfg.maxLegs} | Max candidates/cycle: ${cfg.maxCandidates}`);
  log(`Confidence threshold: ${cfg.confidenceThreshold}`);
  log(`Payout mode: ${PAYOUT_MODE_NAMES[cfg.payoutMode]}`);
  log(`Dry run: ${cfg.dryRun}`);
  log(`Mode: ${cfg.once ? "single run" : `loop (${cfg.loopIntervalMs}ms interval)`}`);

  // Set up on-chain clients only when needed
  let onChain:
    | {
        publicClient: PublicClient;
        walletClient: WalletClient;
        account: ReturnType<typeof privateKeyToAccount>;
        engineAddr: Address;
        usdcAddr: Address;
      }
    | undefined;

  if (!cfg.dryRun) {
    const oc = getOnChainConfig();
    const account = privateKeyToAccount(oc.privateKey);
    log(`On-chain mode: RPC=${oc.rpcUrl} Engine=${oc.engineAddr} Account=${account.address}`);

    const publicClient = createPublicClient({ chain: oc.chain, transport: http(oc.rpcUrl) });
    const walletClient = createWalletClient({
      chain: oc.chain,
      transport: http(oc.rpcUrl),
      account,
    });

    onChain = {
      publicClient: publicClient as PublicClient,
      walletClient: walletClient as WalletClient,
      account,
      engineAddr: oc.engineAddr,
      usdcAddr: oc.usdcAddr,
    };
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    log("Shutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    log("Shutting down...");
    running = false;
  });

  let cycle = 1;

  // Run first cycle
  await runCycle(cfg, cycle, onChain);

  if (cfg.once) {
    log("Single-run mode. Exiting.");
    return;
  }

  // Loop
  while (running) {
    await new Promise((r) => setTimeout(r, cfg.loopIntervalMs));
    if (!running) break;
    cycle++;
    try {
      await runCycle(cfg, cycle, onChain);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Cycle ${cycle} failed: ${msg}`);
    }
  }

  log("Stopped.");
}

main().catch((err) => {
  console.error("[risk-agent] Fatal:", err);
  process.exit(1);
});
