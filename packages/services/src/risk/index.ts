import { Router } from "express";
import { parseRiskAssessRequest, PPM, BPS, BASE_FEE_BPS, PER_LEG_FEE_BPS } from "@parlaycity/shared";
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

  const { legIds, outcomes, stake, probabilities, bankroll, riskTolerance, categories } = parsed.data;
  const caps = RISK_CAPS[riskTolerance];
  const warnings: string[] = [];

  // Combined win probability
  const numLegs = probabilities.length;
  let combinedProbNumerator = 1n;
  for (const p of probabilities) {
    combinedProbNumerator *= BigInt(p);
  }
  const ppmBig = BigInt(PPM);
  let combinedProbDenominator = 1n;
  for (let i = 0; i < numLegs - 1; i++) {
    combinedProbDenominator *= ppmBig;
  }
  const winProbability = Number(combinedProbNumerator) / Number(combinedProbDenominator) / PPM;

  // Fair multiplier
  const fairMultiplier = 1 / winProbability;

  // Edge
  const edgeBps = BASE_FEE_BPS + numLegs * PER_LEG_FEE_BPS;
  const netMultiplier = fairMultiplier * (BPS - edgeBps) / BPS;

  // Expected value per dollar staked
  const ev = winProbability * netMultiplier - 1;
  const stakeNum = parseFloat(stake);
  const expectedValue = Math.round(ev * stakeNum * 100) / 100;

  // Kelly criterion: f* = (b*p - q) / b where b = netMultiplier - 1
  const b = netMultiplier - 1;
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
  let action: "BUY" | "REDUCE_STAKE" | "AVOID" = "BUY";
  let reasoning = "";

  if (winProbability < caps.minWinProb || numLegs > caps.maxLegs) {
    action = "AVOID";
    reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability exceeds ${riskTolerance} risk tolerance limits.`;
  } else if (suggestedStake < stakeNum) {
    action = "REDUCE_STAKE";
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
    fairMultiplier: Math.round(fairMultiplier * 100) / 100,
    edgeBps,
  });
});

export default router;
