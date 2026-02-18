import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("x402 Payment Gate", () => {
  describe("POST /premium/sim without payment", () => {
    it("returns 402 Payment Required", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });

      expect(res.status).toBe(402);
    });

    it("includes x402 protocol info in 402 response", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });

      expect(res.body.protocol).toBe("x402");
      expect(res.body.accepts).toBeDefined();
      expect(res.body.accepts.scheme).toBe("exact");
      expect(res.body.accepts.network).toContain("eip155:");
      expect(res.body.accepts.asset).toBe("USDC");
      expect(res.body.facilitator).toBeDefined();
    });
  });

  describe("POST /premium/sim with payment header", () => {
    it("returns 200 with valid analytics", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
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
      expect(res.body.kellySuggestedStakePct).toBeTypeOf("number");
    });

    it("returns correct win probability for known inputs", async () => {
      // 600_000 PPM = 60%, 450_000 PPM = 45%
      // Combined: 0.6 * 0.45 = 0.27 = 27%
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "100",
          probabilities: [600_000, 450_000],
        });

      expect(res.body.winProbability).toBeCloseTo(0.27, 2);
      expect(res.body.fairMultiplier).toBeCloseTo(3.7, 1);
    });
  });

  describe("Path normalization", () => {
    it("is case-insensitive and still requires payment", async () => {
      const paths = ["/premium/sim", "/Premium/Sim", "/PREMIUM/SIM"];
      for (const path of paths) {
        const res = await request(app)
          .post(path)
          .send({
            legIds: [1, 2],
            outcomes: ["Yes", "Yes"],
            stake: "10",
            probabilities: [600_000, 450_000],
          });
        expect(res.status).toBe(402);
      }
    });
  });

  describe("Non-premium routes are not gated", () => {
    it("GET /health passes without payment", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
    });

    it("GET /markets passes without payment", async () => {
      const res = await request(app).get("/markets");
      expect(res.status).toBe(200);
    });

    it("POST /quote passes without payment", async () => {
      const res = await request(app)
        .post("/quote")
        .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "10" });
      expect(res.status).toBe(200);
    });
  });
});
