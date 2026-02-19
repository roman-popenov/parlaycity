import { Router } from "express";
import {
  parseRiskAssessRequest,
  PPM,
  computeMultiplier,
  computeEdge,
  applyEdge,
  RiskAction,
} from "@parlaycity/shared";
import type { RiskProfile } from "@parlaycity/shared";

const router = Router();

// Risk tolerance caps
const RISK_CAPS: Record<RiskProfile, { maxKelly: number; maxLegs: number; minWinProb: number }> = {
  conservative: { maxKelly: 0.05, maxLegs: 3, minWinProb: 0.15 },
  moderate: { maxKelly: 0.15, maxLegs: 4, minWinProb: 0.05 },
  aggressive: { maxKelly: 1.0, maxLegs: 5, minWinProb: 0.0 },
};

router.post("/risk-assess", (req, res) => {
  const parsed = parseRiskAssessRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds: _legIds, outcomes: _outcomes, stake, probabilities, bankroll, riskTolerance, categories } = parsed.data;
  const caps = RISK_CAPS[riskTolerance];
  const warnings: string[] = [];

  const numLegs = probabilities.length;

  // Use shared math (BigInt throughout, no Number overflow)
  const fairMultiplierX1e6 = computeMultiplier(probabilities);
  const edgeBps = computeEdge(numLegs);
  const netMultiplierX1e6 = applyEdge(fairMultiplierX1e6, edgeBps);

  // Win probability as float (derived from fair multiplier for display only)
  // fairMultiplier = PPM / combinedProb → combinedProb = PPM / fairMultiplier
  // winProbability = combinedProb / PPM = PPM / fairMultiplier / PPM = 1 / (fairMultiplier / PPM)
  const fairMultFloat = Number(fairMultiplierX1e6) / PPM;
  const winProbability = 1 / fairMultFloat;

  // Net multiplier as float for Kelly calculation
  // This is the actual offered payout ratio (after house edge), which is what
  // Kelly criterion needs — the "odds" the bettor is getting.
  const netMultFloat = Number(netMultiplierX1e6) / PPM;

  // Expected value per dollar staked: EV = p * netMult - 1
  // This is meaningful because netMult < fairMult (house edge), so EV < 0 for a fair bettor.
  // But if the bettor believes the true probability is higher than the market probability,
  // EV can be positive. We use the market probability here as a baseline.
  const ev = winProbability * netMultFloat - 1;
  const stakeNum = parseFloat(stake);
  const expectedValue = Math.round(ev * stakeNum * 100) / 100;

  // Kelly criterion: f* = (b*p - q) / b
  // b = net payout ratio (netMult - 1), p = win probability, q = 1 - p
  // For a parlay with house edge, Kelly will be slightly negative (EV < 0),
  // which means the optimal bet is 0. This is correct and expected — the
  // Kelly criterion says "don't bet" when the house has an edge on fair odds.
  // In practice, users bet because they believe they have an informational edge
  // (their true p > market p). We still compute and display the formula.
  const b = netMultFloat - 1;
  const p = winProbability;
  const q = 1 - p;
  let kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;

  // Cap kelly by risk tolerance
  kellyFraction = Math.min(kellyFraction, caps.maxKelly);

  // Suggested stake from Kelly
  const bankrollNum = parseFloat(bankroll);
  let suggestedStake = Math.round(kellyFraction * bankrollNum * 100) / 100;

  // Leg count warning
  if (numLegs > caps.maxLegs) {
    warnings.push(`${riskTolerance} profile recommends max ${caps.maxLegs} legs, you have ${numLegs}`);
  }

  // Win probability warning
  if (winProbability < caps.minWinProb) {
    warnings.push(`Win probability ${(winProbability * 100).toFixed(2)}% is below ${riskTolerance} minimum of ${(caps.minWinProb * 100).toFixed(0)}%`);
  }

  // Correlation detection
  if (categories && categories.length > 0) {
    const catCounts: Record<string, number> = {};
    for (const cat of categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count > 1) {
        warnings.push(`${count} legs in category "${cat}" may be correlated`);
      }
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

  // Confidence based on number of legs and probability spread
  const confidence = Math.max(0.5, 1 - (numLegs - 2) * 0.1);

  return res.json({
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
  });
});

export default router;
