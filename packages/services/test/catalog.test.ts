import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { SEED_MARKETS, MARKET_CATEGORIES } from "../src/catalog/seed.js";
import { clearBDLCache } from "../src/catalog/bdl.js";

// Ensure no BDL key leaks from dev environment
let savedBDLKey: string | undefined;
beforeEach(() => {
  savedBDLKey = process.env.BDL_API_KEY;
  delete process.env.BDL_API_KEY;
  clearBDLCache();
});
afterEach(() => {
  if (savedBDLKey !== undefined) process.env.BDL_API_KEY = savedBDLKey;
});

describe("GET /markets", () => {
  it("returns all seed markets", async () => {
    const res = await request(app).get("/markets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(SEED_MARKETS.length);
  });

  it("each market has required fields", async () => {
    const res = await request(app).get("/markets");
    for (const market of res.body) {
      expect(market).toHaveProperty("id");
      expect(market).toHaveProperty("title");
      expect(market).toHaveProperty("description");
      expect(market).toHaveProperty("category");
      expect(market).toHaveProperty("legs");
      expect(Array.isArray(market.legs)).toBe(true);
      expect(market.legs.length).toBeGreaterThan(0);
    }
  });

  it("each leg has required fields", async () => {
    const res = await request(app).get("/markets");
    for (const market of res.body) {
      for (const leg of market.legs) {
        expect(leg).toHaveProperty("id");
        expect(leg).toHaveProperty("question");
        expect(leg).toHaveProperty("probabilityPPM");
        expect(leg).toHaveProperty("active");
        expect(typeof leg.id).toBe("number");
        expect(typeof leg.probabilityPPM).toBe("number");
        expect(leg.probabilityPPM).toBeGreaterThan(0);
        expect(leg.probabilityPPM).toBeLessThanOrEqual(1_000_000);
      }
    }
  });
});

describe("GET /markets?category=", () => {
  it("filters by single category", async () => {
    const res = await request(app).get("/markets?category=crypto");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const market of res.body) {
      expect(market.category).toBe("crypto");
    }
  });

  it("filters by multiple comma-separated categories", async () => {
    const res = await request(app).get("/markets?category=crypto,defi");
    expect(res.status).toBe(200);
    const cats = new Set(res.body.map((m: { category: string }) => m.category));
    for (const cat of cats) {
      expect(["crypto", "defi"]).toContain(cat);
    }
  });

  it("returns empty array for unknown category", async () => {
    const res = await request(app).get("/markets?category=nonexistent");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all when category param is empty", async () => {
    const res = await request(app).get("/markets?category=");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(SEED_MARKETS.length);
  });

  it("is case-insensitive", async () => {
    const res = await request(app).get("/markets?category=CRYPTO");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("GET /markets/categories", () => {
  it("returns available categories list", async () => {
    const res = await request(app).get("/markets/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("available");
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.available)).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it("includes all MARKET_CATEGORIES in available list", async () => {
    const res = await request(app).get("/markets/categories");
    for (const cat of MARKET_CATEGORIES) {
      expect(res.body.available).toContain(cat);
    }
  });

  it("each category entry has counts", async () => {
    const res = await request(app).get("/markets/categories");
    for (const entry of res.body.categories) {
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("marketCount");
      expect(entry).toHaveProperty("legCount");
      expect(entry).toHaveProperty("source");
      expect(entry.marketCount).toBeGreaterThan(0);
      expect(entry.legCount).toBeGreaterThan(0);
    }
  });
});

describe("GET /markets/:id", () => {
  it("returns existing market by id", async () => {
    const res = await request(app).get("/markets/ethdenver-2026");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("ethdenver-2026");
  });

  it("returns 404 for unknown market", async () => {
    const res = await request(app).get("/markets/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns new category markets", async () => {
    const res = await request(app).get("/markets/us-policy-2026");
    expect(res.status).toBe(200);
    expect(res.body.category).toBe("policy");
    expect(res.body.legs.length).toBe(3);
  });
});

describe("Seed data integrity", () => {
  it("has no duplicate leg IDs across all markets", () => {
    const allIds = new Set<number>();
    for (const market of SEED_MARKETS) {
      for (const leg of market.legs) {
        expect(allIds.has(leg.id)).toBe(false);
        allIds.add(leg.id);
      }
    }
  });

  it("original legs 1-9 are unchanged", () => {
    // Legs 1-3: ethdenver-2026 (crypto)
    const m1 = SEED_MARKETS.find((m) => m.id === "ethdenver-2026");
    expect(m1).toBeDefined();
    expect(m1!.category).toBe("crypto");
    expect(m1!.legs[0].id).toBe(1);
    expect(m1!.legs[0].probabilityPPM).toBe(600_000);
    expect(m1!.legs[1].id).toBe(2);
    expect(m1!.legs[2].id).toBe(3);

    // Legs 4-6: defi-markets
    const m2 = SEED_MARKETS.find((m) => m.id === "defi-markets");
    expect(m2).toBeDefined();
    expect(m2!.legs[0].id).toBe(4);

    // Legs 7-9: nft-culture
    const m3 = SEED_MARKETS.find((m) => m.id === "nft-culture");
    expect(m3).toBeDefined();
    expect(m3!.legs[0].id).toBe(7);
  });

  it("all probabilities are valid PPM (1 to 999_999)", () => {
    for (const market of SEED_MARKETS) {
      for (const leg of market.legs) {
        expect(leg.probabilityPPM).toBeGreaterThan(0);
        expect(leg.probabilityPPM).toBeLessThan(1_000_000);
      }
    }
  });

  it("has expected number of categories", () => {
    const cats = new Set(SEED_MARKETS.map((m) => m.category));
    // crypto, defi, nft, policy, economics, trivia, ethdenver (no nba in seed)
    expect(cats.size).toBe(7);
  });
});
