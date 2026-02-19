import { Router } from "express";
import {
  parseAgentQuoteRequest,
  parseUSDC,
  computeQuote,
  computeMultiplier,
  computeEdge,
  applyEdge,
  PPM,
  RiskAction,
} from "@parlaycity/shared";
import type { RiskProfile, RiskAssessResponse, AgentQuoteResponse } from "@parlaycity/shared";
import { SEED_MARKETS } from "../catalog/seed.js";

const router = Router();

// Risk tolerance caps (same as risk/index.ts)
const RISK_CAPS: Record<RiskProfile, { maxKelly: number; maxLegs: number; minWinProb: number }> = {
  conservative: { maxKelly: 0.05, maxLegs: 3, minWinProb: 0.15 },
  moderate: { maxKelly: 0.15, maxLegs: 4, minWinProb: 0.05 },
  aggressive: { maxKelly: 1.0, maxLegs: 5, minWinProb: 0.0 },
};

function getLegMap() {
  const map = new Map<number, { probabilityPPM: number; active: boolean; category: string }>();
  for (const market of SEED_MARKETS) {
    for (const leg of market.legs) {
      map.set(leg.id, { probabilityPPM: leg.probabilityPPM, active: leg.active, category: market.category });
    }
  }
  return map;
}

/**
 * POST /premium/agent-quote
 * x402-gated endpoint that combines quote + risk assessment in one call.
 * Resolves leg probabilities from the catalog so agents don't need to know them.
 */
router.post("/agent-quote", (req, res) => {
  const parsed = parseAgentQuoteRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds, outcomes, stake, bankroll, riskTolerance } = parsed.data;
  const legMap = getLegMap();

  // Validate all legs exist and are active, collect probabilities + categories
  const probabilities: number[] = [];
  const categories: string[] = [];
  for (const legId of legIds) {
    const leg = legMap.get(legId);
    if (!leg) {
      return res.status(400).json({ error: `Leg ${legId} not found` });
    }
    if (!leg.active) {
      return res.status(400).json({ error: `Leg ${legId} is not active` });
    }
    probabilities.push(leg.probabilityPPM);
    categories.push(leg.category);
  }

  // Check for duplicate legs
  if (new Set(legIds).size !== legIds.length) {
    return res.status(400).json({ error: "Duplicate leg IDs not allowed" });
  }

  // --- Quote ---
  const stakeRaw = parseUSDC(stake);
  const quote = computeQuote(probabilities, stakeRaw, legIds, outcomes);

  // --- Risk Assessment ---
  const caps = RISK_CAPS[riskTolerance];
  const warnings: string[] = [];
  const numLegs = probabilities.length;

  const fairMultiplierX1e6 = computeMultiplier(probabilities);
  const edgeBps = computeEdge(numLegs);
  const netMultiplierX1e6 = applyEdge(fairMultiplierX1e6, edgeBps);

  // Guard: extreme multiplier
  if (fairMultiplierX1e6 > BigInt(Number.MAX_SAFE_INTEGER)) {
    const risk: RiskAssessResponse = {
      action: RiskAction.AVOID,
      suggestedStake: "0.00",
      kellyFraction: 0,
      winProbability: 0,
      expectedValue: 0,
      confidence: 0.5,
      reasoning: "Combined multiplier exceeds safe computation range. This parlay is extremely unlikely to win.",
      warnings: ["Multiplier too large for risk assessment"],
      riskTolerance,
      fairMultiplier: 0,
      netMultiplier: 0,
      edgeBps,
    };
    return res.json({ quote, risk } satisfies AgentQuoteResponse);
  }

  const fairMultFloat = Number(fairMultiplierX1e6) / PPM;
  const winProbability = 1 / fairMultFloat;
  const netMultFloat = Number(netMultiplierX1e6) / PPM;

  const ev = winProbability * netMultFloat - 1;
  const stakeNum = Number(stake);
  const expectedValue = Math.round(ev * stakeNum * 100) / 100;

  // Kelly criterion
  const b = netMultFloat - 1;
  const p = winProbability;
  const q = 1 - p;
  let kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
  kellyFraction = Math.min(kellyFraction, caps.maxKelly);

  const bankrollNum = Number(bankroll);
  const suggestedStake = Math.round(kellyFraction * bankrollNum * 100) / 100;

  // Warnings
  if (numLegs > caps.maxLegs) {
    warnings.push(`${riskTolerance} profile recommends max ${caps.maxLegs} legs, you have ${numLegs}`);
  }
  if (winProbability < caps.minWinProb) {
    warnings.push(`Win probability ${(winProbability * 100).toFixed(2)}% is below ${riskTolerance} minimum of ${(caps.minWinProb * 100).toFixed(0)}%`);
  }

  // Correlation detection from catalog categories
  const catCounts: Record<string, number> = {};
  for (const cat of categories) {
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catCounts)) {
    if (count > 1) {
      warnings.push(`${count} legs in category "${cat}" may be correlated`);
    }
  }

  // Determine action
  let action: RiskAction = RiskAction.BUY;
  let reasoning = "";

  if (winProbability < caps.minWinProb || numLegs > caps.maxLegs) {
    action = RiskAction.AVOID;
    reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability exceeds ${riskTolerance} risk tolerance limits.`;
  } else if (kellyFraction === 0) {
    action = RiskAction.REDUCE_STAKE;
    reasoning = `House edge (${edgeBps}bps) exceeds edge on fair odds. Kelly suggests $0. Bet only if you believe your true win probability exceeds ${(winProbability * 100).toFixed(2)}%.`;
  } else if (suggestedStake < stakeNum) {
    action = RiskAction.REDUCE_STAKE;
    reasoning = `Kelly criterion suggests ${suggestedStake.toFixed(2)} USDC (${(kellyFraction * 100).toFixed(2)}% of bankroll). Your proposed stake of ${stake} USDC exceeds this.`;
  } else {
    reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability. Kelly suggests ${(kellyFraction * 100).toFixed(2)}% of bankroll = ${suggestedStake.toFixed(2)} USDC.`;
  }

  const confidence = Math.max(0.5, 1 - (numLegs - 2) * 0.1);

  const risk: RiskAssessResponse = {
    action,
    suggestedStake: suggestedStake.toFixed(2),
    kellyFraction: Math.round(kellyFraction * 10_000) / 10_000,
    winProbability: Math.round(winProbability * 1_000_000) / 1_000_000,
    expectedValue,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    warnings,
    riskTolerance,
    fairMultiplier: Math.round(fairMultFloat * 100) / 100,
    netMultiplier: Math.round(netMultFloat * 100) / 100,
    edgeBps,
  };

  return res.json({ quote, risk } satisfies AgentQuoteResponse);
});

export default router;
