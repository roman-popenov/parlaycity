/**
 * E2E: Vault LP deposit/withdraw flow.
 * Mutates on-chain state. Must run after lifecycle suite.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readAddresses, type DeployedAddresses } from "../helpers/addresses";
import {
  getPublicClient,
  getDeployerClient,
  DEPLOYER_ADDR,
} from "../helpers/clients";
import { USDC_ABI, VAULT_ABI } from "../helpers/abis";

let addrs: DeployedAddresses;
let pub: ReturnType<typeof getPublicClient>;
let deployer: ReturnType<typeof getDeployerClient>;

beforeAll(async () => {
  addrs = readAddresses();
  pub = getPublicClient();
  deployer = getDeployerClient();
});

describe("Vault LP operations", () => {
  it("deposit USDC, receive vUSDC shares", async () => {
    const depositAmount = 1_000_000_000n; // 1000 USDC

    // Approve
    let hash = await deployer.writeContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [addrs.HouseVault, depositAmount],
    });
    await pub.waitForTransactionReceipt({ hash });

    // Get balance before
    const sharesBefore = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [DEPLOYER_ADDR],
    });

    // Deposit
    hash = await deployer.writeContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [depositAmount, DEPLOYER_ADDR],
    });
    await pub.waitForTransactionReceipt({ hash });

    const sharesAfter = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [DEPLOYER_ADDR],
    });
    expect(sharesAfter).toBeGreaterThan(sharesBefore);

    // Total assets should include this deposit
    const totalAssets = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    });
    expect(totalAssets).toBeGreaterThan(0n);
  });

  it("withdraw shares, receive USDC", async () => {
    // HouseVault.withdraw takes (shares, receiver) -- NOT (assets, receiver, owner)
    // Convert desired USDC amount to shares first
    const sharesToWithdraw = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "convertToShares",
      args: [500_000_000n], // ~500 USDC worth of shares
    });

    const usdcBefore = await pub.readContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [DEPLOYER_ADDR],
    });

    const assetsBefore = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    });

    const hash = await deployer.writeContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [sharesToWithdraw, DEPLOYER_ADDR],
    });
    await pub.waitForTransactionReceipt({ hash });

    const usdcAfter = await pub.readContract({
      address: addrs.MockUSDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [DEPLOYER_ADDR],
    });
    expect(usdcAfter).toBeGreaterThan(usdcBefore);

    const assetsAfter = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    });
    expect(assetsAfter).toBeLessThan(assetsBefore);
  });

  it("cannot withdraw more than available shares", async () => {
    // Get deployer's current shares and try to withdraw way more
    const currentShares = await pub.readContract({
      address: addrs.HouseVault,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [DEPLOYER_ADDR],
    });

    const excessShares = currentShares + 1_000_000_000_000n;

    await expect(
      deployer.writeContract({
        address: addrs.HouseVault,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [excessShares, DEPLOYER_ADDR],
      })
    ).rejects.toThrow();
  });
});
