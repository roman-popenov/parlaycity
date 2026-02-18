import { describe, it, expect } from "vitest";
import {
  computeMultiplier,
  computeEdge,
  applyEdge,
  computePayout,
  computeQuote,
  computeProgressivePayout,
  computeCashoutValue,
  parseUSDC,
  formatUSDC,
  parseQuoteRequest,
  parseSimRequest,
  PPM,
  BPS,
  BASE_FEE_BPS,
  PER_LEG_FEE_BPS,
  USDC_DECIMALS,
  MIN_LEGS,
  MAX_LEGS,
} from "@parlaycity/shared";

describe("computeMultiplier", () => {
  it("returns correct multiplier for two 50/50 legs", () => {
    // Two legs each at 500000 PPM (50%)
    // combined prob = 0.5 * 0.5 = 0.25
    // multiplier = 1 / 0.25 = 4.0 => 4_000_000 in x1e6
    const result = computeMultiplier([500_000, 500_000]);
    expect(result).toBe(4_000_000n);
  });

  it("returns correct multiplier for three legs (iterative truncation)", () => {
    // Mirrors ParlayMath.sol iterative: m = 1e6 -> 1e12/600000=1666666 -> 1666666e6/400000=4166665 -> 4166665e6/500000=8333330
    const result = computeMultiplier([600_000, 400_000, 500_000]);
    expect(result).toBe(8_333_330n);
  });

  it("handles high-probability legs", () => {
    const result = computeMultiplier([900_000, 900_000]);
    // 0.9 * 0.9 = 0.81 => multiplier ~ 1.234567 => 1_234_567n
    expect(result).toBe(1_234_567n);
  });
});

describe("computeEdge", () => {
  it("computes default edge for 2 legs", () => {
    const edge = computeEdge(2);
    expect(edge).toBe(BASE_FEE_BPS + 2 * PER_LEG_FEE_BPS); // 100 + 100 = 200
  });

  it("computes default edge for 5 legs", () => {
    const edge = computeEdge(5);
    expect(edge).toBe(BASE_FEE_BPS + 5 * PER_LEG_FEE_BPS); // 100 + 250 = 350
  });

  it("accepts custom fee parameters", () => {
    const edge = computeEdge(3, 200, 100);
    expect(edge).toBe(500);
  });
});

describe("applyEdge", () => {
  it("reduces multiplier by edge percentage", () => {
    // fairMultiplier = 4_000_000, edge = 200 BPS (2%)
    // net = 4_000_000 * (10000 - 200) / 10000 = 4_000_000 * 9800 / 10000 = 3_920_000
    const result = applyEdge(4_000_000n, 200);
    expect(result).toBe(3_920_000n);
  });

  it("returns zero for 100% edge", () => {
    const result = applyEdge(4_000_000n, BPS);
    expect(result).toBe(0n);
  });
});

describe("computePayout", () => {
  it("computes correct payout", () => {
    // stake = 10 USDC = 10_000_000, multiplier = 3_920_000 (3.92x)
    // payout = 10_000_000 * 3_920_000 / 1_000_000 = 39_200_000
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const result = computePayout(stake, 3_920_000n);
    expect(result).toBe(39_200_000n); // 39.2 USDC
  });
});

describe("computeQuote", () => {
  it("returns a valid quote for 2 legs", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS); // 10 USDC
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);

    expect(quote.valid).toBe(true);
    expect(quote.legIds).toEqual([1, 2]);
    expect(quote.outcomes).toEqual(["Yes", "Yes"]);
    expect(quote.edgeBps).toBe(200);

    // Fair multiplier = 4x, net = 4 * (1 - 0.02) = 3.92x
    expect(quote.multiplierX1e6).toBe("3920000");
    // Payout = 10 * 3.92 = 39.2 USDC = 39_200_000
    expect(quote.potentialPayout).toBe("39200000");
  });

  it("rejects too few legs", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000], stake, [1], ["Yes"]);
    expect(quote.valid).toBe(false);
    expect(quote.reason).toContain(`${MIN_LEGS}`);
  });

  it("rejects too many legs", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const probs = Array(MAX_LEGS + 1).fill(500_000);
    const ids = Array.from({ length: MAX_LEGS + 1 }, (_, i) => i + 1);
    const outcomes = Array(MAX_LEGS + 1).fill("Yes");
    const quote = computeQuote(probs, stake, ids, outcomes);
    expect(quote.valid).toBe(false);
    expect(quote.reason).toContain(`${MAX_LEGS}`);
  });

  it("rejects zero stake", () => {
    const quote = computeQuote([500_000, 500_000], 0n, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(false);
    expect(quote.reason).toContain("Stake");
  });

  it("rejects invalid probability", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([0, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(false);
    expect(quote.reason).toContain("Probability");
  });

  it("rejects probability at PPM boundary", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([PPM, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(false);
  });
});

describe("computeMultiplier Solidity parity", () => {
  // Reference values from ParlayMath.t.sol — must match exactly.
  // These catch TS/Solidity divergence from iterative truncation.

  it("non-round two legs: 333_333 / 666_667", () => {
    expect(computeMultiplier([333_333, 666_667])).toBe(4_500_002n);
  });

  it("non-round three legs: 600_000 / 400_000 / 500_000", () => {
    expect(computeMultiplier([600_000, 400_000, 500_000])).toBe(8_333_330n);
  });

  it("non-round four legs: 700_000 / 300_000 / 800_000 / 450_000", () => {
    expect(computeMultiplier([700_000, 300_000, 800_000, 450_000])).toBe(13_227_506n);
  });

  it("non-round five legs: 550_000 / 350_000 / 650_000 / 420_000 / 780_000", () => {
    expect(computeMultiplier([550_000, 350_000, 650_000, 420_000, 780_000])).toBe(24_395_612n);
  });

  it("handles lowest valid probability (1 PPM)", () => {
    const result = computeMultiplier([1, 1]);
    expect(result).toBe(1_000_000_000_000_000_000n);
  });

  it("handles near-maximum probability (999_999 PPM)", () => {
    const result = computeMultiplier([999_999, 999_999]);
    expect(result).toBe(1_000_002n);
  });
});

describe("computeQuote edge cases", () => {
  it("handles extreme stake (1M USDC)", () => {
    const stake = BigInt(1_000_000) * BigInt(10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(true);
    // Payout should be approximately 3.92M USDC
    expect(BigInt(quote.potentialPayout)).toBeGreaterThan(3_900_000_000_000n);
  });

  it("handles minimum valid stake (1 USDC)", () => {
    const stake = BigInt(1) * BigInt(10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(true);
    expect(BigInt(quote.potentialPayout)).toBeGreaterThan(0n);
  });
});

describe("parseUSDC / formatUSDC", () => {
  it("round-trips whole numbers", () => {
    const raw = parseUSDC("100");
    expect(raw).toBe(100_000_000n);
    expect(formatUSDC(raw)).toBe("100");
  });

  it("round-trips decimals", () => {
    const raw = parseUSDC("12.345678");
    expect(raw).toBe(12_345_678n);
    expect(formatUSDC(raw)).toBe("12.345678");
  });

  it("handles zero", () => {
    expect(parseUSDC("0")).toBe(0n);
    expect(formatUSDC(0n)).toBe("0");
  });

  it("truncates excess decimals", () => {
    // More than 6 decimals should be truncated
    const raw = parseUSDC("1.1234567");
    expect(raw).toBe(1_123_456n);
  });

  it("pads short decimals", () => {
    const raw = parseUSDC("5.1");
    expect(raw).toBe(5_100_000n);
  });
});

describe("parseQuoteRequest", () => {
  it("accepts valid request", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty legIds", () => {
    const result = parseQuoteRequest({
      legIds: [],
      outcomes: [],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched arrays", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes"],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(parseQuoteRequest({}).success).toBe(false);
    expect(parseQuoteRequest({ legIds: [1, 2] }).success).toBe(false);
  });
});

describe("parseSimRequest", () => {
  it("accepts valid request", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [500_000, 500_000],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing probabilities", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched array lengths", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [500_000],
    });
    expect(result.success).toBe(false);
  });
});

describe("computeProgressivePayout", () => {
  it("computes partial payout for won legs", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const potentialPayout = BigInt(40 * 10 ** USDC_DECIMALS);
    const { partialPayout, claimable } = computeProgressivePayout(
      stake,
      [500_000],
      potentialPayout,
      0n,
    );
    // 1 won leg at 50% => multiplier = 2x => partial = 20 USDC
    expect(partialPayout).toBe(20_000_000n);
    expect(claimable).toBe(20_000_000n);
  });

  it("subtracts already claimed amount", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const potentialPayout = BigInt(40 * 10 ** USDC_DECIMALS);
    const alreadyClaimed = 5_000_000n;
    const { partialPayout, claimable } = computeProgressivePayout(
      stake,
      [500_000],
      potentialPayout,
      alreadyClaimed,
    );
    expect(partialPayout).toBe(20_000_000n);
    expect(claimable).toBe(15_000_000n); // 20 - 5
  });

  it("caps at potential payout", () => {
    const stake = BigInt(100 * 10 ** USDC_DECIMALS);
    const potentialPayout = 5_000_000n; // only 5 USDC cap
    const { partialPayout } = computeProgressivePayout(
      stake,
      [1_000], // very low prob => huge multiplier
      potentialPayout,
      0n,
    );
    expect(partialPayout).toBe(potentialPayout);
  });

  it("throws on empty won legs", () => {
    expect(() =>
      computeProgressivePayout(10_000_000n, [], 40_000_000n, 0n),
    ).toThrow("no won legs");
  });
});

describe("computeCashoutValue", () => {
  it("computes cashout with penalty scaled by unresolved legs", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const potentialPayout = BigInt(40 * 10 ** USDC_DECIMALS);
    const { cashoutValue, penaltyBps, fairValue } = computeCashoutValue(
      stake,
      [500_000],     // 1 won leg at 50%
      2,             // 2 unresolved
      1500,          // basePenaltyBps
      3,             // totalLegs
      potentialPayout,
    );
    // fairValue = stake * multiplier(500_000) = 10 * 2 = 20 USDC
    expect(fairValue).toBe(20_000_000n);
    // penaltyBps = 1500 * 2 / 3 = 1000
    expect(penaltyBps).toBe(1000);
    // cashout = 20_000_000 * (10000 - 1000) / 10000 = 18_000_000
    expect(cashoutValue).toBe(18_000_000n);
  });

  it("penaltyBps uses integer division matching Solidity", () => {
    // Reference values from ParlayMath.t.sol — must match exactly.
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);

    // basePenaltyBps=1500, unresolvedCount=1, totalLegs=4 => 375
    const { penaltyBps: penalty1 } = computeCashoutValue(
      stake, [500_000], 1, 1500, 4, 100_000_000n,
    );
    expect(penalty1).toBe(375);

    // basePenaltyBps=1000, unresolvedCount=2, totalLegs=3 => 666
    const { penaltyBps: penalty2 } = computeCashoutValue(
      stake, [500_000], 2, 1000, 3, 100_000_000n,
    );
    expect(penalty2).toBe(666);

    // basePenaltyBps=1500, unresolvedCount=2, totalLegs=7 => 428
    // (matches test_computeCashoutValue_nonRound_penalty in ParlayMath.t.sol)
    const { penaltyBps: penalty3 } = computeCashoutValue(
      stake, [500_000], 2, 1500, 7, 100_000_000n,
    );
    expect(penalty3).toBe(428);
  });

  it("caps cashoutValue at potentialPayout", () => {
    const stake = BigInt(100 * 10 ** USDC_DECIMALS);
    const potentialPayout = 5_000_000n;
    const { cashoutValue } = computeCashoutValue(
      stake, [1_000], 1, 100, 3, potentialPayout,
    );
    expect(cashoutValue).toBe(potentialPayout);
  });

  it("throws on empty won legs", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [], 1, 1000, 3, 40_000_000n),
    ).toThrow("no won legs");
  });

  it("throws on zero unresolved count", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 0, 1000, 3, 40_000_000n),
    ).toThrow("no unresolved legs");
  });
});
