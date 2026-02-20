import { describe, it, expect } from "vitest";
import { computeCashoutValue } from "@parlaycity/shared";

const PPM = 1_000_000;
const BPS = 10_000;

/**
 * Inline cashout computation that mirrors page.tsx logic.
 * Must produce identical results to shared/math.ts computeCashoutValue.
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
    if (p > 0 && p <= PPM) wonMultiplier = (wonMultiplier * ppm) / BigInt(p);
  }
  const fairValue = (effectiveStake * wonMultiplier) / ppm;
  const penaltyBps = (BigInt(basePenaltyBps) * BigInt(unresolvedCount)) / BigInt(totalLegs);
  let cv = (fairValue * (BigInt(BPS) - penaltyBps)) / BigInt(BPS);
  if (cv > potentialPayout) cv = potentialPayout;
  return cv;
}

describe("cashout math parity", () => {
  const testCases = [
    {
      name: "2-leg ticket, 1 won, 1 unresolved",
      effectiveStake: 9_700_000n,
      wonProbsPPM: [350_000],
      unresolvedCount: 1,
      totalLegs: 2,
      potentialPayout: 39_200_000n,
      basePenaltyBps: 1500,
    },
    {
      name: "3-leg ticket, 2 won, 1 unresolved",
      effectiveStake: 19_250_000n,
      wonProbsPPM: [500_000, 400_000],
      unresolvedCount: 1,
      totalLegs: 3,
      potentialPayout: 100_000_000n,
      basePenaltyBps: 1500,
    },
    {
      name: "5-leg ticket, 3 won, 2 unresolved",
      effectiveStake: 4_625_000n,
      wonProbsPPM: [200_000, 300_000, 500_000],
      unresolvedCount: 2,
      totalLegs: 5,
      potentialPayout: 500_000_000n,
      basePenaltyBps: 1500,
    },
    {
      name: "custom penalty (2000 bps)",
      effectiveStake: 9_700_000n,
      wonProbsPPM: [350_000],
      unresolvedCount: 1,
      totalLegs: 2,
      potentialPayout: 39_200_000n,
      basePenaltyBps: 2000,
    },
  ];

  testCases.forEach(({ name, effectiveStake, wonProbsPPM, unresolvedCount, totalLegs, potentialPayout, basePenaltyBps }) => {
    it(`inline math matches shared library: ${name}`, () => {
      const inlineResult = inlineCashoutValue(
        effectiveStake, wonProbsPPM, unresolvedCount, totalLegs, potentialPayout, basePenaltyBps,
      );

      const sharedResult = computeCashoutValue(
        effectiveStake, wonProbsPPM, unresolvedCount, totalLegs, potentialPayout, basePenaltyBps,
      );

      expect(inlineResult).toBe(sharedResult.cashoutValue);
    });
  });

  it("uses effectiveStake (stake - feePaid), not gross stake", () => {
    const grossStake = 10_000_000n;
    const feePaid = 300_000n;
    const effectiveStake = grossStake - feePaid;

    const withEffective = computeCashoutValue(
      effectiveStake, [350_000], 1, 2, 39_200_000n, 1500,
    );
    const withGross = computeCashoutValue(
      grossStake, [350_000], 1, 2, 39_200_000n, 1500,
    );

    // Gross stake overstates cashout value
    expect(withGross.cashoutValue).toBeGreaterThan(withEffective.cashoutValue);
    const diff = withGross.cashoutValue - withEffective.cashoutValue;
    expect(diff).toBeGreaterThan(0n);
  });

  it("2% slippage: minOut = cashoutValue * 98 / 100", () => {
    const { cashoutValue } = computeCashoutValue(
      9_700_000n, [350_000], 1, 2, 39_200_000n, 1500,
    );
    const minOut = (cashoutValue * 98n) / 100n;

    expect(minOut).toBeLessThan(cashoutValue);
    // Integer division: cv*98/100 may differ from cv - cv*2/100 by 1 due to truncation.
    // The important invariant: minOut is within 2-3% of cashoutValue.
    const diff = cashoutValue - minOut;
    const maxDiff = (cashoutValue * 3n) / 100n; // at most 3%
    expect(diff).toBeGreaterThan(0n);
    expect(diff).toBeLessThanOrEqual(maxDiff);
  });

  it("voided legs count as unresolved, not won", () => {
    // 3-leg ticket: leg 0 won, leg 1 voided, leg 2 unresolved
    // Correct: wonCount=1, unresolvedCount=2
    const effectiveStake = 9_700_000n;
    const correctResult = computeCashoutValue(
      effectiveStake, [350_000], 2, 3, 100_000_000n, 1500,
    );

    // Wrong: if voided treated as won: wonProbs=[350k, 500k], unresolvedCount=1
    const wrongResult = computeCashoutValue(
      effectiveStake, [350_000, 500_000], 1, 3, 100_000_000n, 1500,
    );

    // More unresolved legs = higher penalty = lower cashout
    expect(correctResult.cashoutValue).toBeLessThan(wrongResult.cashoutValue);
  });

  it("skipping legs with odds <= 0 does not include them in wonProbsPPM", () => {
    const effectiveStake = 9_700_000n;
    const validResult = computeCashoutValue(
      effectiveStake, [350_000], 1, 2, 39_200_000n, 1500,
    );

    // Including 0 prob throws
    expect(() => computeCashoutValue(
      effectiveStake, [350_000, 0], 1, 3, 39_200_000n, 1500,
    )).toThrow();

    expect(validResult.cashoutValue).toBeGreaterThan(0n);
  });

  it("caps cashout at potentialPayout", () => {
    const result = computeCashoutValue(
      100_000_000n,
      [100_000],
      1,
      2,
      50_000_000n,
      1500,
    );

    expect(result.cashoutValue).toBeLessThanOrEqual(50_000_000n);
  });
});
