/**
 * Shared cashout math for the frontend. Mirrors ParlayMath.sol computeCashoutValue
 * and packages/shared/src/math.ts. Integer arithmetic, PPM scale.
 *
 * Extracted to avoid duplication across ticket/[id]/page.tsx and tickets/page.tsx.
 */

export const PPM = 1_000_000;
export const BPS = 10_000;
export const BASE_CASHOUT_PENALTY_BPS = 1_500;

/**
 * Compute the early cashout value for a ticket using integer math.
 * Returns undefined when inputs are insufficient (no won legs, no unresolved, etc).
 */
export function computeClientCashoutValue(
  effectiveStake: bigint,
  wonProbsPPM: number[],
  unresolvedCount: number,
  totalLegs: number,
  potentialPayout: bigint,
  basePenaltyBps: number,
): bigint | undefined {
  if (wonProbsPPM.length === 0 || unresolvedCount <= 0 || totalLegs <= 0 || effectiveStake <= 0n) {
    return undefined;
  }

  // Validate basePenaltyBps is a finite non-negative integer (BigInt() throws on non-integer)
  if (!Number.isInteger(basePenaltyBps) || basePenaltyBps < 0) {
    return undefined;
  }

  const ppm = BigInt(PPM);
  let wonMultiplier = ppm;
  for (const p of wonProbsPPM) {
    // Fail fast on invalid probabilities (NaN comparisons are always false, so check isInteger first)
    if (!Number.isInteger(p) || p <= 0 || p > PPM) return undefined;
    wonMultiplier = (wonMultiplier * ppm) / BigInt(p);
  }
  const fairValue = (effectiveStake * wonMultiplier) / ppm;
  const scaledPenalty = (BigInt(basePenaltyBps) * BigInt(unresolvedCount)) / BigInt(totalLegs);

  // Guard: cap penalty at BPS to prevent negative factor
  const effectivePenalty = scaledPenalty > BigInt(BPS) ? BigInt(BPS) : scaledPenalty;
  let cv = (fairValue * (BigInt(BPS) - effectivePenalty)) / BigInt(BPS);
  if (cv > potentialPayout) cv = potentialPayout;
  return cv;
}
