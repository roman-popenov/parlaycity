import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeTypeOf("number");
  });
});

describe("Security hardening", () => {
  it("includes security headers from helmet", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-xss-protection"]).toBeDefined();
  });

  it("rejects payloads exceeding body size limit", async () => {
    const largePayload = { data: "x".repeat(20_000) };
    const res = await request(app)
      .post("/quote")
      .send(largePayload);
    expect(res.status).toBe(413);
  });
});

describe("GET /markets", () => {
  it("returns 200 with array of markets", async () => {
    const res = await request(app).get("/markets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const market = res.body[0];
    expect(market).toHaveProperty("id");
    expect(market).toHaveProperty("title");
    expect(market).toHaveProperty("legs");
    expect(Array.isArray(market.legs)).toBe(true);
  });

  it("returns a specific market by ID", async () => {
    const res = await request(app).get("/markets/ethdenver-2026");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ethdenver-2026");
  });

  it("returns 404 for unknown market", async () => {
    const res = await request(app).get("/markets/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe("POST /quote", () => {
  it("returns valid quote for 2 valid legs", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "10" });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.multiplierX1e6).toBeDefined();
    expect(res.body.potentialPayout).toBeDefined();
    expect(res.body.edgeBps).toBeGreaterThan(0);
  });

  it("returns invalid for 1 leg (below minimum)", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1], outcomes: ["Yes"], stake: "10" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for zero stake", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "0" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for mismatched legIds/outcomes length", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes"], stake: "10" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown leg ID", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [999, 998], outcomes: ["Yes", "Yes"], stake: "10" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate leg IDs", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 1], outcomes: ["Yes", "Yes"], stake: "10" });

    expect(res.status).toBe(400);
  });

  // Schema/parseUSDC alignment: these formats pass Number() but crash BigInt()
  it("returns 400 for scientific notation stake '1e2' (not 500)", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "1e2" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for '+' prefixed stake '+10' (not 500)", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "+10" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for hex stake '0x10' (not 500)", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "0x10" });
    expect(res.status).toBe(400);
  });
});

describe("GET /exposure", () => {
  it("returns exposure report", async () => {
    const res = await request(app).get("/exposure");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalExposure");
    expect(res.body).toHaveProperty("ticketCount");
    expect(res.body).toHaveProperty("byLeg");
    expect(res.body).toHaveProperty("hedgeActions");
  });
});

describe("POST /exposure/hedge/:ticketId", () => {
  it("returns 400 when missing legId or amount", async () => {
    const res = await request(app)
      .post("/exposure/hedge/1")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("accepts valid hedge request", async () => {
    const res = await request(app)
      .post("/exposure/hedge/1")
      .send({ legId: 1, amount: "1000000" });

    expect(res.status).toBe(200);
    expect(res.body.ticketId).toBe(1);
    expect(res.body.legId).toBe(1);
    expect(res.body.status).toBe("simulated");
  });
});

describe("POST /premium/sim", () => {
  it("returns 402 without x-402-payment header", async () => {
    const res = await request(app)
      .post("/premium/sim")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
      });

    expect(res.status).toBe(402);
    expect(res.body.error).toContain("Payment Required");
  });

  it("returns 200 with valid x-402-payment header", async () => {
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
    expect(res.body.winProbability).toBeTypeOf("number");
    expect(res.body.fairMultiplier).toBeTypeOf("number");
    expect(res.body.expectedValue).toBeTypeOf("number");
    expect(res.body.kellyFraction).toBeTypeOf("number");
  });

  it("returns 400 with invalid body", async () => {
    const res = await request(app)
      .post("/premium/sim")
      .set("x-402-payment", "demo-token")
      .send({ legIds: [1], outcomes: ["Yes"], stake: "10", probabilities: [600_000] });

    expect(res.status).toBe(400);
  });
});
