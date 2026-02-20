/**
 * Risk Agent -- autonomous agent that discovers markets, assesses risk via
 * x402-gated API, and buys parlay tickets when conditions are favorable.
 *
 * Demonstrates the full x402 agent loop:
 *   1. GET /markets to discover available legs
 *   2. Select 2-3 legs with favorable probabilities
 *   3. POST /premium/agent-quote with x402 payment header
 *   4. Parse risk assessment (Kelly fraction, EV, confidence)
 *   5. If favorable: approve USDC + call buyTicketWithMode on-chain
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/risk-agent.ts
 *
 * Env vars (or reads from apps/web/.env.local):
 *   RPC_URL               -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY           -- defaults to Anvil account #1
 *   PARLAY_ENGINE_ADDRESS -- overrides .env.local
 *   USDC_ADDRESS          -- overrides .env.local
 *   SERVICES_URL          -- defaults to http://localhost:3001
 *   AGENT_BANKROLL        -- USDC bankroll for Kelly sizing (default: 1000)
 *   AGENT_RISK_TOLERANCE  -- conservative | moderate | aggressive (default: moderate)
 *   AGENT_STAKE           -- USDC stake per ticket (default: 5)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

// -- ABI fragments --------------------------------------------------------

const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const ENGINE_ABI = parseAbi([
  "function buyTicketWithMode(uint256[] legIds, bytes32[] outcomes, uint256 stake, uint8 payoutMode) returns (uint256 ticketId)",
  "function getTicket(uint256 ticketId) view returns ((address buyer, uint256 stake, uint256[] legIds, bytes32[] outcomes, uint256 multiplierX1e6, uint256 potentialPayout, uint256 feePaid, uint8 mode, uint8 status, uint256 createdAt, uint8 payoutMode, uint256 claimedAmount, uint256 cashoutPenaltyBps))",
  "function ticketCount() view returns (uint256)",
]);

// -- Types ----------------------------------------------------------------

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

interface AgentQuoteResponse {
  quote: {
    multiplierX1e6: string;
    potentialPayout: string;
    feePaid: string;
    edgeBps: number;
    valid: boolean;
    reason?: string;
  };
  risk: {
    action: string;
    suggestedStake: string;
    kellyFraction: number;
    winProbability: number;
    expectedValue: number;
    confidence: number;
    reasoning: string;
    warnings: string[];
    fairMultiplier: number;
    netMultiplier: number;
    edgeBps: number;
  };
}

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
  // Default to Anvil account #1 (account #0 is the deployer/owner)
  const privateKey = (process.env.PRIVATE_KEY ??
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d") as `0x${string}`;

  const engineAddr = (process.env.PARLAY_ENGINE_ADDRESS ??
    envLocal.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ??
    "") as Address;
  const usdcAddr = (process.env.USDC_ADDRESS ??
    envLocal.NEXT_PUBLIC_USDC_ADDRESS ??
    "") as Address;

  const servicesUrl = process.env.SERVICES_URL ?? "http://localhost:3001";
  const bankroll = process.env.AGENT_BANKROLL ?? "1000";
  const riskTolerance = (process.env.AGENT_RISK_TOLERANCE ?? "moderate") as
    | "conservative"
    | "moderate"
    | "aggressive";
  const stake = process.env.AGENT_STAKE ?? "5";

  if (!engineAddr) throw new Error("Missing PARLAY_ENGINE_ADDRESS");
  if (!usdcAddr) throw new Error("Missing USDC_ADDRESS");

  const chain: Chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  return { rpcUrl, privateKey, engineAddr, usdcAddr, servicesUrl, bankroll, riskTolerance, stake, chain };
}

// -- Helpers --------------------------------------------------------------

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[agent] [${ts}] ${msg}`);
}

// -- Step 1: Discover markets ---------------------------------------------

async function discoverMarkets(servicesUrl: string): Promise<MarketResponse[]> {
  log("Discovering markets...");
  const res = await fetch(`${servicesUrl}/markets`);
  if (!res.ok) throw new Error(`GET /markets failed: ${res.status} ${res.statusText}`);
  const markets = (await res.json()) as MarketResponse[];
  log(`Found ${markets.length} markets with ${markets.reduce((n, m) => n + m.legs.length, 0)} total legs`);
  return markets;
}

// -- Step 2: Select favorable legs ----------------------------------------

function selectLegs(markets: MarketResponse[]): { legIds: number[]; outcomes: string[]; questions: string[] } {
  // Collect all active legs, sorted by probability (higher = more likely to win)
  const allLegs: (MarketLeg & { category: string })[] = [];
  for (const market of markets) {
    for (const leg of market.legs) {
      if (leg.active) {
        allLegs.push({ ...leg, category: market.category });
      }
    }
  }

  // Sort by probability descending (favor higher-probability legs for demo)
  allLegs.sort((a, b) => b.probabilityPPM - a.probabilityPPM);

  // Pick top 2-3 legs from different categories to reduce correlation
  const selected: typeof allLegs = [];
  const usedCategories = new Set<string>();

  for (const leg of allLegs) {
    if (selected.length >= 3) break;
    // Prefer diversified categories, but allow same category if needed
    if (!usedCategories.has(leg.category) || selected.length < 2) {
      selected.push(leg);
      usedCategories.add(leg.category);
    }
  }

  // Ensure we have at least 2 legs
  if (selected.length < 2) {
    // Fall back to just the first 2 active legs
    const fallback = allLegs.slice(0, 2);
    if (fallback.length < 2) throw new Error("Not enough active legs to build a parlay");
    selected.length = 0;
    selected.push(...fallback);
  }

  const legIds = selected.map((l) => l.id);
  // Bet "Yes" on all legs (outcome = 0x01 padded to bytes32)
  const outcomes = selected.map(() =>
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  );
  const questions = selected.map(
    (l) => `  Leg ${l.id}: "${l.question}" (prob: ${(l.probabilityPPM / 10000).toFixed(1)}%)`,
  );

  log(`Selected ${selected.length} legs:`);
  for (const q of questions) log(q);

  return { legIds, outcomes, questions };
}

// -- Step 3: Get risk assessment via x402 ---------------------------------

async function getRiskAssessment(
  servicesUrl: string,
  legIds: number[],
  outcomes: string[],
  stake: string,
  bankroll: string,
  riskTolerance: string,
): Promise<AgentQuoteResponse> {
  log("Requesting x402-gated risk assessment...");

  const body = { legIds, outcomes, stake, bankroll, riskTolerance };

  const res = await fetch(`${servicesUrl}/premium/agent-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // In dev/test mode, any non-empty X-402-Payment header works
      "X-402-Payment": "agent-bot-demo-payment",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    const err = await res.json();
    log("x402 payment required (expected in production):");
    log(JSON.stringify(err, null, 2));
    throw new Error("x402 payment required -- set up real payment for production");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /premium/agent-quote failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as AgentQuoteResponse;

  log("Risk assessment received:");
  log(`  Action: ${data.risk.action}`);
  log(`  Kelly fraction: ${(data.risk.kellyFraction * 100).toFixed(2)}%`);
  log(`  Win probability: ${(data.risk.winProbability * 100).toFixed(2)}%`);
  log(`  Expected value: $${data.risk.expectedValue.toFixed(2)}`);
  log(`  Confidence: ${(data.risk.confidence * 100).toFixed(0)}%`);
  log(`  Suggested stake: $${data.risk.suggestedStake}`);
  log(`  Fair multiplier: ${data.risk.fairMultiplier}x`);
  log(`  Net multiplier: ${data.risk.netMultiplier}x`);
  log(`  Reasoning: ${data.risk.reasoning}`);
  if (data.risk.warnings.length > 0) {
    log(`  Warnings: ${data.risk.warnings.join("; ")}`);
  }

  return data;
}

// -- Step 4+5: Decide and buy ticket --------------------------------------

async function main() {
  const cfg = getConfig();
  log("Starting ParlayCity Risk Agent");
  log(`RPC: ${cfg.rpcUrl}`);
  log(`Engine: ${cfg.engineAddr}`);
  log(`USDC: ${cfg.usdcAddr}`);
  log(`Services: ${cfg.servicesUrl}`);
  log(`Bankroll: $${cfg.bankroll} | Stake: $${cfg.stake} | Risk: ${cfg.riskTolerance}`);

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

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: cfg.usdcAddr,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  log(`USDC balance: ${formatUnits(balance, 6)} USDC`);

  if (balance === 0n) {
    log("No USDC balance. Fund the account first (deploy script mints to Anvil accounts).");
    process.exit(1);
  }

  // Step 1: Discover markets
  const markets = await discoverMarkets(cfg.servicesUrl);

  // Step 2: Select legs
  const { legIds, outcomes } = selectLegs(markets);

  // Step 3: Get risk assessment
  const assessment = await getRiskAssessment(
    cfg.servicesUrl,
    legIds,
    outcomes,
    cfg.stake,
    cfg.bankroll,
    cfg.riskTolerance,
  );

  // Step 4: Decision
  const { risk } = assessment;
  const shouldBuy =
    risk.action === "BUY" ||
    (risk.action === "REDUCE_STAKE" && risk.kellyFraction > 0 && risk.expectedValue > -0.5);

  if (!shouldBuy) {
    log(`Decision: SKIP -- agent recommends ${risk.action}`);
    log("Risk agent complete (no ticket purchased).");
    return;
  }

  // Use suggested stake if available and less than our configured stake
  const suggestedNum = Number(risk.suggestedStake);
  const configuredNum = Number(cfg.stake);
  const finalStake = suggestedNum > 0 && suggestedNum < configuredNum ? risk.suggestedStake : cfg.stake;

  log(`Decision: BUY with $${finalStake} USDC`);

  // Step 5: Approve USDC + buy ticket on-chain
  const stakeRaw = parseUnits(finalStake, 6);

  if (stakeRaw > balance) {
    log(`Insufficient USDC: need ${finalStake}, have ${formatUnits(balance, 6)}`);
    process.exit(1);
  }

  // Check and set allowance
  const allowance = await publicClient.readContract({
    address: cfg.usdcAddr,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account.address, cfg.engineAddr],
  });

  if (allowance < stakeRaw) {
    log("Approving USDC spend...");
    const approveTx = await walletClient.writeContract({
      address: cfg.usdcAddr,
      abi: USDC_ABI,
      functionName: "approve",
      args: [cfg.engineAddr, stakeRaw],
      chain: walletClient.chain,
      account: walletClient.account!,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    log("USDC approved.");
  }

  // Buy ticket with CLASSIC mode (0)
  log("Buying parlay ticket on-chain...");
  const legIdsBigInt = legIds.map((id) => BigInt(id));
  const outcomeBytes = outcomes as `0x${string}`[];

  const buyTx = await walletClient.writeContract({
    address: cfg.engineAddr,
    abi: ENGINE_ABI,
    functionName: "buyTicketWithMode",
    args: [legIdsBigInt, outcomeBytes, stakeRaw, 0], // 0 = CLASSIC mode
    chain: walletClient.chain,
    account: walletClient.account!,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: buyTx });
  log(`Transaction confirmed: ${receipt.transactionHash}`);

  // Read the new ticket
  const ticketCount = await publicClient.readContract({
    address: cfg.engineAddr,
    abi: ENGINE_ABI,
    functionName: "ticketCount",
  });

  const ticketId = Number(ticketCount) - 1;
  const ticket = await publicClient.readContract({
    address: cfg.engineAddr,
    abi: ENGINE_ABI,
    functionName: "getTicket",
    args: [BigInt(ticketId)],
  });

  log("Ticket purchased successfully!");
  log(`  Ticket ID: #${ticketId}`);
  log(`  Stake: ${formatUnits(ticket.stake, 6)} USDC`);
  log(`  Multiplier: ${(Number(ticket.multiplierX1e6) / 1_000_000).toFixed(2)}x`);
  log(`  Potential payout: ${formatUnits(ticket.potentialPayout, 6)} USDC`);
  log(`  Fee paid: ${formatUnits(ticket.feePaid, 6)} USDC`);
  log(`  Legs: ${ticket.legIds.map(Number).join(", ")}`);

  log("Risk agent complete.");
}

main().catch((err) => {
  console.error("[agent] Fatal:", err);
  process.exit(1);
});
