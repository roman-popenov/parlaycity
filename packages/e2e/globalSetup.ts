/**
 * Vitest globalSetup -- boots Anvil, deploys contracts, registers catalog legs.
 * Runs once before all test files, teardown kills Anvil after all tests complete.
 */
import { execSync, spawn, type ChildProcess } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { parseBroadcast, writeAddresses, cleanupAddresses } from "./helpers/addresses";

// Paths
const ROOT = resolve(__dirname, "../..");
const CONTRACTS_DIR = resolve(ROOT, "packages/contracts");
const BROADCAST_PATH = resolve(
  CONTRACTS_DIR,
  "broadcast/Deploy.s.sol/31337/run-latest.json"
);

// Anvil config
const ANVIL_PORT = 8546;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

let anvilProcess: ChildProcess | null = null;

// -- ABI for leg registration --
const REGISTRY_ABI = parseAbi([
  "function legCount() view returns (uint256)",
  "function getLeg(uint256 legId) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
  "function createLeg(string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM)",
]);

function waitForAnvil(proc: ChildProcess, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Anvil did not start within ${timeoutMs}ms`));
    }, timeoutMs);

    const onData = (data: Buffer) => {
      if (data.toString().includes("Listening on")) {
        clearTimeout(timer);
        proc.stdout?.removeListener("data", onData);
        resolve();
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("error") || msg.includes("Error")) {
        clearTimeout(timer);
        reject(new Error(`Anvil error: ${msg}`));
      }
    });

    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) {
        reject(new Error(`Anvil exited with code ${code}`));
      }
    });
  });
}

async function registerSeedLegs(
  registryAddr: `0x${string}`,
  oracleAddr: `0x${string}`
): Promise<void> {
  // Dynamic import to avoid bundling issues
  const { SEED_MARKETS } = await import(
    "../../packages/services/src/catalog/seed"
  );

  const account = privateKeyToAccount(DEPLOYER_KEY);
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(RPC_URL),
  });

  // Read existing leg count
  const existingCount = await publicClient.readContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "legCount",
  });

  // Build set of existing questions (normalized) to avoid duplicates
  const existingQuestions = new Set<string>();
  for (let i = 0n; i < existingCount; i++) {
    const leg = await publicClient.readContract({
      address: registryAddr,
      abi: REGISTRY_ABI,
      functionName: "getLeg",
      args: [i],
    });
    existingQuestions.add(leg.question.trim().toLowerCase());
  }

  const now = Math.floor(Date.now() / 1000);
  const futureBuffer = 30 * 86400; // 30 days -- enough headroom for increaseTime in lifecycle tests

  let registered = 0;
  for (const market of SEED_MARKETS) {
    for (const leg of market.legs) {
      const normalized = leg.question.trim().toLowerCase();
      if (existingQuestions.has(normalized)) continue;

      const cutoffTime = leg.cutoffTime < now ? now + futureBuffer : leg.cutoffTime;
      const earliestResolve =
        leg.earliestResolve < now ? cutoffTime + 3600 : leg.earliestResolve;

      const hash = await walletClient.writeContract({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: "createLeg",
        args: [
          leg.question,
          leg.sourceRef,
          BigInt(cutoffTime),
          BigInt(earliestResolve),
          oracleAddr,
          BigInt(leg.probabilityPPM),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      existingQuestions.add(normalized);
      registered++;
    }
  }

  const finalCount = await publicClient.readContract({
    address: registryAddr,
    abi: REGISTRY_ABI,
    functionName: "legCount",
  });
  console.log(
    `[e2e-setup] Registered ${registered} new legs (total on-chain: ${finalCount})`
  );
}

export async function setup(): Promise<void> {
  console.log("[e2e-setup] Starting Anvil on port", ANVIL_PORT);

  // 1. Start Anvil
  anvilProcess = spawn("anvil", ["--port", String(ANVIL_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForAnvil(anvilProcess);
  console.log("[e2e-setup] Anvil ready");

  // 2. Deploy contracts
  console.log("[e2e-setup] Deploying contracts...");
  execSync(
    `forge script script/Deploy.s.sol --broadcast --rpc-url ${RPC_URL}`,
    {
      cwd: CONTRACTS_DIR,
      stdio: "pipe",
      env: { ...process.env, PRIVATE_KEY: DEPLOYER_KEY },
    }
  );

  if (!existsSync(BROADCAST_PATH)) {
    throw new Error(`Broadcast file not found at ${BROADCAST_PATH}`);
  }

  // 3. Parse addresses from broadcast
  const addresses = parseBroadcast(BROADCAST_PATH);
  writeAddresses(addresses);
  console.log("[e2e-setup] Contracts deployed:", Object.keys(addresses).join(", "));

  // 4. Register seed catalog legs
  console.log("[e2e-setup] Registering seed legs...");
  await registerSeedLegs(
    getAddress(addresses.LegRegistry) as `0x${string}`,
    getAddress(addresses.AdminOracleAdapter) as `0x${string}`
  );

  console.log("[e2e-setup] Setup complete");
}

export async function teardown(): Promise<void> {
  console.log("[e2e-setup] Tearing down...");
  if (anvilProcess) {
    anvilProcess.kill("SIGTERM");
    anvilProcess = null;
  }
  cleanupAddresses();
  console.log("[e2e-setup] Teardown complete");
}
