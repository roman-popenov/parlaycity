/**
 * E2E: Verify API responses match on-chain state.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../../packages/services/src/index";
import { readAddresses, type DeployedAddresses } from "../helpers/addresses";
import { getPublicClient } from "../helpers/clients";
import { REGISTRY_ABI } from "../helpers/abis";

let addrs: DeployedAddresses;
let pub: ReturnType<typeof getPublicClient>;
let savedBdlKey: string | undefined;

beforeAll(() => {
  addrs = readAddresses();
  pub = getPublicClient();
  // Isolate from BDL so only seed categories appear
  savedBdlKey = process.env.BDL_API_KEY;
  delete process.env.BDL_API_KEY;
});

afterAll(() => {
  if (savedBdlKey !== undefined) {
    process.env.BDL_API_KEY = savedBdlKey;
  }
});

describe("API <-> on-chain consistency", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /markets returns all seed categories", async () => {
    const res = await request(app).get("/markets").expect(200);
    const markets = res.body;
    expect(Array.isArray(markets)).toBe(true);

    const categories = new Set(
      markets.map((m: { category: string }) => m.category)
    );
    const expectedCats = [
      "crypto",
      "defi",
      "nft",
      "policy",
      "economics",
      "trivia",
      "ethdenver",
    ];
    for (const cat of expectedCats) {
      expect(categories.has(cat)).toBe(true);
    }

    // Count total legs across all markets (7 categories * 3 legs each)
    const totalLegs = markets.reduce(
      (sum: number, m: { legs: unknown[] }) => sum + m.legs.length,
      0
    );
    expect(totalLegs).toBe(21);
  });

  it("GET /markets/categories counts match", async () => {
    const res = await request(app).get("/markets/categories").expect(200);
    const { categories } = res.body;

    for (const cat of [
      "crypto",
      "defi",
      "nft",
      "policy",
      "economics",
      "trivia",
      "ethdenver",
    ]) {
      const entry = categories.find(
        (c: { category: string }) => c.category === cat
      );
      expect(entry).toBeDefined();
      expect(entry.legCount).toBe(3);
    }
  });

  it("POST /quote math uses correct probabilities", async () => {
    // Get first 2 legs from crypto category via API
    const marketsRes = await request(app)
      .get("/markets?category=crypto")
      .expect(200);
    const cryptoMarket = marketsRes.body[0];
    const leg1 = cryptoMarket.legs[0];
    const leg2 = cryptoMarket.legs[1];

    // Read on-chain legs and build question -> probabilityPPM map
    const count = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });

    const onChainProbs = new Map<string, bigint>();
    for (let i = 0n; i < count; i++) {
      const leg = await pub.readContract({
        address: addrs.LegRegistry,
        abi: REGISTRY_ABI,
        functionName: "getLeg",
        args: [i],
      });
      onChainProbs.set(leg.question.trim().toLowerCase(), leg.probabilityPPM);
    }

    // Verify probability values match between API and on-chain
    expect(onChainProbs.get(leg1.question.trim().toLowerCase())).toBe(
      BigInt(leg1.probabilityPPM)
    );
    expect(onChainProbs.get(leg2.question.trim().toLowerCase())).toBe(
      BigInt(leg2.probabilityPPM)
    );

    // Post a quote with correct schema (legIds, outcomes, stake as string)
    const ZERO_BYTES32 = "0x" + "0".repeat(64);
    const quoteRes = await request(app)
      .post("/quote")
      .send({
        legIds: [leg1.id, leg2.id],
        outcomes: [ZERO_BYTES32, ZERO_BYTES32],
        stake: "10",
      })
      .expect(200);

    expect(quoteRes.body.valid).toBe(true);
    expect(quoteRes.body.multiplierX1e6).toBeDefined();
    expect(Number(quoteRes.body.multiplierX1e6)).toBeGreaterThan(0);
  });
});
