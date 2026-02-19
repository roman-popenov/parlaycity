import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import app from "../src/index.js";
import { _testExports, wrapWithPathNormalization } from "../src/premium/x402.js";
import type { Request, Response, NextFunction } from "express";

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

  describe("POST /premium/risk-assess without payment", () => {
    it("returns 402 Payment Required", async () => {
      const res = await request(app)
        .post("/premium/risk-assess")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
          bankroll: "100",
          riskTolerance: "moderate",
        });
      expect(res.status).toBe(402);
      expect(res.body.protocol).toBe("x402");
    });

    it("returns 200 with valid payment header", async () => {
      const res = await request(app)
        .post("/premium/risk-assess")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
          bankroll: "100",
          riskTolerance: "moderate",
        });
      expect(res.status).toBe(200);
      expect(res.body.action).toBeDefined();
    });

    it("rejects empty payment header", async () => {
      const res = await request(app)
        .post("/premium/risk-assess")
        .set("x-402-payment", "")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
          bankroll: "100",
          riskTolerance: "moderate",
        });
      expect(res.status).toBe(402);
    });
  });

  describe("POST /premium/sim input validation through x402", () => {
    it("rejects Infinity stake even with valid payment", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "Infinity",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });

    it("rejects NaN stake even with valid payment", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "NaN",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });

    it("rejects -Infinity stake even with valid payment", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "-Infinity",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });

    it("rejects negative stake even with valid payment", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "-10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /premium/sim response shape", () => {
    it("includes all expected fields in sim response", async () => {
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
      const expected = [
        "legIds", "outcomes", "stake", "winProbability",
        "fairMultiplier", "expectedValue", "kellyFraction",
        "kellySuggestedStakePct", "note",
      ];
      for (const key of expected) {
        expect(res.body).toHaveProperty(key);
      }
    });

    it("no NaN or Infinity in numeric response fields", async () => {
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
      expect(Number.isFinite(res.body.winProbability)).toBe(true);
      expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
      expect(Number.isFinite(res.body.expectedValue)).toBe(true);
      expect(Number.isFinite(res.body.kellyFraction)).toBe(true);
      expect(Number.isFinite(res.body.kellySuggestedStakePct)).toBe(true);
    });

    it("echoes back legIds and outcomes", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "No"],
          stake: "10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(200);
      expect(res.body.legIds).toEqual([1, 2]);
      expect(res.body.outcomes).toEqual(["Yes", "No"]);
      expect(res.body.stake).toBe("10");
    });

    it("extreme low probability produces finite sim results", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [1, 1],
        });
      expect(res.status).toBe(200);
      expect(Number.isFinite(res.body.winProbability)).toBe(true);
      expect(Number.isFinite(res.body.fairMultiplier)).toBe(true);
    });
  });

  describe("POST /premium/risk-assess path normalization", () => {
    it("case-insensitive risk-assess path requires payment", async () => {
      const paths = ["/premium/risk-assess", "/Premium/Risk-Assess", "/PREMIUM/RISK-ASSESS"];
      for (const path of paths) {
        const res = await request(app)
          .post(path)
          .send({
            legIds: [1, 2],
            outcomes: ["Yes", "Yes"],
            stake: "10",
            probabilities: [600_000, 450_000],
            bankroll: "100",
            riskTolerance: "moderate",
          });
        expect(res.status).toBe(402);
      }
    });

    it("risk-assess with trailing slash requires payment", async () => {
      const res = await request(app)
        .post("/premium/risk-assess/")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "10",
          probabilities: [600_000, 450_000],
          bankroll: "100",
          riskTolerance: "moderate",
        });
      expect(res.status).toBe(402);
    });
  });

  // Schema now rejects hex/octal/binary via parseDecimal() guard.
  // Handler also uses Number() instead of parseFloat() for defense-in-depth.
  describe("POST /premium/sim hex/octal/binary rejection", () => {
    it("rejects hex stake '0x10'", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "0x10",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });

    it("rejects octal stake '0o12'", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "0o12",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
    });

    it("rejects binary stake '0b1010'", async () => {
      const res = await request(app)
        .post("/premium/sim")
        .set("x-402-payment", "test-payment-proof")
        .send({
          legIds: [1, 2],
          outcomes: ["Yes", "Yes"],
          stake: "0b1010",
          probabilities: [600_000, 450_000],
        });
      expect(res.status).toBe(400);
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

    it("throws on invalid URL with parse details", () => {
      process.env.X402_FACILITATOR_URL = "not-a-url";
      expect(() => getX402FacilitatorUrl()).toThrow("failed to parse");
    });

    it("throws on non-HTTP protocol with protocol name", () => {
      process.env.X402_FACILITATOR_URL = "ftp://files.example.com";
      expect(() => getX402FacilitatorUrl()).toThrow("unsupported protocol");
    });
  });
});

describe("wrapWithPathNormalization", () => {
  function createTestApp(
    inner: (req: Request, res: Response, next: NextFunction) => void,
    gatedPaths: string[],
  ) {
    const testApp = express();
    testApp.use(wrapWithPathNormalization(inner, gatedPaths));
    testApp.all("*", (_req, res) => res.status(200).json({ reached: "handler" }));
    return testApp;
  }

  it("normalizes uppercase path before calling inner middleware", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim"]);

    await request(testApp).post("/Premium/SIM").send({});
    expect(capturedUrl).toBe("/premium/sim");
  });

  it("normalizes trailing slash before calling inner middleware", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim"]);

    await request(testApp).post("/premium/sim/").send({});
    expect(capturedUrl).toBe("/premium/sim");
  });

  it("preserves query string during normalization", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim"]);

    await request(testApp).post("/Premium/SIM?foo=bar&x=1").send({});
    expect(capturedUrl).toBe("/premium/sim?foo=bar&x=1");
  });

  it("restores original URL after inner middleware calls next", async () => {
    let urlAfterRestore: string | undefined;
    const inner = (_req: Request, _res: Response, next: NextFunction) => next();
    const testApp = express();
    testApp.use(wrapWithPathNormalization(inner, ["/premium/sim"]));
    testApp.all("*", (req, res) => {
      urlAfterRestore = req.url;
      res.status(200).json({});
    });

    await request(testApp).post("/Premium/SIM").send({});
    expect(urlAfterRestore).toBe("/Premium/SIM");
  });

  it("passes non-matching POST paths through without normalization", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim"]);

    await request(testApp).post("/quote").send({});
    expect(capturedUrl).toBe("/quote");
  });

  it("passes GET requests through without normalization", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim"]);

    await request(testApp).get("/Premium/SIM");
    // GET should not be normalized even if path matches
    expect(capturedUrl).toBe("/Premium/SIM");
  });

  it("supports multiple gated paths", async () => {
    let capturedUrl: string | undefined;
    const inner = (req: Request, _res: Response, next: NextFunction) => {
      capturedUrl = req.url;
      next();
    };
    const testApp = createTestApp(inner, ["/premium/sim", "/premium/risk-assess"]);

    await request(testApp).post("/PREMIUM/RISK-ASSESS").send({});
    expect(capturedUrl).toBe("/premium/risk-assess");
  });

  it("forwards errors from inner middleware", async () => {
    const inner = (_req: Request, _res: Response, next: NextFunction) => {
      next(new Error("payment failed"));
    };
    const testApp = express();
    testApp.use(wrapWithPathNormalization(inner, ["/premium/sim"]));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    testApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ error: err.message });
    });

    const res = await request(testApp).post("/premium/sim").send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("payment failed");
  });
});
