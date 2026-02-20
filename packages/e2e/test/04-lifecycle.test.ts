/**
 * E2E: Full ticket lifecycle -- buy, resolve, settle, claim.
 * Mutates on-chain state. Order-independent: uses relative assertions.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getAddress, padHex } from "viem";
import { readAddresses, type DeployedAddresses } from "../helpers/addresses";
import {
  getPublicClient,
  getDeployerClient,
  getUserClient,
  getTestClient,
  DEPLOYER_ADDR,
  USER_ADDR,
} from "../helpers/clients";
import {
  USDC_ABI,
  VAULT_ABI,
  ENGINE_ABI,
  REGISTRY_ABI,
  ORACLE_ABI,
} from "../helpers/abis";

const ZERO_BYTES32 = padHex("0x0", { size: 32 });

let addrs: DeployedAddresses;
let pub: ReturnType<typeof getPublicClient>;
let deployer: ReturnType<typeof getDeployerClient>;
let user: ReturnType<typeof getUserClient>;
let testClient: ReturnType<typeof getTestClient>;

// Track ticket IDs dynamically (order-independent)
let winningTicketId: bigint;
let losingTicketId: bigint;

beforeAll(async () => {
  addrs = readAddresses();
  pub = getPublicClient();
  deployer = getDeployerClient();
  user = getUserClient();
  testClient = getTestClient();

  // Seed vault with LP: deployer deposits 5000 USDC
  const depositAmount = 5_000_000_000n; // 5000 USDC

  const assetsBefore = await pub.readContract({
    address: addrs.HouseVault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });

  // Approve vault
  let hash = await deployer.writeContract({
    address: addrs.MockUSDC,
    abi: USDC_ABI,
    functionName: "approve",
    args: [addrs.HouseVault, depositAmount],
  });
  await pub.waitForTransactionReceipt({ hash });

  // Deposit
  hash = await deployer.writeContract({
    address: addrs.HouseVault,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [depositAmount, DEPLOYER_ADDR],
  });
  await pub.waitForTransactionReceipt({ hash });

  const assetsAfter = await pub.readContract({
    address: addrs.HouseVault,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });
  // Check deposit delta, not absolute value (order-independent)
  expect(assetsAfter - assetsBefore).toBe(depositAmount);
});

describe("Full ticket lifecycle", () => {
  it("buy ticket with 2 legs", async () => {
    const stake = 10_000_000n; // 10 USDC

    const countBefore = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "ticketCount",
    });

    // User approves engine
    let hash = await user.writeContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addrs.ParlayEngine, stake],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Buy ticket with on-chain leg IDs 3 and 4 (first two seed legs)
    hash = await user.writeContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "buyTicket",
      args: [[3n, 4n], [ZERO_BYTES32, ZERO_BYTES32], stake],
    });
    await pub.waitForTransactionReceipt({ hash });

    const countAfter = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "ticketCount",
    });
    expect(countAfter).toBe(countBefore + 1n);

    winningTicketId = countBefore; // 0-indexed

    const ticket = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [winningTicketId],
    });
    expect(getAddress(ticket.buyer)).toBe(getAddress(USER_ADDR));
    expect(ticket.status).toBe(0); // Active
    expect(ticket.stake).toBe(stake);
    expect(ticket.potentialPayout).toBeGreaterThan(0n);

    // Check vault reserved
    const reserved = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalReserved",
    });
    expect(reserved).toBeGreaterThan(0n);

    // INVARIANT: totalReserved <= totalAssets
    const totalAssets = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    });
    expect(reserved).toBeLessThanOrEqual(totalAssets);
  });

  it("resolve legs as Won", async () => {
    // Advance time past cutoff (31 days -- seed legs have 30-day cutoffs)
    await testClient.increaseTime({ seconds: 31 * 86400 });
    await testClient.mine({ blocks: 1 });

    // Resolve leg 3 as Won (status = 1)
    let hash = await deployer.writeContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [3n, 1, ZERO_BYTES32],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Resolve leg 4 as Won (status = 1)
    hash = await deployer.writeContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [4n, 1, ZERO_BYTES32],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Verify statuses
    const [status3] = await pub.readContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "getStatus",
      args: [3n],
    });
    expect(status3).toBe(1); // Won

    const [status4] = await pub.readContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "getStatus",
      args: [4n],
    });
    expect(status4).toBe(1); // Won
  });

  it("settle ticket", async () => {
    // Settlement is permissionless -- user can settle
    const hash = await user.writeContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "settleTicket",
      args: [winningTicketId],
    });
    await pub.waitForTransactionReceipt({ hash });

    const ticket = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [winningTicketId],
    });
    // Status 1 = Won (settled, payout available)
    expect(ticket.status).toBe(1);
  });

  it("claim payout", async () => {
    const balBefore = await pub.readContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [USER_ADDR],
    });

    const reservedBefore = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalReserved",
    });

    const hash = await user.writeContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "claimPayout",
      args: [winningTicketId],
    });
    await pub.waitForTransactionReceipt({ hash });

    const ticket = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [winningTicketId],
    });
    expect(ticket.claimedAmount).toBeGreaterThan(0n);

    const balAfter = await pub.readContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [USER_ADDR],
    });
    expect(balAfter).toBeGreaterThan(balBefore);

    const reservedAfter = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalReserved",
    });
    expect(reservedAfter).toBeLessThan(reservedBefore);
  });

  it("losing ticket scenario", async () => {
    const stake = 5_000_000n; // 5 USDC

    // Create 2 fresh legs with cutoffs far in the future (relative to current block time)
    const block = await pub.getBlock();
    const futureCutoff = block.timestamp + BigInt(30 * 86400); // 30 days from now
    const futureResolve = futureCutoff + 3600n; // 1 hour after cutoff

    let hash = await deployer.writeContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "createLeg",
      args: [
        "E2E test leg A (losing scenario)",
        "e2e-test",
        futureCutoff,
        futureResolve,
        addrs.AdminOracleAdapter,
        BigInt(500_000), // 50% probability
      ],
    });
    await pub.waitForTransactionReceipt({ hash });

    hash = await deployer.writeContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "createLeg",
      args: [
        "E2E test leg B (losing scenario)",
        "e2e-test",
        futureCutoff,
        futureResolve,
        addrs.AdminOracleAdapter,
        BigInt(500_000), // 50% probability
      ],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Get IDs of the freshly created legs
    const legCount = await pub.readContract({
      address: addrs.LegRegistry,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    });
    const legA = legCount - 2n;
    const legB = legCount - 1n;

    const countBefore = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "ticketCount",
    });

    // Approve and buy
    hash = await user.writeContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addrs.ParlayEngine, stake],
    });
    await pub.waitForTransactionReceipt({ hash });

    hash = await user.writeContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "buyTicket",
      args: [[legA, legB], [ZERO_BYTES32, ZERO_BYTES32], stake],
    });
    await pub.waitForTransactionReceipt({ hash });

    losingTicketId = countBefore;

    // Advance time past the fresh legs' cutoff + earliestResolve
    await testClient.increaseTime({ seconds: 31 * 86400 });
    await testClient.mine({ blocks: 1 });

    // Resolve legA as Won, legB as Lost
    hash = await deployer.writeContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [legA, 1, ZERO_BYTES32],
    });
    await pub.waitForTransactionReceipt({ hash });

    hash = await deployer.writeContract({
      address: addrs.AdminOracleAdapter,
      abi: ORACLE_ABI,
      functionName: "resolve",
      args: [legB, 2, ZERO_BYTES32],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Settle
    hash = await user.writeContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "settleTicket",
      args: [losingTicketId],
    });
    await pub.waitForTransactionReceipt({ hash });

    const ticket = await pub.readContract({
      address: addrs.ParlayEngine,
      abi: ENGINE_ABI,
      functionName: "getTicket",
      args: [losingTicketId],
    });
    // Status 2 = Lost
    expect(ticket.status).toBe(2);

    // Claiming should revert for lost ticket
    await expect(
      user.writeContract({
        address: addrs.ParlayEngine,
        abi: ENGINE_ABI,
        functionName: "claimPayout",
        args: [losingTicketId],
      })
    ).rejects.toThrow();
  });
});
