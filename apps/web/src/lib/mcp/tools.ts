import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia, foundry } from "viem/chains";
import {
  computeMultiplier,
  computeEdge,
  applyEdge,
  computePayout,
  PPM,
  BPS,
  USDC_DECIMALS,
  BASE_FEE_BPS,
  PER_LEG_FEE_BPS,
  RiskAction,
} from "@parlaycity/shared";
import type { RiskProfile, Market, Leg } from "@parlaycity/shared";
import { HOUSE_VAULT_ABI, LEG_REGISTRY_ABI, PARLAY_ENGINE_ABI } from "../contracts";
import { fetchNBAMarkets, NBA_LEG_ID_OFFSET } from "../bdl";

// ---------------------------------------------------------------------------
// Chain client
// ---------------------------------------------------------------------------

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
const chain = chainId === 31337 ? foundry : baseSepolia;
const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL ??
  (chainId === 31337 ? "http://127.0.0.1:8545" : "https://sepolia.base.org");

const client = createPublicClient({ chain, transport: http(rpcUrl) });

// ---------------------------------------------------------------------------
// Contract addresses from env
// ---------------------------------------------------------------------------

const addr = {
  houseVault: (process.env.NEXT_PUBLIC_HOUSE_VAULT_ADDRESS ?? "") as `0x${string}`,
  parlayEngine: (process.env.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ?? "") as `0x${string}`,
  legRegistry: (process.env.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ?? "") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as `0x${string}`,
};

// ---------------------------------------------------------------------------
// Inline seed markets (from packages/services/src/catalog/seed.ts)
// ---------------------------------------------------------------------------

export const SEED_MARKETS: Market[] = [
  {
    id: "ethdenver-2026",
    title: "ETHDenver 2026 Predictions",
    description: "Will these things happen at ETHDenver?",
    category: "crypto",
    legs: [
      { id: 1, question: "Will ETH be above $3000 by March 1?", sourceRef: "price-feed", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 550000, active: true },
      { id: 2, question: "Will Base TVL exceed $15B?", sourceRef: "defillama", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 500000, active: true },
      { id: 3, question: "Will Vitalik attend ETHDenver?", sourceRef: "social", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 450000, active: true },
    ],
  },
  {
    id: "defi-markets",
    title: "DeFi Market Moves",
    description: "Predict the next big DeFi moves",
    category: "defi",
    legs: [
      { id: 4, question: "Will Uniswap v4 launch on Base?", sourceRef: "uniswap-gov", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 600000, active: true },
      { id: 5, question: "Will total DEX volume hit $500B monthly?", sourceRef: "dune", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 450000, active: true },
      { id: 6, question: "Will a new stablecoin enter top 5 by mcap?", sourceRef: "coingecko", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
    ],
  },
  {
    id: "nft-culture",
    title: "NFT & Culture",
    description: "Culture and community predictions",
    category: "nft",
    legs: [
      { id: 7, question: "Will an onchain game hit 100K DAU?", sourceRef: "dappradar", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
      { id: 8, question: "Will NFT trading volume recover to $2B monthly?", sourceRef: "nftgo", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 350000, active: true },
      { id: 9, question: "Will a DAO acquire a real-world asset over $10M?", sourceRef: "dao-news", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
    ],
  },
  {
    id: "us-policy-2026",
    title: "US Policy & Regulation",
    description: "Crypto regulation and policy predictions",
    category: "policy",
    legs: [
      { id: 10, question: "Will a US stablecoin bill pass by June 2026?", sourceRef: "congress-gov", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 500000, active: true },
      { id: 11, question: "Will the SEC approve a spot SOL ETF by Q3 2026?", sourceRef: "sec-filings", cutoffTime: 1759276800, earliestResolve: 1759363200, probabilityPPM: 400000, active: true },
      { id: 12, question: "Will the US create a strategic Bitcoin reserve?", sourceRef: "executive-orders", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 350000, active: true },
    ],
  },
  {
    id: "macro-economics",
    title: "Macro & Markets",
    description: "Economic predictions and market moves",
    category: "economics",
    legs: [
      { id: 13, question: "Will the Fed cut rates before June 2026?", sourceRef: "fed-minutes", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 550000, active: true },
      { id: 14, question: "Will S&P 500 hit 7000 by end of 2026?", sourceRef: "yahoo-finance", cutoffTime: 1767139200, earliestResolve: 1767225600, probabilityPPM: 450000, active: true },
      { id: 15, question: "Will global crypto market cap exceed $5T?", sourceRef: "coingecko", cutoffTime: 1767139200, earliestResolve: 1767225600, probabilityPPM: 450000, active: true },
    ],
  },
  {
    id: "crypto-trivia",
    title: "Crypto Trivia & Fun",
    description: "Fun predictions for the crypto space",
    category: "trivia",
    legs: [
      { id: 16, question: "Will a memecoin enter the top 10 by market cap?", sourceRef: "coingecko", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 400000, active: true },
      { id: 17, question: "Will Elon Musk tweet about Dogecoin this week?", sourceRef: "twitter-api", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 650000, active: true },
      { id: 18, question: "Will a crypto project raise $1B+ in a single round?", sourceRef: "crunchbase", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 350000, active: true },
    ],
  },
  {
    id: "ethdenver-special",
    title: "ETHDenver Specials",
    description: "Predictions specific to ETHDenver 2026",
    category: "ethdenver",
    legs: [
      { id: 19, question: "Will over 20,000 people attend ETHDenver?", sourceRef: "ethdenver-org", cutoffTime: 1740700000, earliestResolve: 1740800000, probabilityPPM: 550000, active: true },
      { id: 20, question: "Will a hackathon project get acquired within 30 days?", sourceRef: "twitter-api", cutoffTime: 1743379200, earliestResolve: 1743465600, probabilityPPM: 350000, active: true },
      { id: 21, question: "Will ParlayCity win a bounty at ETHDenver?", sourceRef: "ethdenver-org", cutoffTime: 1740700000, earliestResolve: 1740800000, probabilityPPM: 600000, active: true },
    ],
  },
];

// Build a leg lookup map (seed legs are static, NBA legs are added lazily)
export const LEG_MAP = new Map<number, Leg & { category: string }>();
for (const m of SEED_MARKETS) {
  for (const leg of m.legs) {
    LEG_MAP.set(leg.id, { ...leg, category: m.category });
  }
}

/** Refresh LEG_MAP with NBA legs from BDL. Call before tool execution.
 *  Clears stale NBA legs (>= NBA_LEG_ID_OFFSET) before repopulating. */
export async function refreshLegMap(): Promise<void> {
  // Remove stale NBA entries to prevent unbounded growth (lesson #36-adjacent)
  for (const id of LEG_MAP.keys()) {
    if (id >= NBA_LEG_ID_OFFSET) LEG_MAP.delete(id);
  }
  const nbaMarkets = await fetchNBAMarkets();
  for (const m of nbaMarkets) {
    for (const leg of m.legs) {
      LEG_MAP.set(leg.id, { ...leg, category: m.category });
    }
  }
}

// ---------------------------------------------------------------------------
// Risk assessment (ported from packages/services/src/risk/compute.ts)
// ---------------------------------------------------------------------------

const RISK_CAPS: Record<RiskProfile, { maxKelly: number; maxLegs: number; minWinProb: number }> = {
  conservative: { maxKelly: 0.05, maxLegs: 3, minWinProb: 0.15 },
  moderate: { maxKelly: 0.15, maxLegs: 4, minWinProb: 0.05 },
  aggressive: { maxKelly: 1.0, maxLegs: 5, minWinProb: 0.0 },
};

// ---------------------------------------------------------------------------
// Tool: list_markets
// ---------------------------------------------------------------------------

export async function listMarkets(input: { category?: string }): Promise<{
  markets: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    legs: Array<{ id: number; question: string; probabilityPPM: number; impliedOdds: string }>;
  }>;
  totalLegs: number;
}> {
  const nbaMarkets = await fetchNBAMarkets();
  let markets: Market[] = [...SEED_MARKETS, ...nbaMarkets];
  if (input.category) {
    markets = markets.filter((m) => m.category === input.category);
  }
  const mapped = markets.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    legs: m.legs.map((l) => ({
      id: l.id,
      question: l.question,
      probabilityPPM: l.probabilityPPM,
      impliedOdds: `${((l.probabilityPPM / PPM) * 100).toFixed(1)}%`,
    })),
  }));
  const totalLegs = mapped.reduce((sum, m) => sum + m.legs.length, 0);
  return { markets: mapped, totalLegs };
}

// ---------------------------------------------------------------------------
// Tool: get_quote
// ---------------------------------------------------------------------------

export async function getQuote(input: {
  legIds: number[];
  stake: number;
}): Promise<{
  valid: boolean;
  multiplier: string;
  edgeBps: number;
  potentialPayout: string;
  feePaid: string;
  legs: Array<{ id: number; question: string; probabilityPPM: number }>;
  error?: string;
}> {
  await refreshLegMap();
  const legs: Array<{ id: number; question: string; probabilityPPM: number }> = [];
  const probs: number[] = [];

  for (const id of input.legIds) {
    const leg = LEG_MAP.get(id);
    if (!leg) {
      return {
        valid: false,
        multiplier: "0",
        edgeBps: 0,
        potentialPayout: "0",
        feePaid: "0",
        legs: [],
        error: `Leg ${id} not found`,
      };
    }
    legs.push({ id: leg.id, question: leg.question, probabilityPPM: leg.probabilityPPM });
    probs.push(leg.probabilityPPM);
  }

  if (probs.length < 2 || probs.length > 5) {
    return {
      valid: false,
      multiplier: "0",
      edgeBps: 0,
      potentialPayout: "0",
      feePaid: "0",
      legs,
      error: `Need 2-5 legs, got ${probs.length}`,
    };
  }

  const stakeRaw = BigInt(Math.round(input.stake * 10 ** USDC_DECIMALS));
  const fairMult = computeMultiplier(probs);
  const edge = computeEdge(probs.length);
  const netMult = applyEdge(fairMult, edge);
  const payout = computePayout(stakeRaw, netMult);
  const fee = computePayout(stakeRaw, fairMult) - payout;

  return {
    valid: true,
    multiplier: `${(Number(netMult) / PPM).toFixed(2)}x`,
    edgeBps: edge,
    potentialPayout: `${formatUnits(payout, USDC_DECIMALS)} USDC`,
    feePaid: `${formatUnits(fee, USDC_DECIMALS)} USDC`,
    legs,
  };
}

// ---------------------------------------------------------------------------
// Tool: get_vault_health
// ---------------------------------------------------------------------------

export async function getVaultHealth(): Promise<{
  totalAssets: string;
  totalReserved: string;
  freeLiquidity: string;
  utilizationPercent: string;
  chainId: number;
  error?: string;
}> {
  if (!addr.houseVault) {
    return {
      totalAssets: "N/A",
      totalReserved: "N/A",
      freeLiquidity: "N/A",
      utilizationPercent: "N/A",
      chainId,
      error: "HouseVault address not configured",
    };
  }

  try {
    const [totalAssets, totalReserved, free] = await Promise.all([
      client.readContract({
        address: addr.houseVault,
        abi: HOUSE_VAULT_ABI,
        functionName: "totalAssets",
      }) as Promise<bigint>,
      client.readContract({
        address: addr.houseVault,
        abi: HOUSE_VAULT_ABI,
        functionName: "totalReserved",
      }) as Promise<bigint>,
      client.readContract({
        address: addr.houseVault,
        abi: HOUSE_VAULT_ABI,
        functionName: "freeLiquidity",
      }) as Promise<bigint>,
    ]);

    const utilPct =
      totalAssets > 0n
        ? `${((Number(totalReserved) / Number(totalAssets)) * 100).toFixed(2)}%`
        : "0.00%";

    return {
      totalAssets: `${formatUnits(totalAssets, USDC_DECIMALS)} USDC`,
      totalReserved: `${formatUnits(totalReserved, USDC_DECIMALS)} USDC`,
      freeLiquidity: `${formatUnits(free, USDC_DECIMALS)} USDC`,
      utilizationPercent: utilPct,
      chainId,
    };
  } catch (e) {
    return {
      totalAssets: "N/A",
      totalReserved: "N/A",
      freeLiquidity: "N/A",
      utilizationPercent: "N/A",
      chainId,
      error: `Failed to read vault: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool: get_leg_status
// ---------------------------------------------------------------------------

export async function getLegStatus(input: { legId: number }): Promise<{
  legId: number;
  question: string;
  sourceRef: string;
  probabilityPPM: number;
  active: boolean;
  onChain: boolean;
  error?: string;
}> {
  await refreshLegMap();
  const seedLeg = LEG_MAP.get(input.legId);

  if (!addr.legRegistry) {
    return {
      legId: input.legId,
      question: seedLeg?.question ?? "Unknown",
      sourceRef: seedLeg?.sourceRef ?? "Unknown",
      probabilityPPM: seedLeg?.probabilityPPM ?? 0,
      active: seedLeg?.active ?? false,
      onChain: false,
      error: "LegRegistry address not configured",
    };
  }

  try {
    const result = (await client.readContract({
      address: addr.legRegistry,
      abi: LEG_REGISTRY_ABI,
      functionName: "getLeg",
      args: [BigInt(input.legId)],
    })) as {
      question: string;
      sourceRef: string;
      cutoffTime: bigint;
      earliestResolve: bigint;
      oracleAdapter: string;
      probabilityPPM: bigint;
      active: boolean;
    };

    return {
      legId: input.legId,
      question: result.question,
      sourceRef: result.sourceRef,
      probabilityPPM: Number(result.probabilityPPM),
      active: result.active,
      onChain: true,
    };
  } catch {
    return {
      legId: input.legId,
      question: seedLeg?.question ?? "Unknown",
      sourceRef: seedLeg?.sourceRef ?? "Unknown",
      probabilityPPM: seedLeg?.probabilityPPM ?? 0,
      active: seedLeg?.active ?? false,
      onChain: false,
      error: "Leg not found on-chain (may not be registered yet)",
    };
  }
}

// ---------------------------------------------------------------------------
// Tool: assess_risk
// ---------------------------------------------------------------------------

export async function assessRisk(input: {
  legIds: number[];
  stake: number;
  bankroll?: number;
}): Promise<{
  action: string;
  suggestedStake: string;
  kellyFraction: number;
  winProbability: number;
  expectedValue: number;
  reasoning: string;
  warnings: string[];
  multiplier: string;
  edgeBps: number;
}> {
  await refreshLegMap();
  const probs: number[] = [];
  const categories: string[] = [];

  for (const id of input.legIds) {
    const leg = LEG_MAP.get(id);
    if (!leg) {
      return {
        action: RiskAction.AVOID,
        suggestedStake: "0.00",
        kellyFraction: 0,
        winProbability: 0,
        expectedValue: 0,
        reasoning: `Leg ${id} not found`,
        warnings: [],
        multiplier: "0x",
        edgeBps: 0,
      };
    }
    probs.push(leg.probabilityPPM);
    categories.push(leg.category);
  }

  const riskTolerance: RiskProfile = "moderate";
  const bankroll = input.bankroll ?? 1000;
  const caps = RISK_CAPS[riskTolerance];
  const numLegs = probs.length;
  const edgeBps = computeEdge(numLegs);
  const warnings: string[] = [];

  let fairMultiplierX1e6: bigint;
  try {
    fairMultiplierX1e6 = computeMultiplier(probs);
  } catch {
    return {
      action: RiskAction.AVOID,
      suggestedStake: "0.00",
      kellyFraction: 0,
      winProbability: 0,
      expectedValue: 0,
      reasoning: "Invalid probabilities",
      warnings: [],
      multiplier: "0x",
      edgeBps,
    };
  }

  if (fairMultiplierX1e6 > 9007199254740991n) {
    return {
      action: RiskAction.AVOID,
      suggestedStake: "0.00",
      kellyFraction: 0,
      winProbability: 0,
      expectedValue: 0,
      reasoning: "Multiplier too large -- parlay is extremely unlikely to win",
      warnings: [],
      multiplier: "overflow",
      edgeBps,
    };
  }

  const netMultiplierX1e6 = applyEdge(fairMultiplierX1e6, edgeBps);
  const fairMultFloat = Number(fairMultiplierX1e6) / PPM;
  const netMultFloat = Number(netMultiplierX1e6) / PPM;
  const winProbability = 1 / fairMultFloat;
  const ev = winProbability * netMultFloat - 1;
  const expectedValue = Math.round(ev * input.stake * 100) / 100;

  const b = netMultFloat - 1;
  const p = winProbability;
  const q = 1 - p;
  let kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
  kellyFraction = Math.min(kellyFraction, caps.maxKelly);
  const suggestedStake = Math.round(kellyFraction * bankroll * 100) / 100;

  if (numLegs > caps.maxLegs) {
    warnings.push(`Moderate profile recommends max ${caps.maxLegs} legs, you have ${numLegs}`);
  }
  if (winProbability < caps.minWinProb) {
    warnings.push(`Win probability ${(winProbability * 100).toFixed(2)}% is below moderate minimum of ${(caps.minWinProb * 100).toFixed(0)}%`);
  }

  // Correlation detection
  const catCounts: Record<string, number> = {};
  for (const cat of categories) {
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catCounts)) {
    if (count > 1) {
      warnings.push(`${count} legs in category "${cat}" may be correlated`);
    }
  }

  let action: string = RiskAction.BUY;
  let reasoning = "";

  if (winProbability < caps.minWinProb || numLegs > caps.maxLegs) {
    action = RiskAction.AVOID;
    reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability exceeds moderate risk tolerance.`;
  } else if (kellyFraction === 0) {
    action = RiskAction.REDUCE_STAKE;
    reasoning = `House edge (${edgeBps}bps) exceeds edge on fair odds. Kelly suggests $0.`;
  } else if (suggestedStake < input.stake) {
    action = RiskAction.REDUCE_STAKE;
    reasoning = `Kelly suggests ${suggestedStake.toFixed(2)} USDC (${(kellyFraction * 100).toFixed(2)}% of bankroll). Your proposed ${input.stake} USDC exceeds this.`;
  } else {
    reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability. Kelly suggests ${(kellyFraction * 100).toFixed(2)}% of bankroll = ${suggestedStake.toFixed(2)} USDC.`;
  }

  return {
    action,
    suggestedStake: suggestedStake.toFixed(2),
    kellyFraction: Math.round(kellyFraction * 10_000) / 10_000,
    winProbability: Math.round(winProbability * 1_000_000) / 1_000_000,
    expectedValue,
    reasoning,
    warnings,
    multiplier: `${netMultFloat.toFixed(2)}x`,
    edgeBps,
  };
}

// ---------------------------------------------------------------------------
// Tool: get_protocol_config
// ---------------------------------------------------------------------------

export async function getProtocolConfig(): Promise<{
  chain: { id: number; name: string };
  contracts: Record<string, string>;
  fees: { baseBps: number; perLegBps: number; exampleEdge: Record<string, number> };
  limits: { minLegs: number; maxLegs: number; minStakeUSDC: number; maxUtilizationBps: number; maxPayoutBps: number };
}> {
  return {
    chain: { id: chainId, name: chain.name },
    contracts: {
      houseVault: addr.houseVault,
      parlayEngine: addr.parlayEngine,
      legRegistry: addr.legRegistry,
      usdc: addr.usdc,
    },
    fees: {
      baseBps: BASE_FEE_BPS,
      perLegBps: PER_LEG_FEE_BPS,
      exampleEdge: {
        "2-leg": computeEdge(2),
        "3-leg": computeEdge(3),
        "4-leg": computeEdge(4),
        "5-leg": computeEdge(5),
      },
    },
    limits: {
      minLegs: 2,
      maxLegs: 5,
      minStakeUSDC: 1,
      maxUtilizationBps: 8000,
      maxPayoutBps: 500,
    },
  };
}
