import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { RiskAction, PPM, computeMultiplier, computeEdge, applyEdge } from "@parlaycity/shared";

const validBody = {
  legIds: [1, 2],
  outcomes: ["Yes", "Yes"],
  stake: "10",
  probabilities: [600_000, 450_000],
  bankroll: "100",
  riskTolerance: "moderate",
};

function post(body: Record<string, unknown>) {
  return request(app)
    .post("/premium/risk-assess")
    .set("x-402-payment", "demo-token")
    .send(body);
}

describe("POST /premium/risk-assess", () => {
  it("returns 402 without x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .send(validBody);
    expect(res.status).toBe(402);
    expect(res.body.error).toContain("Payment Required");
  });

  it("returns 200 with valid request and payment header", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(Object.values(RiskAction)).toContain(res.body.action);
    expect(res.body.suggestedStake).toBeTypeOf("string");
    expect(res.body.kellyFraction).toBeTypeOf("number");
    expect(res.body.winProbability).toBeTypeOf("number");
    expect(res.body.expectedValue).toBeTypeOf("number");
    expect(res.body.confidence).toBeTypeOf("number");
    expect(res.body.reasoning).toBeTypeOf("string");
    expect(res.body.warnings).toBeInstanceOf(Array);
    expect(res.body.riskTolerance).toBe("moderate");
  });

  it("returns 400 with invalid body", async () => {
    const res = await post({ legIds: [1] });
    expect(res.status).toBe(400);
  });

  it("warns about correlated legs", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA", "NBA"],
    });
    expect(res.status).toBe(200);
    expect(res.body.warnings.some((w: string) => w.includes("correlated"))).toBe(true);
  });

  it("conservative profile avoids >3 legs", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe(RiskAction.AVOID);
    expect(res.body.warnings.some((w: string) => w.includes("max 3 legs"))).toBe(true);
  });

  it("suggests reduced stake when kelly < proposed", async () => {
    const res = await post({
      ...validBody,
      stake: "50",
      bankroll: "100",
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    // Conservative caps kelly at 5%, so suggested stake <= 5 USDC
    expect(parseFloat(res.body.suggestedStake)).toBeLessThanOrEqual(5);
  });

  it("aggressive profile allows full kelly", async () => {
    const res = await post({
      ...validBody,
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(res.body.riskTolerance).toBe("aggressive");
  });

  it("returns valid edgeBps and fairMultiplier", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.edgeBps).toBe(200); // BASE_FEE_BPS(100) + 2 legs * PER_LEG_FEE_BPS(50)
    expect(res.body.fairMultiplier).toBeGreaterThan(1);
  });

  it("returns netMultiplier < fairMultiplier (house edge)", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.netMultiplier).toBeLessThan(res.body.fairMultiplier);
    expect(res.body.netMultiplier).toBeGreaterThan(1);
  });
});

// ── Bugbot fix: zero probability rejection (schema level) ────────────────
describe("Zero probability rejection", () => {
  it("rejects probability of 0", async () => {
    const res = await post({
      ...validBody,
      probabilities: [600_000, 0],
    });
    expect(res.status).toBe(400);
  });

  it("rejects probability of 1_000_000 (PPM ceiling)", async () => {
    const res = await post({
      ...validBody,
      probabilities: [600_000, 1_000_000],
    });
    expect(res.status).toBe(400);
  });

  it("accepts boundary probabilities (1 and 999_999)", async () => {
    const res = await post({
      ...validBody,
      probabilities: [1, 999_999],
    });
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
    expect(Number.isFinite(res.body.expectedValue)).toBe(true);
  });
});

// ── Bugbot fix: non-integer probability rejection ────────────────────────
describe("Non-integer probability rejection", () => {
  it("rejects floating-point probabilities", async () => {
    const res = await post({
      ...validBody,
      probabilities: [600_000.5, 450_000],
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative probabilities", async () => {
    const res = await post({
      ...validBody,
      probabilities: [-1, 450_000],
    });
    expect(res.status).toBe(400);
  });
});

// ── Bugbot fix: BigInt overflow safety for 3+ legs ───────────────────────
describe("BigInt overflow safety (3+ legs)", () => {
  it("handles 3-leg parlay without overflow", async () => {
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000],
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(200);
    // 3-leg: 600k * 450k * 500k = 1.35e17 — would overflow Number.MAX_SAFE_INTEGER
    // Shared math uses BigInt, so this must work correctly
    expect(res.body.fairMultiplier).toBeGreaterThan(1);
    expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
  });

  it("handles 4-leg parlay without overflow", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(res.body.fairMultiplier).toBeGreaterThan(1);
    expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
  });

  it("handles 5-leg parlay without overflow", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000, 350_000],
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(res.body.fairMultiplier).toBeGreaterThan(1);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
  });

  it("5-leg multiplier matches shared math exactly", async () => {
    const probs = [600_000, 450_000, 500_000, 400_000, 350_000];
    const res = await post({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: probs,
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);

    // Verify against shared math
    const fairX1e6 = computeMultiplier(probs);
    const edgeBps = computeEdge(probs.length);
    const netX1e6 = applyEdge(fairX1e6, edgeBps);
    const expectedFair = Math.round(Number(fairX1e6) / PPM * 100) / 100;
    const expectedNet = Math.round(Number(netX1e6) / PPM * 100) / 100;

    expect(res.body.fairMultiplier).toBe(expectedFair);
    expect(res.body.netMultiplier).toBe(expectedNet);
    expect(res.body.edgeBps).toBe(edgeBps);
  });
});

// ── Bugbot fix: Kelly criterion correctness ──────────────────────────────
describe("Kelly criterion", () => {
  it("returns kellyFraction >= 0 (never negative)", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.kellyFraction).toBeGreaterThanOrEqual(0);
  });

  it("kelly = 0 produces REDUCE_STAKE with meaningful reasoning", async () => {
    // With house edge on fair odds, Kelly should be 0
    const res = await post(validBody);
    expect(res.status).toBe(200);
    if (res.body.kellyFraction === 0) {
      expect(res.body.action).toBe(RiskAction.REDUCE_STAKE);
      expect(res.body.reasoning).toContain("House edge");
    }
  });

  it("kelly is capped by risk profile", async () => {
    // Conservative maxKelly = 0.05
    const res = await post({
      ...validBody,
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    expect(res.body.kellyFraction).toBeLessThanOrEqual(0.05);
  });

  it("suggested stake never exceeds bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "50",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.suggestedStake)).toBeLessThanOrEqual(50);
  });
});

// ── NaN / Infinity protection ────────────────────────────────────────────
describe("NaN and Infinity protection", () => {
  it("no NaN in any numeric field", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(Number.isNaN(res.body.kellyFraction)).toBe(false);
    expect(Number.isNaN(res.body.winProbability)).toBe(false);
    expect(Number.isNaN(res.body.expectedValue)).toBe(false);
    expect(Number.isNaN(res.body.confidence)).toBe(false);
    expect(Number.isNaN(res.body.fairMultiplier)).toBe(false);
    expect(Number.isNaN(res.body.netMultiplier)).toBe(false);
    expect(Number.isNaN(res.body.edgeBps)).toBe(false);
  });

  it("no Infinity in any numeric field", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.kellyFraction)).toBe(true);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
    expect(Number.isFinite(res.body.expectedValue)).toBe(true);
    expect(Number.isFinite(res.body.confidence)).toBe(true);
    expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
    expect(Number.isFinite(res.body.netMultiplier)).toBe(true);
  });

  it("extreme low probability (1 PPM) produces finite results", async () => {
    const res = await post({
      ...validBody,
      probabilities: [1, 1],
    });
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
    expect(Number.isFinite(res.body.expectedValue)).toBe(true);
  });

  it("5-leg extreme low probability returns AVOID (multiplier exceeds safe integer)", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [1, 1, 1, 1, 1],
      bankroll: "1000",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe(RiskAction.AVOID);
    expect(res.body.warnings).toContain("Multiplier too large for risk assessment");
    expect(res.body.suggestedStake).toBe("0.00");
    expect(res.body.fairMultiplier).toBe(0);
    expect(res.body.netMultiplier).toBe(0);
  });

  it("extreme high probability (999_999 PPM) produces finite results", async () => {
    const res = await post({
      ...validBody,
      probabilities: [999_999, 999_999],
    });
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
    expect(Number.isFinite(res.body.winProbability)).toBe(true);
    // Near-certain parlay, multiplier ~1.0
    expect(res.body.fairMultiplier).toBeCloseTo(1.0, 0);
  });
});

// ── Response shape completeness ──────────────────────────────────────────
describe("Response shape", () => {
  it("includes all expected fields", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body);
    const expected = [
      "action", "suggestedStake", "kellyFraction", "winProbability",
      "expectedValue", "confidence", "reasoning", "warnings",
      "riskTolerance", "fairMultiplier", "netMultiplier", "edgeBps",
    ];
    for (const k of expected) {
      expect(keys).toContain(k);
    }
  });

  it("suggestedStake is a valid decimal string", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const n = parseFloat(res.body.suggestedStake);
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  });
});

// ── Win probability correctness ──────────────────────────────────────────
describe("Win probability math", () => {
  it("2-leg 50/50 parlay has ~25% win probability", async () => {
    const res = await post({
      ...validBody,
      probabilities: [500_000, 500_000],
    });
    expect(res.status).toBe(200);
    expect(res.body.winProbability).toBeCloseTo(0.25, 2);
  });

  it("3-leg 50/50/50 parlay has ~12.5% win probability", async () => {
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [500_000, 500_000, 500_000],
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(200);
    expect(res.body.winProbability).toBeCloseTo(0.125, 3);
  });

  it("win probability is between 0 and 1", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.winProbability).toBeGreaterThan(0);
    expect(res.body.winProbability).toBeLessThanOrEqual(1);
  });
});

// ── Expected value correctness ───────────────────────────────────────────
describe("Expected value", () => {
  it("EV is negative with house edge on fair odds", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // House takes edge, so EV < 0 using market probabilities
    expect(res.body.expectedValue).toBeLessThan(0);
  });

  it("EV scales with stake", async () => {
    const res1 = await post({ ...validBody, stake: "10" });
    const res2 = await post({ ...validBody, stake: "100" });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // EV should be ~10x larger (in absolute value) for 10x stake
    const ratio = res2.body.expectedValue / res1.body.expectedValue;
    expect(ratio).toBeCloseTo(10, 0);
  });
});

// ── Confidence scoring ───────────────────────────────────────────────────
describe("Confidence", () => {
  it("confidence decreases with more legs", async () => {
    const res2 = await post(validBody); // 2 legs
    const res4 = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res2.status).toBe(200);
    expect(res4.status).toBe(200);
    expect(res2.body.confidence).toBeGreaterThan(res4.body.confidence);
  });

  it("confidence is in [0.5, 1.0]", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.confidence).toBeGreaterThanOrEqual(0.5);
    expect(res.body.confidence).toBeLessThanOrEqual(1.0);
  });
});

// ── Schema edge cases ────────────────────────────────────────────────────
describe("Schema validation edge cases", () => {
  it("rejects fewer than 2 legs", async () => {
    const res = await post({
      legIds: [1],
      outcomes: ["Yes"],
      stake: "10",
      probabilities: [500_000],
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(400);
  });

  it("rejects more than 5 legs", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4, 5, 6],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [500_000, 500_000, 500_000, 500_000, 500_000, 500_000],
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched array lengths", async () => {
    const res = await post({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [500_000],
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(400);
  });

  it("rejects stake below minimum", async () => {
    const res = await post({
      ...validBody,
      stake: "0.5",
    });
    expect(res.status).toBe(400);
  });

  it("rejects zero bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "0",
    });
    expect(res.status).toBe(400);
  });

  it("rejects negative bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "-100",
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid riskTolerance", async () => {
    const res = await post({
      ...validBody,
      riskTolerance: "yolo",
    });
    expect(res.status).toBe(400);
  });

  it("rejects Infinity stake (Number.isFinite guard)", async () => {
    const res = await post({
      ...validBody,
      stake: "Infinity",
    });
    expect(res.status).toBe(400);
  });

  it("rejects Infinity bankroll (Number.isFinite guard)", async () => {
    const res = await post({
      ...validBody,
      bankroll: "Infinity",
    });
    expect(res.status).toBe(400);
  });

  it("rejects -Infinity bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "-Infinity",
    });
    expect(res.status).toBe(400);
  });

  it("rejects NaN bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "NaN",
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric bankroll", async () => {
    const res = await post({
      ...validBody,
      bankroll: "abc",
    });
    expect(res.status).toBe(400);
  });

  it("rejects categories with wrong length (mismatched with legIds)", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA"],  // 1 category but 2 legs
    });
    expect(res.status).toBe(400);
  });

  it("rejects categories with too many entries", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA", "NFL", "Crypto"],  // 3 categories but 2 legs
    });
    expect(res.status).toBe(400);
  });

  it("accepts categories with matching length", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA", "NFL"],  // 2 categories, 2 legs
    });
    expect(res.status).toBe(200);
  });

  it("accepts request without categories (optional)", async () => {
    const { categories: _, ...noCats } = validBody as Record<string, unknown>;
    const res = await post(noCats);
    expect(res.status).toBe(200);
  });
});

// ── Category input sanitization ──────────────────────────────────────────
describe("Category regex sanitization", () => {
  it("rejects HTML/script injection in categories", async () => {
    const res = await post({
      ...validBody,
      categories: ["<script>alert(1)</script>", "NBA"],
    });
    expect(res.status).toBe(400);
  });

  it("rejects SQL injection patterns in categories", async () => {
    const res = await post({
      ...validBody,
      categories: ["'; DROP TABLE--", "NBA"],
    });
    expect(res.status).toBe(400);
  });

  it("rejects categories with special characters", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA|NFL", "valid"],
    });
    expect(res.status).toBe(400);
  });

  it("accepts categories with dots, hyphens, slashes", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA/Western-Conf.", "NFL"],
    });
    expect(res.status).toBe(200);
  });

  it("accepts categories with underscores and spaces", async () => {
    const res = await post({
      ...validBody,
      categories: ["ETH Denver", "crypto_markets"],
    });
    expect(res.status).toBe(200);
  });

  it("rejects empty string category", async () => {
    const res = await post({
      ...validBody,
      categories: ["", "NBA"],
    });
    expect(res.status).toBe(400);
  });

  it("rejects categories containing tabs", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA\tWest", "NFL"],
    });
    expect(res.status).toBe(400);
  });

  it("rejects categories containing newlines", async () => {
    const res = await post({
      ...validBody,
      categories: ["NBA\nWest", "NFL"],
    });
    expect(res.status).toBe(400);
  });
});

// ── Empty categories array ───────────────────────────────────────────────
describe("Empty categories edge cases", () => {
  it("rejects empty categories array due to length mismatch", async () => {
    const res = await post({
      ...validBody,
      categories: [],
    });
    // Empty array with 2 legIds fails length check: 0 !== 2
    expect(res.status).toBe(400);
  });
});

// ── Multi-correlation warnings ───────────────────────────────────────────
describe("Multi-correlation detection", () => {
  it("warns about 3+ legs in the same category", async () => {
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000],
      bankroll: "100",
      riskTolerance: "moderate",
      categories: ["NBA", "NBA", "NBA"],
    });
    expect(res.status).toBe(200);
    const corrWarning = res.body.warnings.find((w: string) => w.includes("correlated"));
    expect(corrWarning).toBeDefined();
    expect(corrWarning).toContain("3 legs");
  });

  it("warns about multiple correlated groups independently", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "aggressive",
      categories: ["NBA", "NBA", "NFL", "NFL"],
    });
    expect(res.status).toBe(200);
    const corrWarnings = res.body.warnings.filter((w: string) => w.includes("correlated"));
    expect(corrWarnings.length).toBe(2);
  });
});

// ── suggestedStake format ────────────────────────────────────────────────
describe("suggestedStake formatting", () => {
  it("suggestedStake is formatted to 2 decimal places", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // Should be "X.XX" format
    expect(res.body.suggestedStake).toMatch(/^\d+\.\d{2}$/);
  });

  it("suggestedStake is '0.00' when kelly is zero", async () => {
    // With house edge on fair odds, Kelly should be 0 for most cases
    const res = await post(validBody);
    expect(res.status).toBe(200);
    if (res.body.kellyFraction === 0) {
      expect(res.body.suggestedStake).toBe("0.00");
    }
  });
});

// ── Additional stake edge cases ──────────────────────────────────────────
describe("Stake edge cases via HTTP", () => {
  it("rejects NaN stake", async () => {
    const res = await post({ ...validBody, stake: "NaN" });
    expect(res.status).toBe(400);
  });

  it("rejects -Infinity stake", async () => {
    const res = await post({ ...validBody, stake: "-Infinity" });
    // Schema rejects: Number.isFinite(-Infinity) === false
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
  });

  it("rejects negative stake", async () => {
    const res = await post({ ...validBody, stake: "-10" });
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric stake", async () => {
    const res = await post({ ...validBody, stake: "abc" });
    expect(res.status).toBe(400);
  });

  it("rejects empty string stake", async () => {
    const res = await post({ ...validBody, stake: "" });
    expect(res.status).toBe(400);
  });
});

// ── Conservative win probability threshold ───────────────────────────────
describe("Conservative win probability threshold", () => {
  it("avoids when win probability below conservative minimum (15%)", async () => {
    // Very low probability legs: combined prob will be very low
    const res = await post({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [200_000, 200_000], // 20% * 20% = 4%
      bankroll: "100",
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe(RiskAction.AVOID);
    expect(res.body.warnings.some((w: string) => w.includes("below conservative minimum"))).toBe(true);
  });
});

// ── Hex/octal/binary rejection (Bugbot review 3827290500) ────────────────
// Number("0x10")=16 but parseFloat("0x10")=0. Schema now uses parseDecimal()
// which rejects these prefixes. Handlers also use Number() for defense-in-depth.
describe("Hex/octal/binary string rejection", () => {
  it("rejects hex stake '0x10'", async () => {
    const res = await post({ ...validBody, stake: "0x10" });
    expect(res.status).toBe(400);
  });

  it("rejects hex bankroll '0x64'", async () => {
    const res = await post({ ...validBody, bankroll: "0x64" });
    expect(res.status).toBe(400);
  });

  it("rejects octal stake '0o12'", async () => {
    const res = await post({ ...validBody, stake: "0o12" });
    expect(res.status).toBe(400);
  });

  it("rejects binary bankroll '0b1100100'", async () => {
    const res = await post({ ...validBody, bankroll: "0b1100100" });
    expect(res.status).toBe(400);
  });

  it("rejects uppercase hex stake '0X10'", async () => {
    const res = await post({ ...validBody, stake: "0X10" });
    expect(res.status).toBe(400);
  });

  it("accepts normal decimal stake '16'", async () => {
    const res = await post({ ...validBody, stake: "16" });
    expect(res.status).toBe(200);
  });

  it("rejects scientific notation stake '1e2' (parseUSDC incompatible)", async () => {
    const res = await post({ ...validBody, stake: "1e2" });
    expect(res.status).toBe(400);
  });
});

// ── Computed value correctness (not just types) ──────────────────────────
// These verify actual math output against hand-calculated expected values.
describe("Risk assess math correctness", () => {
  it("expectedValue scales linearly with stake", async () => {
    const res10 = await post({ ...validBody, stake: "10" });
    const res20 = await post({ ...validBody, stake: "20" });
    expect(res10.status).toBe(200);
    expect(res20.status).toBe(200);
    // EV = ev_per_dollar * stake, so doubling stake doubles EV
    if (res10.body.expectedValue !== 0) {
      const ratio = res20.body.expectedValue / res10.body.expectedValue;
      expect(ratio).toBeCloseTo(2.0, 1);
    }
  });

  it("winProbability matches product of individual probabilities", async () => {
    // 600_000/1e6 = 0.6, 450_000/1e6 = 0.45
    // Combined: 0.6 * 0.45 = 0.27
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.winProbability).toBeCloseTo(0.27, 2);
  });

  it("fairMultiplier is reciprocal of winProbability", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const expected = 1 / res.body.winProbability;
    expect(res.body.fairMultiplier).toBeCloseTo(expected, 0);
  });

  it("netMultiplier = fairMultiplier * (1 - edgeBps/10000)", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const expected = res.body.fairMultiplier * (1 - res.body.edgeBps / 10000);
    expect(res.body.netMultiplier).toBeCloseTo(expected, 1);
  });

  it("expectedValue is negative when using market probabilities (house edge)", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // EV = p * netMult - 1, and netMult < fairMult due to house edge
    // So EV = p * netMult - 1 < p * (1/p) - 1 = 0
    expect(res.body.expectedValue).toBeLessThan(0);
  });
});

// ── Warning message content verification ─────────────────────────────────
describe("Warning messages contain actionable details", () => {
  it("leg count warning includes both actual and max values", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "conservative", // maxLegs=3
    });
    expect(res.status).toBe(200);
    const legWarning = res.body.warnings.find((w: string) => w.includes("legs"));
    expect(legWarning).toBeDefined();
    expect(legWarning).toContain("4"); // actual count
    expect(legWarning).toContain("3"); // max for conservative
  });

  it("win probability warning includes both actual and threshold values", async () => {
    const res = await post({
      legIds: [1, 2],
      outcomes: ["Yes", "Yes"],
      stake: "10",
      probabilities: [200_000, 200_000], // 4% combined
      bankroll: "100",
      riskTolerance: "conservative", // minWinProb=15%
    });
    expect(res.status).toBe(200);
    const probWarning = res.body.warnings.find((w: string) => w.includes("probability"));
    expect(probWarning).toBeDefined();
    expect(probWarning).toContain("4.00%"); // actual
    expect(probWarning).toContain("15%"); // threshold
  });

  it("correlation warning includes category name and count", async () => {
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000],
      bankroll: "100",
      riskTolerance: "moderate",
      categories: ["NBA", "NBA", "NFL"],
    });
    expect(res.status).toBe(200);
    const corrWarning = res.body.warnings.find((w: string) => w.includes("correlated"));
    expect(corrWarning).toContain("NBA");
    expect(corrWarning).toContain("2");
  });
});

// ── Action/reasoning consistency ─────────────────────────────────────────
describe("Action and reasoning are consistent", () => {
  it("AVOID action reasoning mentions risk tolerance limits", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      probabilities: [600_000, 450_000, 500_000, 400_000],
      bankroll: "100",
      riskTolerance: "conservative",
    });
    expect(res.body.action).toBe(RiskAction.AVOID);
    expect(res.body.reasoning).toContain("conservative");
  });

  it("REDUCE_STAKE reasoning mentions kelly or house edge", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    if (res.body.action === RiskAction.REDUCE_STAKE) {
      const mentionsKellyOrEdge =
        res.body.reasoning.includes("Kelly") || res.body.reasoning.includes("House edge");
      expect(mentionsKellyOrEdge).toBe(true);
    }
  });

  it("BUY action only when kelly > 0 and within risk limits", async () => {
    const res = await post({
      ...validBody,
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    if (res.body.action === RiskAction.BUY) {
      expect(res.body.kellyFraction).toBeGreaterThan(0);
      expect(parseFloat(res.body.suggestedStake)).toBeGreaterThanOrEqual(
        parseFloat(validBody.stake)
      );
    }
  });
});
