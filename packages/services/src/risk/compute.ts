import {
  PPM,
  computeMultiplier,
  computeEdge,
  applyEdge,
  RiskAction,
} from "@parlaycity/shared";
import type { RiskProfile, RiskAssessResponse } from "@parlaycity/shared";

/** Risk tolerance caps per profile. */
export const RISK_CAPS: Record<RiskProfile, { maxKelly: number; maxLegs: number; minWinProb: number }> = {
  conservative: { maxKelly: 0.05, maxLegs: 3, minWinProb: 0.15 },
  moderate: { maxKelly: 0.15, maxLegs: 4, minWinProb: 0.05 },
  aggressive: { maxKelly: 1.0, maxLegs: 5, minWinProb: 0.0 },
};

export interface RiskInput {
  stake: string;
  bankroll: string;
  riskTolerance: RiskProfile;
  probabilities: number[];
  categories?: string[];
}

/**
 * Compute a full risk assessment response from inputs.
 * Shared by both `/premium/risk-assess` and `/premium/agent-quote`.
 *
 * Returns `{ ok: true, data }` on success, or `{ ok: false, data }` with
 * an AVOID response when the multiplier exceeds safe integer range or
 * probability data is invalid.
 */
export function computeRiskAssessment(
  input: RiskInput,
): { ok: true; data: RiskAssessResponse } | { ok: false; data: RiskAssessResponse } {
  const { stake, bankroll, riskTolerance, probabilities, categories } = input;
  const caps = RISK_CAPS[riskTolerance];
  const warnings: string[] = [];
  const numLegs = probabilities.length;
  const edgeBps = computeEdge(numLegs);

  // computeMultiplier throws on invalid probabilities (<= 0 or > PPM)
  let fairMultiplierX1e6: bigint;
  try {
    fairMultiplierX1e6 = computeMultiplier(probabilities);
  } catch {
    return {
      ok: false,
      data: {
        action: RiskAction.AVOID,
        suggestedStake: "0.00",
        kellyFraction: 0,
        winProbability: 0,
        expectedValue: 0,
        confidence: 0.5,
        reasoning: "Invalid leg probability encountered while computing the combined multiplier. This parlay cannot be safely priced.",
        warnings: ["Invalid probability from catalog data"],
        riskTolerance,
        fairMultiplier: 0,
        netMultiplier: 0,
        edgeBps,
      },
    };
  }

  const netMultiplierX1e6 = applyEdge(fairMultiplierX1e6, edgeBps);

  // Guard: if multiplier exceeds safe integer range, the parlay is too extreme
  if (fairMultiplierX1e6 > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      data: {
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
      },
    };
  }

  // Win probability (derived from fair multiplier)
  const fairMultFloat = Number(fairMultiplierX1e6) / PPM;
  const winProbability = 1 / fairMultFloat;

  // Net multiplier for Kelly calculation (actual offered payout ratio after house edge)
  const netMultFloat = Number(netMultiplierX1e6) / PPM;

  // Expected value per dollar staked: EV = p * netMult - 1
  const ev = winProbability * netMultFloat - 1;
  const stakeNum = Number(stake);
  const expectedValue = Math.round(ev * stakeNum * 100) / 100;

  // Kelly criterion: f* = (b*p - q) / b
  const b = netMultFloat - 1;
  const p = winProbability;
  const q = 1 - p;
  let kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
  kellyFraction = Math.min(kellyFraction, caps.maxKelly);

  const bankrollNum = Number(bankroll);
  const suggestedStake = Math.round(kellyFraction * bankrollNum * 100) / 100;

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

  const confidence = Math.max(0.5, 1 - (numLegs - 2) * 0.1);

  return {
    ok: true,
    data: {
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
    },
  };
}
