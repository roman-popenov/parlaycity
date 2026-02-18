import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

const validBody = {
  legIds: [1, 2],
  outcomes: ["Yes", "Yes"],
  stake: "10",
  probabilities: [600_000, 450_000],
  bankroll: "100",
  riskTolerance: "moderate",
};

describe("POST /premium/risk-assess", () => {
  it("returns 402 without x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .send(validBody);
    expect(res.status).toBe(402);
    expect(res.body.error).toContain("Payment Required");
  });

  it("returns 200 with valid request and payment header", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(["BUY", "REDUCE_STAKE", "AVOID"]).toContain(res.body.action);
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
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({ legIds: [1] });
    expect(res.status).toBe(400);
  });

  it("warns about correlated legs", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
        ...validBody,
        categories: ["NBA", "NBA"],
      });
    expect(res.status).toBe(200);
    expect(res.body.warnings.some((w: string) => w.includes("correlated"))).toBe(true);
  });

  it("conservative profile avoids >3 legs", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2, 3, 4],
        outcomes: ["Yes", "Yes", "Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000, 500_000, 400_000],
        bankroll: "100",
        riskTolerance: "conservative",
      });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe("AVOID");
    expect(res.body.warnings.some((w: string) => w.includes("max 3 legs"))).toBe(true);
  });

  it("suggests reduced stake when kelly < proposed", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
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
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
        ...validBody,
        riskTolerance: "aggressive",
      });
    expect(res.status).toBe(200);
    expect(res.body.riskTolerance).toBe("aggressive");
  });

  it("returns valid edgeBps and fairMultiplier", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.edgeBps).toBe(200); // BASE_FEE_BPS(100) + 2 legs * PER_LEG_FEE_BPS(50)
    expect(res.body.fairMultiplier).toBeGreaterThan(1);
  });
});
