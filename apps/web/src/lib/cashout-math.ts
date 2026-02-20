/**
 * Client-side cashout value computation. Mirrors the shared math
 * computeCashoutValue logic to avoid cross-package import issues.
 * Uses the same PPM/BPS scales and integer arithmetic.
 */

const PPM = 1_000_000;
const BPS = 10_000;
const BASE_CASHOUT_PENALTY_BPS = 1_500; // 15% base penalty

function computeMultiplierFromPPM(probsPPM: number[]): bigint {
  const ppm = BigInt(PPM);
  let multiplier = ppm;
  for (const p of probsPPM) {
    if (p <= 0 || p > PPM) return 0n;
    multiplier = (multiplier * ppm) / BigInt(p);
  }
  return multiplier;
}

function computePayoutBigInt(stake: bigint, multiplierX1e6: bigint): bigint {
  return (stake * multiplierX1e6) / BigInt(PPM);
}

export function computeCashoutValueLocal(
  stake: bigint,
  wonProbsPPM: number[],
  unresolvedCount: number,
  totalLegs: number,
  potentialPayout: bigint,
): bigint | null {
  if (wonProbsPPM.length === 0 || unresolvedCount <= 0 || totalLegs <= 0) return null;

  const wonMultiplier = computeMultiplierFromPPM(wonProbsPPM);
  if (wonMultiplier === 0n) return null;

  const fairValue = computePayoutBigInt(stake, wonMultiplier);
  const penaltyBps = (BigInt(BASE_CASHOUT_PENALTY_BPS) * BigInt(unresolvedCount)) / BigInt(totalLegs);
  let cashoutValue = (fairValue * (BigInt(BPS) - penaltyBps)) / BigInt(BPS);

  if (cashoutValue > potentialPayout) {
    cashoutValue = potentialPayout;
  }

  return cashoutValue;
}
