import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { _testExports } from "../src/premium/x402.js";

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
      expect(res.body.accepts).toHaveLength(1);
      expect(res.body.accepts[0].scheme).toBe("exact");
      expect(res.body.accepts[0].network).toContain("eip155:");
      expect(res.body.accepts[0].asset).toBe("USDC");
      expect(res.body.facilitator).toBeDefined();
    });

    it("includes error and message fields in 402 response", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });

      expect(res.body.error).toBe("Payment Required");
      expect(res.body.message).toContain("x402");
      expect(res.body.mode).toBe("stub");
    });

    it("includes facilitator URL in 402 response", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });

      expect(res.body.facilitator).toMatch(/^https?:\/\//);
    });
  });

  describe("POST /premium/sim with empty/whitespace payment header", () => {
    it("rejects empty string payment header", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(402);
    });

    it("rejects whitespace-only payment header", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "   ")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(402);
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

    it("rejects invalid request body even with valid payment", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({ legIds: [], outcomes: [], stake: "0", probabilities: [] });

      // Should fail validation, not 402
      expect(res.status).not.toBe(402);
      expect(res.status).toBeGreaterThanOrEqual(400);
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

    it("strips trailing slashes", async () => {
      const res = await request(app)
        .post("/premium/sim/")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(402);
    });
  });

  describe("Method filtering", () => {
    it("GET /premium/sim is not gated", async () => {
      const res = await request(app).get("/premium/sim");
      // Should not return 402 — wrong method, gate only applies to POST
      expect(res.status).not.toBe(402);
    });

    it("PUT /premium/sim is not gated", async () => {
      const res = await request(app).put("/premium/sim").send({});
      expect(res.status).not.toBe(402);
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

describe("x402 Config Validators", () => {
  const { getX402Recipient, getX402Network, getX402FacilitatorUrl, KNOWN_NETWORKS, ZERO_ADDRESS } = _testExports;

  describe("getX402Recipient", () => {
    const origWallet = process.env.X402_RECIPIENT_WALLET;
    afterEach(() => {
      if (origWallet === undefined) delete process.env.X402_RECIPIENT_WALLET;
      else process.env.X402_RECIPIENT_WALLET = origWallet;
    });

    it("returns zero address when env var is unset", () => {
      delete process.env.X402_RECIPIENT_WALLET;
      expect(getX402Recipient()).toBe(ZERO_ADDRESS);
    });

    it("returns lowercased valid address", () => {
      process.env.X402_RECIPIENT_WALLET = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";
      expect(getX402Recipient()).toBe("0xabcdef0123456789abcdef0123456789abcdef01");
    });

    it("throws on invalid address", () => {
      process.env.X402_RECIPIENT_WALLET = "not-an-address";
      expect(() => getX402Recipient()).toThrow("Invalid X402_RECIPIENT_WALLET");
    });

    it("throws on truncated address", () => {
      process.env.X402_RECIPIENT_WALLET = "0x1234";
      expect(() => getX402Recipient()).toThrow("Invalid X402_RECIPIENT_WALLET");
    });
  });

  describe("getX402Network", () => {
    const origNetwork = process.env.X402_NETWORK;
    afterEach(() => {
      if (origNetwork === undefined) delete process.env.X402_NETWORK;
      else process.env.X402_NETWORK = origNetwork;
    });

    it("defaults to Base Sepolia", () => {
      delete process.env.X402_NETWORK;
      const result = getX402Network();
      expect(result.network).toBe("eip155:84532");
      expect(result.testnet).toBe(true);
    });

    it("accepts Base mainnet", () => {
      process.env.X402_NETWORK = "eip155:8453";
      const result = getX402Network();
      expect(result.network).toBe("eip155:8453");
      expect(result.testnet).toBe(false);
    });

    it("throws on unsupported network", () => {
      process.env.X402_NETWORK = "eip155:999999";
      expect(() => getX402Network()).toThrow("Unsupported X402_NETWORK");
    });

    it("throws on arbitrary string", () => {
      process.env.X402_NETWORK = "ethereum";
      expect(() => getX402Network()).toThrow("Unsupported X402_NETWORK");
    });

    it("lists supported networks in error message", () => {
      process.env.X402_NETWORK = "bad";
      expect(() => getX402Network()).toThrow(Object.keys(KNOWN_NETWORKS).join(", "));
    });
  });

  describe("getX402FacilitatorUrl", () => {
    const origUrl = process.env.X402_FACILITATOR_URL;
    afterEach(() => {
      if (origUrl === undefined) delete process.env.X402_FACILITATOR_URL;
      else process.env.X402_FACILITATOR_URL = origUrl;
    });

    it("defaults to facilitator.x402.org", () => {
      delete process.env.X402_FACILITATOR_URL;
      expect(getX402FacilitatorUrl()).toBe("https://facilitator.x402.org");
    });

    it("accepts valid HTTPS URL", () => {
      process.env.X402_FACILITATOR_URL = "https://custom-facilitator.example.com";
      expect(getX402FacilitatorUrl()).toBe("https://custom-facilitator.example.com");
    });

    it("accepts valid HTTP URL", () => {
      process.env.X402_FACILITATOR_URL = "http://localhost:3000";
      expect(getX402FacilitatorUrl()).toBe("http://localhost:3000");
    });

    it("throws on invalid URL", () => {
      process.env.X402_FACILITATOR_URL = "not-a-url";
      expect(() => getX402FacilitatorUrl()).toThrow("Invalid X402_FACILITATOR_URL");
    });

    it("throws on non-HTTP protocol", () => {
      process.env.X402_FACILITATOR_URL = "ftp://files.example.com";
      expect(() => getX402FacilitatorUrl()).toThrow("Invalid X402_FACILITATOR_URL");
    });
  });
});
