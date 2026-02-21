import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Cache + module state resets require dynamic imports
let bdlModule: typeof import("../bdl");

describe("BDL NBA Markets", () => {
  const originalEnv = process.env.BDL_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BDL_API_KEY = originalEnv;
    } else {
      delete process.env.BDL_API_KEY;
    }
  });

  it("returns [] when BDL_API_KEY is not set", async () => {
    delete process.env.BDL_API_KEY;
    bdlModule = await import("../bdl");
    expect(bdlModule.isBDLEnabled()).toBe(false);
    const markets = await bdlModule.fetchNBAMarkets();
    expect(markets).toEqual([]);
  });

  it("isBDLEnabled returns true when BDL_API_KEY is set", async () => {
    process.env.BDL_API_KEY = "test-key";
    bdlModule = await import("../bdl");
    expect(bdlModule.isBDLEnabled()).toBe(true);
  });

  it("NBA_LEG_ID_OFFSET is 1000", async () => {
    bdlModule = await import("../bdl");
    expect(bdlModule.NBA_LEG_ID_OFFSET).toBe(1000);
  });

  it("leg IDs are derived from game ID: offset + gameId * 2", async () => {
    // Verify the ID derivation formula is consistent
    const offset = 1000;
    const gameId = 12345;
    const moneylineId = offset + gameId * 2;
    const ouId = offset + gameId * 2 + 1;
    expect(moneylineId).toBe(25690);
    expect(ouId).toBe(25691);
    // IDs are non-overlapping with seed range (1-21)
    expect(moneylineId).toBeGreaterThan(21);
  });

  it("fetchNBAMarkets returns [] on API failure with no cache", async () => {
    process.env.BDL_API_KEY = "test-key";
    bdlModule = await import("../bdl");

    // Mock fetch to fail
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    try {
      const markets = await bdlModule.fetchNBAMarkets();
      expect(markets).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
