import { Router } from "express";
import { parseSimRequest, PPM } from "@parlaycity/shared";
import { x402Guard } from "./x402.js";

const router = Router();

/**
 * POST /premium/sim
 * x402-gated endpoint that returns analytical "simulation" results:
 * win probability, expected value, Kelly criterion suggestion.
 */
router.post("/sim", x402Guard, (req, res) => {
  const parsed = parseSimRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds, outcomes, stake, probabilities } = parsed.data;

  // Combined win probability = product(p_i) / PPM^(n-1)
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

  // Win probability as a float
  const winProbability = Number(combinedProbNumerator) / Number(combinedProbDenominator) / PPM;

  // Fair multiplier (decimal)
  const fairMultiplier = 1 / winProbability;

  // Expected value: stake * (winProb * multiplier - 1)
  // With house edge applied, the net multiplier is lower, so EV is negative
  // We report the fair EV here (before edge)
  const stakeNum = parseFloat(stake);
  const expectedValue = stakeNum * (winProbability * fairMultiplier - 1);

  // Kelly criterion: f* = (bp - q) / b
  // where b = net odds (multiplier - 1), p = win prob, q = 1 - p
  // For fair odds, Kelly = 0 (no edge). We compute for illustration.
  const b = fairMultiplier - 1;
  const p = winProbability;
  const q = 1 - p;
  const kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
  const kellySuggestedStake = kellyFraction * 100; // as % of bankroll

  return res.json({
    legIds,
    outcomes,
    stake,
    winProbability: Math.round(winProbability * 1_000_000) / 1_000_000,
    fairMultiplier: Math.round(fairMultiplier * 100) / 100,
    expectedValue: Math.round(expectedValue * 100) / 100,
    kellyFraction: Math.round(kellyFraction * 10_000) / 10_000,
    kellySuggestedStakePct: Math.round(kellySuggestedStake * 100) / 100,
    note: "Analytical computation (not Monte Carlo). Fair values before house edge.",
  });
});

export default router;
