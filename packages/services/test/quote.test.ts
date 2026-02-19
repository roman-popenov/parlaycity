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

  // Input validation — mirrors ParlayMath.sol require guards
  it("throws on empty probs", () => {
    expect(() => computeMultiplier([])).toThrow("empty probs");
  });

  it("throws on zero probability", () => {
    expect(() => computeMultiplier([0, 500_000])).toThrow("prob out of range");
  });

  it("throws on probability above PPM", () => {
    expect(() => computeMultiplier([1_000_001, 500_000])).toThrow("prob out of range");
  });

  it("throws on negative probability", () => {
    expect(() => computeMultiplier([-1, 500_000])).toThrow("prob out of range");
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

describe("computeQuote response completeness", () => {
  it("valid quote contains all expected fields", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(quote.valid).toBe(true);
    expect(quote.legIds).toEqual([1, 2]);
    expect(quote.outcomes).toEqual(["Yes", "Yes"]);
    expect(quote.stake).toBeTypeOf("string");
    expect(quote.multiplierX1e6).toBeTypeOf("string");
    expect(quote.potentialPayout).toBeTypeOf("string");
    expect(quote.feePaid).toBeTypeOf("string");
    expect(quote.edgeBps).toBeTypeOf("number");
    expect(quote.probabilities).toEqual([500_000, 500_000]);
  });

  it("invalid quote still has valid/reason fields", () => {
    const quote = computeQuote([500_000], 10_000_000n, [1], ["Yes"]);
    expect(quote.valid).toBe(false);
    expect(quote.reason).toBeTypeOf("string");
    expect(quote.reason!.length).toBeGreaterThan(0);
  });

  it("feePaid is nonzero for valid quote", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(BigInt(quote.feePaid)).toBeGreaterThan(0n);
  });

  it("potentialPayout > stake for valid quote with multiplier > 1", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const quote = computeQuote([500_000, 500_000], stake, [1, 2], ["Yes", "Yes"]);
    expect(BigInt(quote.potentialPayout)).toBeGreaterThan(stake);
  });

  it("exactly 5 legs produces valid quote", () => {
    const stake = BigInt(10 * 10 ** USDC_DECIMALS);
    const probs = [500_000, 500_000, 500_000, 500_000, 500_000];
    const ids = [1, 2, 3, 4, 5];
    const outcomes = ["Yes", "Yes", "Yes", "Yes", "Yes"];
    const quote = computeQuote(probs, stake, ids, outcomes);
    expect(quote.valid).toBe(true);
    expect(quote.edgeBps).toBe(BASE_FEE_BPS + 5 * PER_LEG_FEE_BPS);
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

  it("handles large amounts", () => {
    const raw = parseUSDC("1000000");
    expect(raw).toBe(1_000_000_000_000n);
    expect(formatUSDC(raw)).toBe("1000000");
  });

  it("handles amount with only fractional part", () => {
    const raw = parseUSDC("0.000001");
    expect(raw).toBe(1n);
    expect(formatUSDC(raw)).toBe("0.000001");
  });

  it("formats trailing zeros correctly", () => {
    const raw = parseUSDC("10.5");
    expect(formatUSDC(raw)).toBe("10.5");
    // Should NOT have trailing zeros like "10.500000"
    expect(formatUSDC(raw)).not.toContain("00");
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

  it("rejects Infinity stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "Infinity",
    });
    expect(result.success).toBe(false);
  });

  it("rejects -Infinity stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "-Infinity",
    });
    expect(result.success).toBe(false);
  });

  it("rejects NaN stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "NaN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric stake", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects stake below minimum (1 USDC)", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "0.5",
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly MAX_LEGS (5) legs", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects MAX_LEGS + 1 (6) legs", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2, 3, 4, 5, 6],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only outcomes", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", ""],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive legIds", () => {
    const result = parseQuoteRequest({
      legIds: [0, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional legIds", () => {
    const result = parseQuoteRequest({
      legIds: [1.5, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(false);
  });

  // Number("0x10")=16 passes schema but parseFloat("0x10")=0 in handlers.
  // Schema should reject hex/octal/binary to prevent mismatch.
  it("rejects hex stake '0x10'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "0x10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects octal stake '0o12'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "0o12",
    });
    expect(result.success).toBe(false);
  });

  it("rejects binary stake '0b1010'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "0b1010",
    });
    expect(result.success).toBe(false);
  });
});

// ── Schema/parseUSDC alignment (Copilot review 3827617507) ───────────────
// parseDecimal accepts formats that parseUSDC can't handle (BigInt throws).
// These must be rejected at schema level or produce 400, never 500.
describe("parseQuoteRequest rejects parseUSDC-incompatible formats", () => {
  it("rejects scientific notation stake '1e2'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "1e2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects '+' prefixed stake '+10'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "+10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-padded stake ' 10 '", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: " 10 ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts plain decimal '10'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts decimal with fraction '10.5'", () => {
    const result = parseQuoteRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10.5",
    });
    expect(result.success).toBe(true);
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

  it("rejects Infinity stake", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "Infinity",
      probabilities: [500_000, 500_000],
    });
    expect(result.success).toBe(false);
  });

  it("rejects NaN stake", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "NaN",
      probabilities: [500_000, 500_000],
    });
    expect(result.success).toBe(false);
  });

  it("rejects probability of 0", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [0, 500_000],
    });
    expect(result.success).toBe(false);
  });

  it("rejects probability at PPM boundary (1_000_000)", () => {
    const result = parseSimRequest({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [1_000_000, 500_000],
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
      3,             // totalLegs
      potentialPayout,
      1500,          // basePenaltyBps
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
      stake, [500_000], 1, 4, 100_000_000n, 1500,
    );
    expect(penalty1).toBe(375);

    // basePenaltyBps=1000, unresolvedCount=2, totalLegs=3 => 666
    const { penaltyBps: penalty2 } = computeCashoutValue(
      stake, [500_000], 2, 3, 100_000_000n, 1000,
    );
    expect(penalty2).toBe(666);

    // basePenaltyBps=1500, unresolvedCount=2, totalLegs=7 => 428
    // (matches test_computeCashoutValue_nonRound_penalty in ParlayMath.t.sol)
    const { penaltyBps: penalty3 } = computeCashoutValue(
      stake, [500_000], 2, 7, 100_000_000n, 1500,
    );
    expect(penalty3).toBe(428);
  });

  it("caps cashoutValue at potentialPayout", () => {
    const stake = BigInt(100 * 10 ** USDC_DECIMALS);
    const potentialPayout = 5_000_000n;
    const { cashoutValue } = computeCashoutValue(
      stake, [1_000], 1, 3, potentialPayout, 100,
    );
    expect(cashoutValue).toBe(potentialPayout);
  });

  it("throws on empty won legs", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [], 1, 3, 40_000_000n, 1000),
    ).toThrow("no won legs");
  });

  it("throws on zero unresolved count", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 0, 3, 40_000_000n, 1000),
    ).toThrow("no unresolved legs");
  });

  it("throws on zero totalLegs", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 1, 0, 40_000_000n, 1000),
    ).toThrow("zero totalLegs");
  });

  it("throws on unresolvedCount > totalLegs", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 5, 3, 40_000_000n, 1000),
    ).toThrow("unresolved > total");
  });

  it("throws on basePenaltyBps > BPS", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 1, 3, 40_000_000n, 10_001),
    ).toThrow("penalty out of range");
  });

  it("throws on negative basePenaltyBps", () => {
    expect(() =>
      computeCashoutValue(10_000_000n, [500_000], 1, 3, 40_000_000n, -1),
    ).toThrow("penalty out of range");
  });
});
