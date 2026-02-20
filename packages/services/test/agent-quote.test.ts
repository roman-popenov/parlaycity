import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import {
  RiskAction,
  PPM,
  computeMultiplier,
  computeEdge,
  applyEdge,
} from "@parlaycity/shared";

// Ensure tests are hermetic: ZG_PRIVATE_KEY must not leak from dev environment
let savedZgKey: string | undefined;
beforeAll(() => {
  savedZgKey = process.env.ZG_PRIVATE_KEY;
  delete process.env.ZG_PRIVATE_KEY;
});
afterAll(() => {
  if (savedZgKey !== undefined) process.env.ZG_PRIVATE_KEY = savedZgKey;
});

const validBody = {
  legIds: [1, 2],
  outcomes: ["Yes", "Yes"],
  stake: "10",
  bankroll: "100",
  riskTolerance: "moderate",
};

function post(body: Record<string, unknown>) {
  return request(app)
    .post("/premium/agent-quote")
    .set("x-402-payment", "demo-token")
    .send(body);
}

// ── x402 gating ───────────────────────────────────────────────────────────
describe("POST /premium/agent-quote x402 gating", () => {
  it("returns 402 without x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .send(validBody);
    expect(res.status).toBe(402);
    expect(res.body.error).toContain("Payment Required");
  });

  it("returns 402 with empty x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .set("x-402-payment", "")
      .send(validBody);
    expect(res.status).toBe(402);
  });

  it("returns 402 with whitespace-only x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .set("x-402-payment", "   ")
      .send(validBody);
    expect(res.status).toBe(402);
  });

  it("returns 200 with valid payment header", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
  });
});

// ── Response shape ────────────────────────────────────────────────────────
describe("POST /premium/agent-quote response shape", () => {
  it("returns both quote and risk objects", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("quote");
    expect(res.body).toHaveProperty("risk");
  });

  it("quote contains all expected fields", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const q = res.body.quote;
    expect(q).toHaveProperty("legIds");
    expect(q).toHaveProperty("outcomes");
    expect(q).toHaveProperty("stake");
    expect(q).toHaveProperty("multiplierX1e6");
    expect(q).toHaveProperty("potentialPayout");
    expect(q).toHaveProperty("feePaid");
    expect(q).toHaveProperty("edgeBps");
    expect(q).toHaveProperty("probabilities");
    expect(q).toHaveProperty("valid");
  });

  it("risk contains all expected fields", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const r = res.body.risk;
    const expected = [
      "action", "suggestedStake", "kellyFraction", "winProbability",
      "expectedValue", "confidence", "reasoning", "warnings",
      "riskTolerance", "fairMultiplier", "netMultiplier", "edgeBps",
    ];
    for (const k of expected) {
      expect(Object.keys(r)).toContain(k);
    }
  });
});

// ── Quote correctness ─────────────────────────────────────────────────────
describe("Quote correctness", () => {
  it("returns valid quote for known legs", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.quote.valid).toBe(true);
    expect(res.body.quote.legIds).toEqual([1, 2]);
    expect(res.body.quote.outcomes).toEqual(["Yes", "Yes"]);
  });

  it("quote probabilities are resolved from catalog", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // Leg 1: 550_000 PPM, Leg 2: 500_000 PPM (from seed)
    expect(res.body.quote.probabilities).toEqual([550_000, 500_000]);
  });

  it("quote math matches shared computeQuote", async () => {
    const probs = [550_000, 500_000];
    const res = await post(validBody);
    expect(res.status).toBe(200);

    const fairX1e6 = computeMultiplier(probs);
    const edgeBps = computeEdge(probs.length);
    const netX1e6 = applyEdge(fairX1e6, edgeBps);

    expect(res.body.quote.multiplierX1e6).toBe(netX1e6.toString());
    expect(res.body.quote.edgeBps).toBe(edgeBps);
  });

  it("returns error for unknown leg ID", async () => {
    const res = await post({ ...validBody, legIds: [999, 998] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not found");
  });

  it("returns error for duplicate leg IDs", async () => {
    const res = await post({ ...validBody, legIds: [1, 1] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Duplicate");
  });
});

// ── Risk assessment correctness ───────────────────────────────────────────
describe("Risk assessment correctness", () => {
  it("returns valid risk action", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(Object.values(RiskAction)).toContain(res.body.risk.action);
  });

  it("risk riskTolerance matches input", async () => {
    const res = await post(validBody);
    expect(res.body.risk.riskTolerance).toBe("moderate");
  });

  it("risk math matches shared math", async () => {
    const probs = [550_000, 500_000];
    const res = await post(validBody);
    expect(res.status).toBe(200);

    const fairX1e6 = computeMultiplier(probs);
    const edgeBps = computeEdge(probs.length);
    const netX1e6 = applyEdge(fairX1e6, edgeBps);
    const expectedFair = Math.round(Number(fairX1e6) / PPM * 100) / 100;
    const expectedNet = Math.round(Number(netX1e6) / PPM * 100) / 100;

    expect(res.body.risk.fairMultiplier).toBe(expectedFair);
    expect(res.body.risk.netMultiplier).toBe(expectedNet);
    expect(res.body.risk.edgeBps).toBe(edgeBps);
  });

  it("win probability matches product of individual probabilities", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // 550_000/1e6 * 500_000/1e6 = 0.55 * 0.50 = 0.275
    expect(res.body.risk.winProbability).toBeCloseTo(0.275, 2);
  });

  it("expected value is negative with house edge", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.risk.expectedValue).toBeLessThan(0);
  });

  it("kelly fraction is >= 0", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.risk.kellyFraction).toBeGreaterThanOrEqual(0);
  });

  it("confidence is in [0.5, 1.0]", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.risk.confidence).toBeGreaterThanOrEqual(0.5);
    expect(res.body.risk.confidence).toBeLessThanOrEqual(1.0);
  });
});

// ── Correlation auto-detection ────────────────────────────────────────────
describe("Auto-detects category correlation from catalog", () => {
  it("warns about correlated legs in same market category", async () => {
    // Legs 1, 2, 3 are all in category "crypto" (ethdenver-2026 market)
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    expect(res.body.risk.warnings.some((w: string) => w.includes("correlated"))).toBe(true);
    expect(res.body.risk.warnings.some((w: string) => w.includes("crypto"))).toBe(true);
  });

  it("no correlation warning for legs in different categories", async () => {
    // Leg 1 (crypto) + Leg 4 (defi) — different categories
    const res = await post({
      ...validBody,
      legIds: [1, 4],
      outcomes: ["Yes", "Yes"],
    });
    expect(res.status).toBe(200);
    const corrWarnings = res.body.risk.warnings.filter((w: string) => w.includes("correlated"));
    expect(corrWarnings.length).toBe(0);
  });
});

// ── Risk profiles ─────────────────────────────────────────────────────────
describe("Risk profile behavior", () => {
  it("conservative profile avoids >3 legs", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4],
      outcomes: ["Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    expect(res.body.risk.action).toBe(RiskAction.AVOID);
    expect(res.body.risk.warnings.some((w: string) => w.includes("max 3 legs"))).toBe(true);
  });

  it("aggressive profile allows 5 legs", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    // Should not get a "max legs" warning
    expect(res.body.risk.warnings.every((w: string) => !w.includes("max 5 legs"))).toBe(true);
  });

  it("kelly is capped by conservative profile", async () => {
    const res = await post({
      ...validBody,
      riskTolerance: "conservative",
    });
    expect(res.status).toBe(200);
    expect(res.body.risk.kellyFraction).toBeLessThanOrEqual(0.05);
  });
});

// ── Schema validation ─────────────────────────────────────────────────────
describe("Schema validation", () => {
  it("rejects fewer than 2 legs", async () => {
    const res = await post({
      legIds: [1],
      outcomes: ["Yes"],
      stake: "10",
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
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(400);
  });

  it("rejects mismatched legIds/outcomes length", async () => {
    const res = await post({
      legIds: [1, 2],
      outcomes: ["Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(400);
  });

  it("rejects stake below minimum", async () => {
    const res = await post({ ...validBody, stake: "0.5" });
    expect(res.status).toBe(400);
  });

  it("rejects zero bankroll", async () => {
    const res = await post({ ...validBody, bankroll: "0" });
    expect(res.status).toBe(400);
  });

  it("rejects negative bankroll", async () => {
    const res = await post({ ...validBody, bankroll: "-100" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid riskTolerance", async () => {
    const res = await post({ ...validBody, riskTolerance: "yolo" });
    expect(res.status).toBe(400);
  });

  it("rejects missing bankroll", async () => {
    const { bankroll: _, ...noBankroll } = validBody;
    const res = await post(noBankroll as Record<string, unknown>);
    expect(res.status).toBe(400);
  });

  it("rejects missing riskTolerance", async () => {
    const { riskTolerance: _, ...noRisk } = validBody;
    const res = await post(noRisk as Record<string, unknown>);
    expect(res.status).toBe(400);
  });

  it("rejects hex stake", async () => {
    const res = await post({ ...validBody, stake: "0x10" });
    expect(res.status).toBe(400);
  });

  it("rejects scientific notation stake", async () => {
    const res = await post({ ...validBody, stake: "1e2" });
    expect(res.status).toBe(400);
  });

  it("rejects Infinity bankroll", async () => {
    const res = await post({ ...validBody, bankroll: "Infinity" });
    expect(res.status).toBe(400);
  });

  it("rejects NaN bankroll", async () => {
    const res = await post({ ...validBody, bankroll: "NaN" });
    expect(res.status).toBe(400);
  });
});

// ── No agent-provided probabilities needed ────────────────────────────────
describe("Agent-friendly: no probabilities required", () => {
  it("does not require probabilities field", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // The endpoint resolves probabilities from the catalog
    expect(res.body.quote.probabilities.length).toBe(2);
  });

  it("ignores extra probabilities field if sent", async () => {
    const res = await post({
      ...validBody,
      probabilities: [999_999, 999_999], // should be ignored
    });
    expect(res.status).toBe(200);
    // Should use catalog values (550_000, 500_000), not the sent values
    expect(res.body.quote.probabilities).toEqual([550_000, 500_000]);
  });
});

// ── Quote + risk consistency ──────────────────────────────────────────────
describe("Quote and risk are consistent", () => {
  it("quote and risk use the same edge", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(res.body.quote.edgeBps).toBe(res.body.risk.edgeBps);
  });

  it("quote multiplier matches risk netMultiplier", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const quoteMultFloat = Number(res.body.quote.multiplierX1e6) / PPM;
    expect(quoteMultFloat).toBeCloseTo(res.body.risk.netMultiplier, 1);
  });
});

// ── Multi-leg scenarios ───────────────────────────────────────────────────
describe("Multi-leg scenarios", () => {
  it("3-leg parlay returns valid combined result", async () => {
    const res = await post({
      legIds: [1, 2, 3],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "moderate",
    });
    expect(res.status).toBe(200);
    expect(res.body.quote.valid).toBe(true);
    expect(res.body.quote.probabilities.length).toBe(3);
    expect(res.body.risk.fairMultiplier).toBeGreaterThan(1);
  });

  it("5-leg extreme math matches shared math exactly", async () => {
    const res = await post({
      legIds: [1, 2, 3, 4, 5],
      outcomes: ["Yes", "Yes", "Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);

    const probs = res.body.quote.probabilities;
    const fairX1e6 = computeMultiplier(probs);
    const edgeBps = computeEdge(probs.length);
    const netX1e6 = applyEdge(fairX1e6, edgeBps);
    const expectedFair = Math.round(Number(fairX1e6) / PPM * 100) / 100;
    const expectedNet = Math.round(Number(netX1e6) / PPM * 100) / 100;

    expect(res.body.risk.fairMultiplier).toBe(expectedFair);
    expect(res.body.risk.netMultiplier).toBe(expectedNet);
  });

  it("cross-category legs have no correlation warning", async () => {
    // Leg 1 (crypto), Leg 4 (defi), Leg 7 (nft)
    const res = await post({
      legIds: [1, 4, 7],
      outcomes: ["Yes", "Yes", "Yes"],
      stake: "10",
      bankroll: "100",
      riskTolerance: "aggressive",
    });
    expect(res.status).toBe(200);
    const corrWarnings = res.body.risk.warnings.filter((w: string) => w.includes("correlated"));
    expect(corrWarnings.length).toBe(0);
  });
});

// ── aiInsight field ──────────────────────────────────────────────────────
describe("aiInsight field", () => {
  it("omits aiInsight when ZG_PRIVATE_KEY is not set", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    // Without ZG_PRIVATE_KEY, 0G inference is disabled; aiInsight should be absent
    expect(res.body.aiInsight).toBeUndefined();
  });

  it("response is valid without aiInsight (quote + risk only)", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["quote", "risk"]);
  });
});

// ── NaN/Infinity protection ───────────────────────────────────────────────
describe("NaN and Infinity protection", () => {
  it("no NaN in any numeric field", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const r = res.body.risk;
    expect(Number.isNaN(r.kellyFraction)).toBe(false);
    expect(Number.isNaN(r.winProbability)).toBe(false);
    expect(Number.isNaN(r.expectedValue)).toBe(false);
    expect(Number.isNaN(r.confidence)).toBe(false);
    expect(Number.isNaN(r.fairMultiplier)).toBe(false);
    expect(Number.isNaN(r.netMultiplier)).toBe(false);
  });

  it("no Infinity in any numeric field", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
    const r = res.body.risk;
    expect(Number.isFinite(r.kellyFraction)).toBe(true);
    expect(Number.isFinite(r.winProbability)).toBe(true);
    expect(Number.isFinite(r.expectedValue)).toBe(true);
    expect(Number.isFinite(r.confidence)).toBe(true);
    expect(Number.isFinite(r.fairMultiplier)).toBe(true);
    expect(Number.isFinite(r.netMultiplier)).toBe(true);
  });
});
