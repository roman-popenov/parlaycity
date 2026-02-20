/**
 * E2E: Verify contract deployment configuration.
 * Read-only -- checks immutable wiring and config params only.
 * Order-independent: no assertions on mutable state (balances, counts).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getAddress } from "viem";
import { readAddresses, type DeployedAddresses } from "../helpers/addresses";
import { getPublicClient } from "../helpers/clients";
import {
  USDC_ABI,
  VAULT_ABI,
  ENGINE_ABI,
  LOCK_VAULT_ABI,
} from "../helpers/abis";

let addrs: DeployedAddresses;
let pub: ReturnType<typeof getPublicClient>;

beforeAll(() => {
  addrs = readAddresses();
  pub = getPublicClient();
});

describe("Contract deployment", () => {
  it("HouseVault: correct wiring and config", async () => {
    const engine = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "engine",
    });
    expect(getAddress(engine)).toBe(getAddress(addrs.ParlayEngine));

    const lockVault = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "lockVault",
    });
    expect(getAddress(lockVault)).toBe(getAddress(addrs.LockVault));

    const maxUtil = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "maxUtilizationBps",
    });
    expect(maxUtil).toBe(8000n);

    const maxPayout = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "maxPayoutBps",
    });
    expect(maxPayout).toBe(500n);

    const paused = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "paused",
    });
    expect(paused).toBe(false);
  });

  it("ParlayEngine: correct config and wiring", async () => {
    const baseFee = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "baseFee",
    });
    expect(baseFee).toBe(100n);

    const perLegFee = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "perLegFee",
    });
    expect(perLegFee).toBe(50n);

    const minStake = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "minStake",
    });
    expect(minStake).toBe(1_000_000n);

    const maxLegs = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "maxLegs",
    });
    expect(maxLegs).toBe(5n);

    const vault = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "vault",
    });
    expect(getAddress(vault)).toBe(getAddress(addrs.HouseVault));

    const registry = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "registry",
    });
    expect(getAddress(registry)).toBe(getAddress(addrs.LegRegistry));

    const usdc = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "usdc",
    });
    expect(getAddress(usdc)).toBe(getAddress(addrs.MockUSDC));
  });

  it("LockVault: correct wiring", async () => {
    const feeDist = await pub.readContract({
      address: addrs.LockVault,
      abi: LOCK_VAULT_ABI,
      functionName: "feeDistributor",
    });
    expect(getAddress(feeDist)).toBe(getAddress(addrs.HouseVault));

    const penalty = await pub.readContract({
      address: addrs.LockVault,
      abi: LOCK_VAULT_ABI,
      functionName: "basePenaltyBps",
    });
    expect(penalty).toBe(1000n);
  });

  it("MockUSDC: correct decimals", async () => {
    const decimals = await pub.readContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "decimals",
    });
    expect(decimals).toBe(6);
  });
});
