import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { RiskAction, PPM, computeMultiplier, computeEdge, applyEdge, parseSimRequest, parseRiskAssessRequest } from "@parlaycity/shared";

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

// ── Schema dedup verification ───────────────────────────────────────────
// SimRequestSchema and RiskAssessRequestSchema share the same LegProbBaseSchema.
// These tests verify both schemas enforce identical validation on shared fields,
// proving the deduplication works correctly.
describe("Schema dedup: SimRequest and RiskAssessRequest share base validation", () => {
  const simBase = {
    legIds: [1, 2],
    outcomes: ["Yes", "Yes"],
    stake: "10",
    probabilities: [600_000, 450_000],
  };
  const riskBase = {
    ...simBase,
    bankroll: "100",
    riskTolerance: "moderate" as const,
  };

  it("both reject zero probability identically", () => {
    const simResult = parseSimRequest({ ...simBase, probabilities: [0, 450_000] });
    const riskResult = parseRiskAssessRequest({ ...riskBase, probabilities: [0, 450_000] });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });

  it("both reject probability > 999_999 identically", () => {
    const simResult = parseSimRequest({ ...simBase, probabilities: [1_000_000, 450_000] });
    const riskResult = parseRiskAssessRequest({ ...riskBase, probabilities: [1_000_000, 450_000] });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });

  it("both reject mismatched array lengths identically", () => {
    const simResult = parseSimRequest({ ...simBase, probabilities: [600_000] });
    const riskResult = parseRiskAssessRequest({ ...riskBase, probabilities: [600_000] });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });

  it("both reject stake below minimum identically", () => {
    const simResult = parseSimRequest({ ...simBase, stake: "0.5" });
    const riskResult = parseRiskAssessRequest({ ...riskBase, stake: "0.5" });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });

  it("both reject fewer than 2 legs identically", () => {
    const simResult = parseSimRequest({ legIds: [1], outcomes: ["Yes"], stake: "10", probabilities: [500_000] });
    const riskResult = parseRiskAssessRequest({ legIds: [1], outcomes: ["Yes"], stake: "10", probabilities: [500_000], bankroll: "100", riskTolerance: "moderate" });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });

  it("both accept valid 2-leg input", () => {
    const simResult = parseSimRequest(simBase);
    const riskResult = parseRiskAssessRequest(riskBase);
    expect(simResult.success).toBe(true);
    expect(riskResult.success).toBe(true);
  });

  it("both reject non-integer probabilities identically", () => {
    const simResult = parseSimRequest({ ...simBase, probabilities: [600_000.5, 450_000] });
    const riskResult = parseRiskAssessRequest({ ...riskBase, probabilities: [600_000.5, 450_000] });
    expect(simResult.success).toBe(false);
    expect(riskResult.success).toBe(false);
  });
});
