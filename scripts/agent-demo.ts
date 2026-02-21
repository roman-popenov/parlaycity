/**
 * ParlayCity Agent Demo -- x402 Payment Protocol
 *
 * Demonstrates an autonomous AI agent using ParlayCity's x402-gated API
 * endpoints. Built for the Coinbase x402 bounty at ETHDenver 2026.
 *
 * The agent runs 5 rounds:
 *   1. Discovers available markets via GET /markets
 *   2. Selects 2-3 legs from different categories
 *   3. Calls POST /premium/agent-quote (showing full x402 handshake)
 *   4. Parses the response: Kelly sizing, risk action, EV
 *   5. Makes an autonomous decision: PLACE or SKIP
 *
 * Usage:
 *   npx tsx scripts/agent-demo.ts
 *   pnpm --filter services exec tsx ../../scripts/agent-demo.ts
 *
 * Env vars:
 *   SERVICES_URL   -- defaults to http://localhost:3001
 *   ROUNDS         -- number of rounds (default: 5)
 *   AGENT_BANKROLL -- USDC bankroll for Kelly sizing (default: 1000)
 */

// ── ANSI colors (no deps) ──────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

function bold(s: string) { return `${C.bold}${s}${C.reset}`; }
function dim(s: string) { return `${C.dim}${s}${C.reset}`; }
function green(s: string) { return `${C.green}${s}${C.reset}`; }
function red(s: string) { return `${C.red}${s}${C.reset}`; }
function yellow(s: string) { return `${C.yellow}${s}${C.reset}`; }
function cyan(s: string) { return `${C.cyan}${s}${C.reset}`; }
function magenta(s: string) { return `${C.magenta}${s}${C.reset}`; }
function blue(s: string) { return `${C.blue}${s}${C.reset}`; }
function tag(label: string, color: string) { return `${color}[${label}]${C.reset}`; }

// ── Types (matching server response shapes) ─────────────────────────────────

interface MarketLeg {
  id: number;
  question: string;
  probabilityPPM: number;
  active: boolean;
  sourceRef?: string;
}

interface MarketResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  legs: MarketLeg[];
}

interface QuoteResponse {
  legIds: number[];
  outcomes: string[];
  stake: string;
  multiplierX1e6: string;
  potentialPayout: string;
  feePaid: string;
  edgeBps: number;
  probabilities: number[];
  valid: boolean;
  reason?: string;
}

interface RiskAssessResponse {
  action: string;
  suggestedStake: string;
  kellyFraction: number;
  winProbability: number;
  expectedValue: number;
  confidence: number;
  reasoning: string;
  warnings: string[];
  riskTolerance: string;
  fairMultiplier: number;
  netMultiplier: number;
  edgeBps: number;
}

interface AiInsight {
  analysis: string;
  model: string;
  provider: string;
  verified: boolean;
}

interface AgentQuoteResponse {
  quote: QuoteResponse;
  risk: RiskAssessResponse;
  aiInsight?: AiInsight;
}

interface X402Response {
  error: string;
  message: string;
  protocol: string;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    price: string;
    payTo?: string;
  }>;
  facilitator: string;
  mode?: string;
}

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SERVICES_URL ?? "http://localhost:3001";
const ROUNDS = Math.max(1, Math.min(10, Number(process.env.ROUNDS ?? "5")));
const BANKROLL = process.env.AGENT_BANKROLL ?? "1000";

// Simulated agent wallet for demo output
const AGENT_WALLET = "0x1234567890abcdef1234567890abcdef12340389";
const NETWORK = "Base Sepolia (84532)";

// bytes32 YES outcome for on-chain compatibility
const YES_OUTCOME = "0x0000000000000000000000000000000000000000000000000000000000000001";

const RISK_TOLERANCES = ["conservative", "moderate", "aggressive"] as const;

// ── Step 1: Discover markets ────────────────────────────────────────────────

async function discoverMarkets(): Promise<MarketResponse[]> {
  const res = await fetch(`${BASE_URL}/markets`);
  if (!res.ok) {
    throw new Error(`GET /markets failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as MarketResponse[];
}

// ── Step 2: Select legs ─────────────────────────────────────────────────────

interface SelectedLeg {
  id: number;
  question: string;
  outcome: string;
  probabilityPPM: number;
  category: string;
}

/**
 * Pick 2-3 legs from different categories to reduce correlation.
 * Randomizes selection each round for variety.
 */
function selectLegs(markets: MarketResponse[], round: number): SelectedLeg[] {
  // Collect all active legs with their category
  const allLegs: (MarketLeg & { category: string })[] = [];
  for (const market of markets) {
    for (const leg of market.legs) {
      if (leg.active) {
        allLegs.push({ ...leg, category: market.category });
      }
    }
  }

  if (allLegs.length < 2) {
    throw new Error("Not enough active legs to build a parlay");
  }

  // Group by category
  const byCategory = new Map<string, (MarketLeg & { category: string })[]>();
  for (const leg of allLegs) {
    const arr = byCategory.get(leg.category) ?? [];
    arr.push(leg);
    byCategory.set(leg.category, arr);
  }

  const categories = [...byCategory.keys()];
  const numLegs = Math.min(2 + (round % 2), categories.length, 3); // alternate 2 and 3 legs

  // Shuffle categories deterministically per round for demo variety
  const shuffled = [...categories].sort(
    (a, b) => hashCode(`${a}-${round}`) - hashCode(`${b}-${round}`),
  );

  const selected: SelectedLeg[] = [];
  for (let i = 0; i < numLegs && i < shuffled.length; i++) {
    const catLegs = byCategory.get(shuffled[i])!;
    // Pick a leg based on round for variety
    const leg = catLegs[round % catLegs.length];
    selected.push({
      id: leg.id,
      question: leg.question,
      outcome: "YES",
      probabilityPPM: leg.probabilityPPM,
      category: shuffled[i],
    });
  }

  return selected;
}

/** Simple string hash for deterministic shuffling. */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Step 3: x402 handshake ──────────────────────────────────────────────────

/**
 * Demonstrate the full x402 payment protocol flow:
 *   1. POST without payment header -> 402 Payment Required
 *   2. Parse the 402 response (price, network, facilitator)
 *   3. POST with payment header -> 200 OK
 */
async function callAgentQuoteWithX402(
  legIds: number[],
  outcomes: string[],
  stake: string,
  bankroll: string,
  riskTolerance: string,
): Promise<{ paymentInfo: X402Response; quote: AgentQuoteResponse }> {
  const body = {
    legIds,
    outcomes,
    stake,
    bankroll,
    riskTolerance,
  };

  // -- Phase 1: Call WITHOUT x402 payment header --
  console.log(`  ${tag("x402", C.magenta)} Calling /premium/agent-quote ${bold("WITHOUT")} payment...`);

  const res402 = await fetch(`${BASE_URL}/premium/agent-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res402.status !== 402) {
    // Unexpected -- maybe x402 is disabled or the endpoint is open
    if (res402.ok) {
      const data = (await res402.json()) as AgentQuoteResponse;
      console.log(`  ${tag("x402", C.magenta)} Endpoint returned 200 without payment (x402 may be disabled)`);
      return {
        paymentInfo: { error: "", message: "", protocol: "x402", accepts: [], facilitator: "", mode: "none" },
        quote: data,
      };
    }
    const text = await res402.text();
    throw new Error(`Expected 402, got ${res402.status}: ${text.slice(0, 200)}`);
  }

  const paymentInfo = (await res402.json()) as X402Response;

  console.log(`  ${tag("x402", C.magenta)} ${red(`HTTP 402 Payment Required`)}`);
  if (paymentInfo.accepts?.[0]) {
    const accept = paymentInfo.accepts[0];
    console.log(`  ${tag("x402", C.magenta)} Price: ${bold(accept.price)} ${accept.asset ?? "USDC"} on ${accept.network}`);
    if (accept.payTo) {
      console.log(`  ${tag("x402", C.magenta)} Pay to: ${dim(accept.payTo)}`);
    }
  }
  console.log(`  ${tag("x402", C.magenta)} Facilitator: ${dim(paymentInfo.facilitator)}`);
  console.log(`  ${tag("x402", C.magenta)} Protocol: ${paymentInfo.protocol} (${paymentInfo.mode ?? "production"})`);
  console.log();

  // -- Phase 2: Retry WITH x402 payment header --
  console.log(`  ${tag("x402", C.magenta)} Retrying ${bold("WITH")} payment header...`);

  const res200 = await fetch(`${BASE_URL}/premium/agent-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-402-Payment": "agent-demo-x402-payment",
    },
    body: JSON.stringify(body),
  });

  if (!res200.ok) {
    const text = await res200.text();
    throw new Error(`POST /premium/agent-quote with payment failed: ${res200.status} ${text.slice(0, 300)}`);
  }

  const quote = (await res200.json()) as AgentQuoteResponse;
  console.log(`  ${tag("x402", C.magenta)} ${green("HTTP 200 OK")} -- payment accepted`);

  return { paymentInfo, quote };
}

// ── Step 4: Parse and display results ───────────────────────────────────────

function displayQuote(quote: QuoteResponse): void {
  const multiplier = Number(quote.multiplierX1e6) / 1e6;
  const payout = formatUsdc(quote.potentialPayout);
  const fee = formatUsdc(quote.feePaid);

  console.log(
    `  ${tag("QUOTE", C.cyan)} Multiplier: ${bold(multiplier.toFixed(2) + "x")}` +
    ` | Payout: ${bold("$" + payout)}` +
    ` | Fee: $${fee}` +
    ` | Edge: ${quote.edgeBps}bps`,
  );
}

function displayRisk(risk: RiskAssessResponse): void {
  const actionColor = risk.action === "BUY" ? C.green
    : risk.action === "REDUCE_STAKE" ? C.yellow
    : C.red;

  const evSign = risk.expectedValue >= 0 ? "+" : "";
  const evColor = risk.expectedValue >= 0 ? green : red;

  // Detect correlation from warnings
  const correlationWarnings = risk.warnings.filter((w) => w.includes("correlated"));
  const correlation = correlationWarnings.length > 0 ? "correlated" : "diversified";

  console.log(
    `  ${tag("RISK", C.yellow)} ` +
    `Action: ${actionColor}${risk.action}${C.reset}` +
    ` | Kelly: ${bold((risk.kellyFraction * 100).toFixed(1) + "%")}` +
    ` | EV: ${evColor(evSign + "$" + risk.expectedValue.toFixed(2))}` +
    ` | Correlation: ${correlation}`,
  );

  if (risk.warnings.length > 0) {
    for (const w of risk.warnings) {
      console.log(`  ${tag("WARN", C.yellow)} ${dim(w)}`);
    }
  }
}

function displayAiInsight(ai: AiInsight): void {
  const truncated = ai.analysis.length > 120
    ? ai.analysis.slice(0, 120) + "..."
    : ai.analysis;
  console.log(
    `  ${tag("AI", C.blue)} ${dim(`[${ai.provider}/${ai.model}]`)} ${truncated}`,
  );
}

// ── Step 5: Autonomous decision ─────────────────────────────────────────────

function makeDecision(risk: RiskAssessResponse): { take: boolean; reason: string } {
  // BUY with positive EV -- always take
  if (risk.action === "BUY" && risk.expectedValue >= 0) {
    return {
      take: true,
      reason: "EV positive, Kelly sizing within tolerance",
    };
  }

  // BUY with slightly negative EV -- aggressive agents accept the risk
  if (risk.action === "BUY" && risk.expectedValue > -1) {
    return {
      take: risk.riskTolerance === "aggressive",
      reason: risk.riskTolerance === "aggressive"
        ? `Aggressive profile: accepting marginal EV ($${risk.expectedValue.toFixed(2)}) for upside`
        : `EV negative ($${risk.expectedValue.toFixed(2)}), skipping under ${risk.riskTolerance} profile`,
    };
  }

  // REDUCE_STAKE with high multiplier -- aggressive agents take partial position
  if (risk.action === "REDUCE_STAKE" && risk.netMultiplier > 4 && risk.riskTolerance === "aggressive") {
    return {
      take: true,
      reason: `High multiplier (${risk.netMultiplier.toFixed(1)}x) with aggressive tolerance -- taking reduced position`,
    };
  }

  if (risk.action === "REDUCE_STAKE") {
    return {
      take: false,
      reason: `Kelly sizing suggests $${risk.suggestedStake} (current stake too high)`,
    };
  }

  // AVOID -- never take
  return {
    take: false,
    reason: risk.reasoning.slice(0, 100),
  };
}

// ── Formatting helpers ──────────────────────────────────────────────────────

/** Format a raw USDC string (from contract scale) to human-readable. */
function formatUsdc(raw: string): string {
  const n = BigInt(raw);
  const divisor = 1_000_000n;
  const whole = n / divisor;
  const frac = n % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function probToPercent(ppm: number): string {
  return (ppm / 10_000).toFixed(1) + "%";
}

function separator() {
  console.log(dim("  " + "-".repeat(68)));
}

// ── Main loop ───────────────────────────────────────────────────────────────

async function runRound(round: number, totalRounds: number, markets: MarketResponse[]): Promise<void> {
  console.log();
  console.log(bold(`--- Round ${round}/${totalRounds} ---`));
  console.log();

  // Step 1: Discover
  console.log(`  ${tag("DISCOVER", C.cyan)} Fetching markets...`);
  const categories = new Set(markets.map((m) => m.category));
  const totalLegs = markets.reduce((n, m) => n + m.legs.filter((l) => l.active).length, 0);
  console.log(`  ${tag("DISCOVER", C.cyan)} Found ${bold(String(categories.size))} categories, ${bold(String(totalLegs))} active legs`);
  console.log();

  // Step 2: Select legs
  const selected = selectLegs(markets, round);
  console.log(`  ${tag("SELECT", C.green)} Picked ${bold(String(selected.length))} legs:`);
  for (const leg of selected) {
    console.log(
      `    Leg ${bold(String(leg.id))}: "${leg.question}"` +
      ` -> ${bold(leg.outcome)} (prob: ${probToPercent(leg.probabilityPPM)}) [${dim(leg.category)}]`,
    );
  }
  console.log();

  // Step 3: x402 handshake + agent-quote
  const riskTolerance = RISK_TOLERANCES[round % RISK_TOLERANCES.length];
  const stake = String(5 + (round * 3)); // vary stake per round

  const { quote: agentResp } = await callAgentQuoteWithX402(
    selected.map((l) => l.id),
    selected.map(() => YES_OUTCOME),
    stake,
    BANKROLL,
    riskTolerance,
  );
  console.log();

  // Step 4: Display results
  displayQuote(agentResp.quote);
  displayRisk(agentResp.risk);
  if (agentResp.aiInsight) {
    displayAiInsight(agentResp.aiInsight);
  }
  console.log();

  // Step 5: Decision
  const decision = makeDecision(agentResp.risk);
  if (decision.take) {
    console.log(`  ${tag("DECISION", C.bgGreen)} ${bold("PLACING BET")} -- ${decision.reason}`);
  } else {
    console.log(`  ${tag("DECISION", C.bgRed)} ${bold("SKIPPING")} -- ${decision.reason}`);
  }
}

async function main() {
  // Banner
  console.log();
  console.log(bold("=== ParlayCity Agent Demo (x402 Payment Protocol) ==="));
  console.log(`Agent wallet: ${dim(AGENT_WALLET)}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Services: ${dim(BASE_URL)}`);
  console.log(`Bankroll: $${BANKROLL} USDC | Rounds: ${ROUNDS}`);

  // Pre-flight: verify service is reachable
  console.log();
  console.log(dim("Checking service health..."));
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) {
      throw new Error(`Health check returned ${healthRes.status}`);
    }
    const health = (await healthRes.json()) as { status: string };
    console.log(green(`Service healthy (status: ${health.status})`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(red(`Cannot reach services at ${BASE_URL}: ${msg}`));
    console.error(dim("Start the services with: make dev"));
    process.exit(1);
  }

  // Fetch markets once (reused across rounds for speed)
  const markets = await discoverMarkets();

  // Summary
  const catCounts = new Map<string, number>();
  for (const m of markets) {
    catCounts.set(m.category, (catCounts.get(m.category) ?? 0) + m.legs.filter((l) => l.active).length);
  }
  console.log();
  console.log(bold("Market catalog:"));
  for (const [cat, count] of catCounts) {
    console.log(`  ${cat.padEnd(12)} ${count} legs`);
  }

  // Run rounds
  for (let round = 1; round <= ROUNDS; round++) {
    try {
      await runRound(round, ROUNDS, markets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  ${red(`[ERROR] Round ${round} failed: ${msg}`)}`);
    }

    // Brief pause between rounds for readability
    if (round < ROUNDS) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Summary
  console.log();
  console.log(bold("=== Demo Complete ==="));
  console.log();
  console.log("This demo showed the full x402 payment protocol flow:");
  console.log(`  1. ${cyan("Discovery")}    -- GET /markets to find available betting legs`);
  console.log(`  2. ${green("Selection")}    -- Agent picks legs across categories`);
  console.log(`  3. ${magenta("x402 Payment")} -- 402 challenge -> payment -> 200 response`);
  console.log(`  4. ${yellow("Risk Analysis")} -- Kelly criterion, EV, correlation detection`);
  console.log(`  5. ${bold("Decision")}      -- Autonomous buy/skip based on risk assessment`);
  console.log();
  console.log(dim("For the production flow with real USDC payment on Base:"));
  console.log(dim("  - Set X402_RECIPIENT_WALLET to your address"));
  console.log(dim("  - Set NODE_ENV=production for real x402 verification"));
  console.log(dim("  - The agent pays $0.01 USDC per API call via the x402 facilitator"));
  console.log();
}

main().catch((err) => {
  console.error("[agent-demo] Fatal:", err);
  process.exit(1);
});
