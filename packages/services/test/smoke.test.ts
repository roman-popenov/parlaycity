/**
 * API Smoke Tests -- one test per route verifying status + response shape.
 * Catches regressions, missing routes, and field renames.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

// ── Health ────────────────────────────────────────────────────────────────────

describe("Smoke: GET /health", () => {
  it("returns 200 with expected shape", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      timestamp: expect.any(Number),
    });
  });
});

// ── Markets ───────────────────────────────────────────────────────────────────

describe("Smoke: GET /markets", () => {
  it("returns non-empty array with expected fields", async () => {
    const res = await request(app).get("/markets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const m = res.body[0];
    expect(m).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      legs: expect.any(Array),
    });

    const leg = m.legs[0];
    expect(leg).toMatchObject({
      id: expect.any(Number),
      question: expect.any(String),
      probabilityPPM: expect.any(Number),
    });
  });
});

describe("Smoke: GET /markets?category=crypto", () => {
  it("filters results to matching category", async () => {
    const res = await request(app).get("/markets?category=crypto");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const m of res.body) {
      expect(m.category).toBe("crypto");
    }
  });
});

describe("Smoke: GET /markets/categories", () => {
  it("returns available + categories arrays", async () => {
    const res = await request(app).get("/markets/categories");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      available: expect.any(Array),
      categories: expect.any(Array),
    });
    expect(res.body.available.length).toBeGreaterThan(0);
  });
});

describe("Smoke: GET /markets/:id", () => {
  it("returns market by ID", async () => {
    const res = await request(app).get("/markets/ethdenver-2026");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ethdenver-2026");
  });

  it("returns 404 for nonexistent market", async () => {
    const res = await request(app).get("/markets/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ── Quote ─────────────────────────────────────────────────────────────────────

describe("Smoke: POST /quote", () => {
  it("returns valid quote for 2 legs", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "10" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valid: expect.any(Boolean),
      multiplierX1e6: expect.any(String),
      potentialPayout: expect.any(String),
      edgeBps: expect.any(Number),
    });
  });

  it("rejects single leg", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1], outcomes: ["Yes"], stake: "10" });
    expect(res.status).toBe(400);
  });
});

// ── Exposure ──────────────────────────────────────────────────────────────────

describe("Smoke: GET /exposure", () => {
  it("returns exposure report", async () => {
    const res = await request(app).get("/exposure");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalExposure: expect.any(String),
      ticketCount: expect.any(Number),
      byLeg: expect.any(Object),
      hedgeActions: expect.any(Array),
    });
  });
});

describe("Smoke: POST /exposure/hedge/:ticketId", () => {
  it("accepts valid hedge request", async () => {
    const res = await request(app)
      .post("/exposure/hedge/1")
      .send({ legId: 1, amount: "1000000" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });
});

// ── Premium (x402-gated) ─────────────────────────────────────────────────────

describe("Smoke: POST /premium/sim", () => {
  it("returns 402 without payment header", async () => {
    const res = await request(app)
      .post("/premium/sim")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
      });
    expect(res.status).toBe(402);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 200 with valid payment header", async () => {
    const res = await request(app)
      .post("/premium/sim")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      winProbability: expect.any(Number),
      fairMultiplier: expect.any(Number),
      expectedValue: expect.any(Number),
      kellyFraction: expect.any(Number),
    });
  });
});

describe("Smoke: POST /premium/risk-assess", () => {
  it("returns 402 without payment header", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(res.status).toBe(402);
  });

  it("returns 200 with valid payment header", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      action: expect.any(String),
      suggestedStake: expect.any(String),
      kellyFraction: expect.any(Number),
    });
  });
});

describe("Smoke: POST /premium/agent-quote", () => {
  it("returns 402 without payment header", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(res.status).toBe(402);
  });

  it("returns 200 with valid payment header", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      quote: expect.objectContaining({ valid: expect.any(Boolean) }),
      risk: expect.objectContaining({ action: expect.any(String) }),
    });
  });
});

// ── Vault ─────────────────────────────────────────────────────────────────────

describe("Smoke: GET /vault/health", () => {
  it("returns vault health report", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      vaultHealth: expect.any(String),
      totalAssets: expect.any(String),
      utilization: expect.any(Number),
      concentrationRisk: expect.any(Array),
    });
  });
});

describe("Smoke: GET /vault/yield-report", () => {
  it("returns yield optimization report", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      protocols: expect.any(Array),
      recommendation: expect.objectContaining({
        action: expect.any(String),
      }),
      timestamp: expect.any(Number),
    });
  });
});
