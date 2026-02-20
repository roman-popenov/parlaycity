/**
 * E2E: Verify leg registration matches seed catalog.
 * Read-only -- no mutations to on-chain state.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readAddresses, type DeployedAddresses } from "../helpers/addresses";
import { getPublicClient } from "../helpers/clients";
import { REGISTRY_ABI } from "../helpers/abis";
import { SEED_MARKETS } from "../../../packages/services/src/catalog/seed";

let addrs: DeployedAddresses;
let pub: ReturnType<typeof getPublicClient>;

beforeAll(() => {
  addrs = readAddresses();
  pub = getPublicClient();
});

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

describe("Leg registration", () => {
  it("legCount matches expected total", async () => {
    const count = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });
    // 3 from Deploy.s.sol + 21 from seed catalog = 24 minimum
    expect(count).toBeGreaterThanOrEqual(24n);
  });

  it("each registered seed leg has valid data", async () => {
    const count = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });

    // Check legs 3 onward (seed legs start after deploy's 3)
    for (let i = 3n; i < count; i++) {
      const leg = await pub.readContract({
        address: addrs.LegRegistry,
        abi: REGISTRY_ABI,
        functionName: "getLeg",
        args: [i],
      });
      expect(leg.active).toBe(true);
      expect(leg.probabilityPPM).toBeGreaterThan(0n);
      expect(leg.oracleAdapter).not.toBe(
        "0x0000000000000000000000000000000000000000"
      );
    }
  });

  it("seed leg questions match catalog", async () => {
    const count = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });

    // Build map of on-chain questions -> probabilityPPM
    const onChainLegs = new Map<string, bigint>();
    for (let i = 0n; i < count; i++) {
      const leg = await pub.readContract({
        address: addrs.LegRegistry,
        abi: REGISTRY_ABI,
        functionName: "getLeg",
        args: [i],
      });
      onChainLegs.set(normalize(leg.question), leg.probabilityPPM);
    }

    // Verify every seed leg exists on-chain with matching probability
    for (const market of SEED_MARKETS) {
      for (const leg of market.legs) {
        const key = normalize(leg.question);
        expect(onChainLegs.has(key)).toBe(true);
        expect(onChainLegs.get(key)).toBe(BigInt(leg.probabilityPPM));
      }
    }
  });

  it("seed legs have non-zero cutoff times", async () => {
    const count = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });

    // Verify seed legs (IDs 3+) have non-zero cutoffs
    for (let i = 3n; i < count; i++) {
      const leg = await pub.readContract({
        address: addrs.LegRegistry,
        abi: REGISTRY_ABI,
        functionName: "getLeg",
        args: [i],
      });
      expect(leg.cutoffTime).toBeGreaterThan(0n);
    }
  });
});
