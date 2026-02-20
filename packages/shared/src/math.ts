import {
  PPM,
  BPS,
  BASE_FEE_BPS,
  PER_LEG_FEE_BPS,
  BASE_CASHOUT_PENALTY_BPS,
  USDC_DECIMALS,
  MIN_LEGS,
  MAX_LEGS,
  MIN_STAKE_USDC,
} from "./constants.js";
import type { QuoteResponse } from "./types.js";

/**
 * Multiply probabilities (each in PPM) to get combined fair multiplier in x1e6.
 * Uses iterative division to mirror ParlayMath.sol exactly:
 *   multiplier = PPM; multiplier = multiplier * PPM / prob_i for each leg.
 *
 * NOTE: This was refactored from single-division (PPM^(n+1) / product(probs))
 * to iterative division. BigInt truncation at each step can produce results
 * that differ by at most 1 unit from the old formula for certain inputs.
 * The iterative approach is correct because it matches the Solidity contract's
 * computation exactly (shared math parity invariant).
 */
export function computeMultiplier(probsPPM: number[]): bigint {
  if (probsPPM.length === 0) {
    throw new Error("computeMultiplier: empty probs");
  }
  const ppm = BigInt(PPM);
  let multiplier = ppm; // start at 1x (1_000_000)
  for (const p of probsPPM) {
    if (p <= 0 || p > PPM) {
      throw new Error("computeMultiplier: prob out of range");
    }
    multiplier = (multiplier * ppm) / BigInt(p);
  }
  return multiplier;
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

/**
 * Compute progressive payout: partial claim based on won legs.
 * Returns the total partial payout and the new claimable amount.
 */
export function computeProgressivePayout(
  effectiveStake: bigint,
  wonProbsPPM: number[],
  potentialPayout: bigint,
  alreadyClaimed: bigint
): { partialPayout: bigint; claimable: bigint } {
  if (wonProbsPPM.length === 0) {
    throw new Error("computeProgressivePayout: no won legs");
  }
  const partialMultiplier = computeMultiplier(wonProbsPPM);
  let partialPayout = computePayout(effectiveStake, partialMultiplier);
  if (partialPayout > potentialPayout) partialPayout = potentialPayout;
  const claimable = partialPayout > alreadyClaimed ? partialPayout - alreadyClaimed : 0n;
  return { partialPayout, claimable };
}

/**
 * Compute cashout value for an early exit.
 * fairValue = wonValue (expected value given won legs; unresolved risk priced via penalty)
 * penaltyBps = basePenaltyBps * unresolvedCount / totalLegs
 * cashoutValue = fairValue * (BPS - penaltyBps) / BPS
 */
export function computeCashoutValue(
  effectiveStake: bigint,
  wonProbsPPM: number[],
  unresolvedCount: number,
  basePenaltyBps: number,
  totalLegs: number,
  potentialPayout: bigint,
): { cashoutValue: bigint; penaltyBps: number; fairValue: bigint } {
  if (wonProbsPPM.length === 0) {
    throw new Error("computeCashoutValue: no won legs");
  }
  if (totalLegs <= 0) {
    throw new Error("computeCashoutValue: zero totalLegs");
  }
  if (unresolvedCount <= 0) {
    throw new Error("computeCashoutValue: no unresolved legs");
  }
  if (unresolvedCount > totalLegs) {
    throw new Error("computeCashoutValue: unresolved > total");
  }
  if (basePenaltyBps < 0 || basePenaltyBps > BPS) {
    throw new Error("computeCashoutValue: penalty out of range");
  }

  const bps = BigInt(BPS);

  // Fair value = expected payout given won legs.
  // wonMultiplier = 1/product(wonProbs) in PPM; wonValue = stake / product(wonProbs).
  // This already equals Prob(unresolved win) × fullPayout because the unresolved
  // probabilities cancel out when deriving EV from won legs alone.
  // The penalty (below) prices in the risk of unresolved legs.
  const wonMultiplier = computeMultiplier(wonProbsPPM);
  const fairValue = computePayout(effectiveStake, wonMultiplier);

  // Scaled penalty
  const penaltyBps = Number(
    (BigInt(basePenaltyBps) * BigInt(unresolvedCount)) / BigInt(totalLegs),
  );
  let cashoutValue = (fairValue * (bps - BigInt(penaltyBps))) / bps;

  // Cap at potential payout
  if (cashoutValue > potentialPayout) {
    cashoutValue = potentialPayout;
  }

  return { cashoutValue, penaltyBps, fairValue };
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
