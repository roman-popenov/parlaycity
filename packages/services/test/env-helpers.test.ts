/**
 * Unit tests for script helper functions:
 * - scripts/lib/env.ts: requireExplicitKeyForRemoteRpc, safeParseNumber, safeBigIntToNumber
 * - normalize(): tested inline (avoids pulling viem dependency tree)
 * - packages/services/src/catalog/seed.ts: SEED_MARKETS integrity
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  requireExplicitKeyForRemoteRpc,
  safeParseNumber,
  safeBigIntToNumber,
} from "../../scripts/lib/env.ts";
import { SEED_MARKETS } from "../src/catalog/seed.js";

// Inline normalize to avoid importing register-legs.ts (which pulls in viem/abitype)
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// ── requireExplicitKeyForRemoteRpc ────────────────────────────────────────────

describe("requireExplicitKeyForRemoteRpc", () => {
  let savedKey: string | undefined;

  beforeAll(() => {
    savedKey = process.env.PRIVATE_KEY;
  });

  afterAll(() => {
    if (savedKey !== undefined) {
      process.env.PRIVATE_KEY = savedKey;
    } else {
      delete process.env.PRIVATE_KEY;
    }
  });

  it("allows localhost without PRIVATE_KEY", () => {
    delete process.env.PRIVATE_KEY;
    expect(() => requireExplicitKeyForRemoteRpc("http://127.0.0.1:8545")).not.toThrow();
  });

  it("allows localhost:8545 variant", () => {
    delete process.env.PRIVATE_KEY;
    expect(() => requireExplicitKeyForRemoteRpc("http://localhost:8545")).not.toThrow();
  });

  it("allows 0.0.0.0 without PRIVATE_KEY", () => {
    delete process.env.PRIVATE_KEY;
    expect(() => requireExplicitKeyForRemoteRpc("http://0.0.0.0:8545")).not.toThrow();
  });

  it("throws for remote URL without PRIVATE_KEY", () => {
    delete process.env.PRIVATE_KEY;
    expect(() => requireExplicitKeyForRemoteRpc("https://sepolia.base.org")).toThrow(
      /PRIVATE_KEY is not set/,
    );
  });

  it("allows remote URL with PRIVATE_KEY set", () => {
    process.env.PRIVATE_KEY = "0xdeadbeef";
    expect(() => requireExplicitKeyForRemoteRpc("https://sepolia.base.org")).not.toThrow();
  });
});

// ── safeParseNumber ───────────────────────────────────────────────────────────

describe("safeParseNumber", () => {
  it("returns fallback for undefined", () => {
    expect(safeParseNumber(undefined, 42, "test")).toBe(42);
  });

  it("parses valid number string", () => {
    expect(safeParseNumber("123", 0, "test")).toBe(123);
  });

  it("parses decimal", () => {
    expect(safeParseNumber("3.14", 0, "test")).toBeCloseTo(3.14);
  });

  it("returns fallback for NaN input", () => {
    expect(safeParseNumber("not-a-number", 99, "test")).toBe(99);
  });

  it("returns fallback for Infinity", () => {
    expect(safeParseNumber("Infinity", 0, "test")).toBe(0);
  });

  it("returns 0 for empty string (Number('') is 0, which is finite)", () => {
    expect(safeParseNumber("", 5, "test")).toBe(0);
  });
});

// ── safeBigIntToNumber ────────────────────────────────────────────────────────

describe("safeBigIntToNumber", () => {
  it("converts small BigInt", () => {
    expect(safeBigIntToNumber(42n, "test")).toBe(42);
  });

  it("converts zero", () => {
    expect(safeBigIntToNumber(0n, "test")).toBe(0);
  });

  it("converts MAX_SAFE_INTEGER boundary", () => {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    expect(safeBigIntToNumber(max, "test")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws when exceeding MAX_SAFE_INTEGER", () => {
    const over = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => safeBigIntToNumber(over, "test")).toThrow(/exceeds Number.MAX_SAFE_INTEGER/);
  });
});

// ── normalize ─────────────────────────────────────────────────────────────────

describe("normalize", () => {
  it("lowercases and trims", () => {
    expect(normalize("  Hello World  ")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(normalize("   ")).toBe("");
  });

  it("handles mixed case with leading/trailing spaces", () => {
    expect(normalize("  Will ETH Hit $5K?  ")).toBe("will eth hit $5k?");
  });
});

// ── SEED_MARKETS catalog integrity ────────────────────────────────────────────

describe("SEED_MARKETS catalog integrity", () => {
  it("has at least one market", () => {
    expect(SEED_MARKETS.length).toBeGreaterThan(0);
  });

  it("all legs have required fields", () => {
    for (const market of SEED_MARKETS) {
      expect(market.id).toBeTruthy();
      expect(market.title).toBeTruthy();
      expect(market.category).toBeTruthy();
      expect(market.legs.length).toBeGreaterThan(0);

      for (const leg of market.legs) {
        expect(leg.id).toBeTypeOf("number");
        expect(leg.question).toBeTruthy();
        expect(leg.probabilityPPM).toBeGreaterThan(0);
        expect(leg.probabilityPPM).toBeLessThanOrEqual(1_000_000);
        expect(leg.cutoffTime).toBeTypeOf("number");
      }
    }
  });

  it("no duplicate leg IDs across all markets", () => {
    const ids = new Set<number>();
    for (const market of SEED_MARKETS) {
      for (const leg of market.legs) {
        expect(ids.has(leg.id)).toBe(false);
        ids.add(leg.id);
      }
    }
  });

  it("no duplicate questions across all markets (normalized)", () => {
    const questions = new Set<string>();
    for (const market of SEED_MARKETS) {
      for (const leg of market.legs) {
        const norm = normalize(leg.question);
        expect(questions.has(norm)).toBe(false);
        questions.add(norm);
      }
    }
  });
});
