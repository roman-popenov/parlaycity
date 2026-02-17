import {
  PPM,
  BPS,
  BASE_FEE_BPS,
  PER_LEG_FEE_BPS,
  USDC_DECIMALS,
  MIN_LEGS,
  MAX_LEGS,
  MIN_STAKE_USDC,
} from "./constants.js";
import type { QuoteResponse } from "./types.js";

/**
 * Multiply probabilities (each in PPM) to get combined fair multiplier in x1e6.
 * multiplier = PPM^n / product(probs)
 * This mirrors ParlayMath.sol: combined probability = p1*p2*...*pn / PPM^(n-1),
 * multiplier = PPM / combinedProbability = PPM^n / product(probs).
 */
export function computeMultiplier(probsPPM: number[]): bigint {
  const ppm = BigInt(PPM);
  let numerator = 1n;
  let denominator = 1n;
  for (const p of probsPPM) {
    numerator *= ppm;
    denominator *= BigInt(p);
  }
  // Result is in x1e6 (same scale as PPM)
  // multiplierX1e6 = (PPM^n * PPM) / product(probs)
  // Actually: fair multiplier = 1/combinedProb, expressed in x1e6
  // combinedProb = product(probs) / PPM^(n-1)
  // multiplier = 1/combinedProb = PPM^(n-1) / product(probs), but we want x1e6 output
  // multiplierX1e6 = PPM^n / product(probs)
  return (numerator * ppm) / denominator;
}

/**
 * Compute the house edge in BPS for a given number of legs.
 * edge = baseBps + (numLegs * perLegBps)
 */
export function computeEdge(
  numLegs: number,
  baseBps: number = BASE_FEE_BPS,
  perLegBps: number = PER_LEG_FEE_BPS
): number {
  return baseBps + numLegs * perLegBps;
}

/**
 * Apply house edge to the fair multiplier.
 * netMultiplier = fairMultiplier * (BPS - edgeBps) / BPS
 */
export function applyEdge(fairMultiplierX1e6: bigint, edgeBps: number): bigint {
  return (fairMultiplierX1e6 * BigInt(BPS - edgeBps)) / BigInt(BPS);
}

/**
 * Compute payout from stake and net multiplier.
 * payout = stake * netMultiplierX1e6 / PPM
 */
export function computePayout(stake: bigint, netMultiplierX1e6: bigint): bigint {
  return (stake * netMultiplierX1e6) / BigInt(PPM);
}

/**
 * Full quote computation. Takes leg probabilities (PPM) and raw stake (USDC with decimals).
 * Returns a complete QuoteResponse.
 */
export function computeQuote(
  legProbsPPM: number[],
  stakeRaw: bigint,
  legIds: number[] = [],
  outcomes: string[] = []
): QuoteResponse {
  const numLegs = legProbsPPM.length;

  if (numLegs < MIN_LEGS || numLegs > MAX_LEGS) {
    return invalidQuote(legIds, outcomes, stakeRaw, legProbsPPM, `Leg count must be ${MIN_LEGS}-${MAX_LEGS}`);
  }

  const minStakeRaw = BigInt(MIN_STAKE_USDC) * BigInt(10 ** USDC_DECIMALS);
  if (stakeRaw < minStakeRaw) {
    return invalidQuote(legIds, outcomes, stakeRaw, legProbsPPM, `Stake must be at least ${MIN_STAKE_USDC} USDC`);
  }

  for (const p of legProbsPPM) {
    if (p <= 0 || p >= PPM) {
      return invalidQuote(legIds, outcomes, stakeRaw, legProbsPPM, "Probability must be between 0 and 1000000 exclusive");
    }
  }

  const fairMultiplier = computeMultiplier(legProbsPPM);
  const edgeBps = computeEdge(numLegs);
  const netMultiplier = applyEdge(fairMultiplier, edgeBps);
  const potentialPayout = computePayout(stakeRaw, netMultiplier);
  const feePaid = computePayout(stakeRaw, fairMultiplier) - potentialPayout;

  return {
    legIds,
    outcomes,
    stake: stakeRaw.toString(),
    multiplierX1e6: netMultiplier.toString(),
    potentialPayout: potentialPayout.toString(),
    feePaid: feePaid.toString(),
    edgeBps,
    probabilities: legProbsPPM,
    valid: true,
  };
}

function invalidQuote(
  legIds: number[],
  outcomes: string[],
  stakeRaw: bigint,
  probabilities: number[],
  reason: string
): QuoteResponse {
  return {
    legIds,
    outcomes,
    stake: stakeRaw.toString(),
    multiplierX1e6: "0",
    potentialPayout: "0",
    feePaid: "0",
    edgeBps: 0,
    probabilities,
    valid: false,
    reason,
  };
}
