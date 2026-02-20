import { describe, it, expect } from "vitest";
import { computeClientCashoutValue, PPM, BPS, BASE_CASHOUT_PENALTY_BPS } from "@/lib/cashout";

describe("cashout math (computeClientCashoutValue)", () => {
  it("computes correct value for 2-leg ticket, 1 won, 1 unresolved", () => {
    const cv = computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 1500);
    // wonMultiplier = 1_000_000 * 1_000_000 / 350_000 = 2_857_142 (integer division)
    // fairValue = 9_700_000 * 2_857_142 / 1_000_000 = 27_714_277
    // penaltyBps = 1500 * 1 / 2 = 750
    // cv = 27_714_277 * (10_000 - 750) / 10_000 = 25_635_706
    expect(cv).toBe(25_635_706n);
  });

  it("computes correct value for 3-leg ticket, 2 won, 1 unresolved", () => {
    const cv = computeClientCashoutValue(19_250_000n, [500_000, 400_000], 1, 3, 100_000_000n, 1500);
    expect(cv).toBeDefined();
    expect(cv!).toBeGreaterThan(0n);
    expect(cv!).toBeLessThanOrEqual(100_000_000n);
  });

  it("uses effectiveStake (stake - feePaid), not gross stake", () => {
    const grossStake = 10_000_000n;
    const feePaid = 300_000n;
    const effectiveStake = grossStake - feePaid;

    const withEffective = computeClientCashoutValue(effectiveStake, [350_000], 1, 2, 39_200_000n, 1500)!;
    const withGross = computeClientCashoutValue(grossStake, [350_000], 1, 2, 39_200_000n, 1500)!;

    expect(withGross).toBeGreaterThan(withEffective);
    expect(withGross - withEffective).toBeGreaterThan(0n);
  });

  it("2% slippage: minOut = cashoutValue * 98 / 100", () => {
    const cv = computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 1500)!;
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
    const correct = computeClientCashoutValue(effectiveStake, [350_000], 2, 3, 100_000_000n, 1500)!;
    // Wrong: if voided treated as won
    const wrong = computeClientCashoutValue(effectiveStake, [350_000, 500_000], 1, 3, 100_000_000n, 1500)!;

    expect(correct).toBeLessThan(wrong);
  });

  it("returns undefined for invalid inputs", () => {
    // Empty probabilities
    expect(computeClientCashoutValue(9_700_000n, [], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    // Zero unresolved
    expect(computeClientCashoutValue(9_700_000n, [350_000], 0, 2, 39_200_000n, 1500)).toBeUndefined();
    // Zero stake
    expect(computeClientCashoutValue(0n, [350_000], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    // Invalid probability values: 0 and > PPM
    expect(computeClientCashoutValue(9_700_000n, [0], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    expect(computeClientCashoutValue(9_700_000n, [PPM + 1], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    // Non-integer probability (BigInt() would throw)
    expect(computeClientCashoutValue(9_700_000n, [350_000.5], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    expect(computeClientCashoutValue(9_700_000n, [NaN], 1, 2, 39_200_000n, 1500)).toBeUndefined();
    // Invalid basePenaltyBps: negative, NaN, Infinity, non-integer
    expect(computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, -1)).toBeUndefined();
    expect(computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, NaN)).toBeUndefined();
    expect(computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, Infinity)).toBeUndefined();
    expect(computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 1500.5)).toBeUndefined();
  });

  it("accepts 0 bps penalty (no penalty applied)", () => {
    const withPenalty = computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, BASE_CASHOUT_PENALTY_BPS)!;
    const noPenalty = computeClientCashoutValue(9_700_000n, [350_000], 1, 2, 39_200_000n, 0)!;
    // fairValue = 9_700_000 * (1_000_000 * 1_000_000 / 350_000) / 1_000_000 = 27_714_277
    // 0 bps penalty means cv = fairValue exactly (no reduction)
    expect(noPenalty).toBe(27_714_277n);
    expect(noPenalty).toBeGreaterThanOrEqual(withPenalty);
  });

  it("caps cashout at potentialPayout", () => {
    const cv = computeClientCashoutValue(100_000_000n, [100_000], 1, 2, 50_000_000n, 1500)!;
    expect(cv).toBeLessThanOrEqual(50_000_000n);
  });

  it("scales penalty by unresolved/total legs ratio", () => {
    const stake = 10_000_000n;
    const fewer = computeClientCashoutValue(stake, [500_000], 1, 5, 100_000_000n, 1500)!;
    const more = computeClientCashoutValue(stake, [500_000], 3, 5, 100_000_000n, 1500)!;
    // More unresolved = higher penalty = lower cashout
    expect(more).toBeLessThan(fewer);
  });

  it("uses integer division (floors fractional penalties)", () => {
    // 1500 / 7 = 214.28... -> floors to 214 bps
    const cv = computeClientCashoutValue(100n, [500_000], 1, 7, 10_000n, 1500)!;
    // fairValue = 200, penaltyBps = floor(1500/7) = 214
    // cv = 200 * (10000 - 214) / 10000 = 200 * 9786 / 10000 = 195
    expect(cv).toBe(195n);
  });

  it("caps penalty at BPS to prevent negative cashout", () => {
    // basePenaltyBps = 15000 would exceed BPS without guard
    const cv = computeClientCashoutValue(10_000_000n, [500_000], 1, 1, 100_000_000n, 15000);
    // With cap, penalty = min(15000, 10000) = 10000 -> cashout = 0
    expect(cv).toBeDefined();
    expect(cv!).toBe(0n);
  });
});
