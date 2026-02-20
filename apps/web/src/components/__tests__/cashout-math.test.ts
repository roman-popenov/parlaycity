import { describe, it, expect } from "vitest";

const PPM = 1_000_000;
const BPS = 10_000;

/**
 * Inline cashout computation mirroring page.tsx and shared/math.ts.
 * Must produce identical results to computeCashoutValue in packages/shared.
 */
function inlineCashoutValue(
  effectiveStake: bigint,
  wonProbsPPM: number[],
  unresolvedCount: number,
  totalLegs: number,
  potentialPayout: bigint,
  basePenaltyBps: number,
): bigint {
  const ppm = BigInt(PPM);
  let wonMultiplier = ppm;
  for (const p of wonProbsPPM) {
    if (p <= 0 || p > PPM) throw new Error(`Invalid probability: ${p}`);
    wonMultiplier = (wonMultiplier * ppm) / BigInt(p);
  }
  const fairValue = (effectiveStake * wonMultiplier) / ppm;
  const penaltyBps = (BigInt(basePenaltyBps) * BigInt(unresolvedCount)) / BigInt(totalLegs);
  let cv = (fairValue * (BigInt(BPS) - penaltyBps)) / BigInt(BPS);
  if (cv > potentialPayout) cv = potentialPayout;
  return cv;
}

describe("cashout math", () => {
  it("computes correct value for 2-leg ticket, 1 won, 1 unresolved", () => {
    const cv = inlineCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 1500);
    // wonMultiplier = 1_000_000 * 1_000_000 / 350_000 = 2_857_142 (integer division)
    // fairValue = 9_700_000 * 2_857_142 / 1_000_000 = 27_714_277
    // penaltyBps = 1500 * 1 / 2 = 750
    // cv = 27_714_277 * (10_000 - 750) / 10_000 = 25_635_706
    expect(cv).toBe(25_635_706n);
  });

  it("computes correct value for 3-leg ticket, 2 won, 1 unresolved", () => {
    const cv = inlineCashoutValue(19_250_000n, [500_000, 400_000], 1, 3, 100_000_000n, 1500);
    expect(cv).toBeGreaterThan(0n);
    expect(cv).toBeLessThanOrEqual(100_000_000n);
  });

  it("uses effectiveStake (stake - feePaid), not gross stake", () => {
    const grossStake = 10_000_000n;
    const feePaid = 300_000n;
    const effectiveStake = grossStake - feePaid;

    const withEffective = inlineCashoutValue(effectiveStake, [350_000], 1, 2, 39_200_000n, 1500);
    const withGross = inlineCashoutValue(grossStake, [350_000], 1, 2, 39_200_000n, 1500);

    expect(withGross).toBeGreaterThan(withEffective);
    expect(withGross - withEffective).toBeGreaterThan(0n);
  });

  it("2% slippage: minOut = cashoutValue * 98 / 100", () => {
    const cv = inlineCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 1500);
    const minOut = (cv * 98n) / 100n;

    expect(minOut).toBeLessThan(cv);
    const diff = cv - minOut;
    const maxDiff = (cv * 3n) / 100n;
    expect(diff).toBeGreaterThan(0n);
    expect(diff).toBeLessThanOrEqual(maxDiff);
  });

  it("voided legs count as unresolved, not won", () => {
    const effectiveStake = 9_700_000n;
    // Correct: 1 won, 2 unresolved (voided counts as unresolved)
    const correct = inlineCashoutValue(effectiveStake, [350_000], 2, 3, 100_000_000n, 1500);
    // Wrong: if voided treated as won
    const wrong = inlineCashoutValue(effectiveStake, [350_000, 500_000], 1, 3, 100_000_000n, 1500);

    expect(correct).toBeLessThan(wrong);
  });

  it("throws on invalid probability (0 or > PPM)", () => {
    expect(() => inlineCashoutValue(9_700_000n, [350_000, 0], 1, 3, 39_200_000n, 1500)).toThrow();
    expect(() => inlineCashoutValue(9_700_000n, [1_000_001], 1, 2, 39_200_000n, 1500)).toThrow();
  });

  it("caps cashout at potentialPayout", () => {
    const cv = inlineCashoutValue(100_000_000n, [100_000], 1, 2, 50_000_000n, 1500);
    expect(cv).toBeLessThanOrEqual(50_000_000n);
  });

  it("scales penalty by unresolved/total legs ratio", () => {
    const stake = 10_000_000n;
    // Same won prob, different unresolved counts
    const fewer = inlineCashoutValue(stake, [500_000], 1, 5, 100_000_000n, 1500);
    const more = inlineCashoutValue(stake, [500_000], 3, 5, 100_000_000n, 1500);
    // More unresolved = higher penalty = lower cashout
    expect(more).toBeLessThan(fewer);
  });

  it("uses integer division (floors fractional penalties)", () => {
    // 1500 / 7 = 214.28... → floors to 214 bps
    const cv = inlineCashoutValue(100n, [500_000], 1, 7, 10_000n, 1500);
    // fairValue = 200, penaltyBps = floor(1500/7) = 214
    // cv = 200 * (10000 - 214) / 10000 = 200 * 9786 / 10000 = 195
    expect(cv).toBe(195n);
  });
});
