/**
 * Register Legs -- bridges catalog legs to on-chain LegRegistry.
 *
 * Reads SEED_MARKETS from the catalog, checks which questions are already
 * registered on-chain, and creates missing legs. Writes a mapping file
 * to apps/web/public/leg-mapping.json so the frontend can translate
 * catalog IDs to on-chain IDs.
 *
 * Idempotent: safe to run multiple times. Uses question-text matching
 * (normalized lowercase + trimmed) to detect existing legs.
 *
 * Usage (from repo root):
 *   pnpm --filter services exec tsx ../../scripts/register-legs.ts
 *
 * Env vars (or reads from apps/web/.env.local):
 *   RPC_URL               -- defaults to http://127.0.0.1:8545
 *   PRIVATE_KEY           -- defaults to Anvil account #0 (local only)
 *   LEG_REGISTRY_ADDRESS  -- overrides .env.local
 *   ADMIN_ORACLE_ADDRESS  -- overrides .env.local
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, baseSepolia } from "viem/chains";

import { loadEnvLocal, requireExplicitKeyForRemoteRpc, safeBigIntToNumber } from "./lib/env";

// Import seed markets directly (no API dependency)
import { SEED_MARKETS } from "../packages/services/src/catalog/seed";

// -- ABI fragments -----------------------------------------------------------

const REGISTRY_ABI = parseAbi([
  "function legCount() view returns (uint256)",
  "function getLeg(uint256 legId) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
  "function createLeg(string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM)",
]);

// -- Helpers -----------------------------------------------------------------

export function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// -- Config ------------------------------------------------------------------

function getConfig() {
  const envLocal = loadEnvLocal();

  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  requireExplicitKeyForRemoteRpc(rpcUrl);

  const privateKey = (process.env.PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;

  const registryAddr = (process.env.LEG_REGISTRY_ADDRESS ??
    envLocal.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ??
    "") as Address;

  const adminOracleAddr = (process.env.ADMIN_ORACLE_ADDRESS ??
    envLocal.NEXT_PUBLIC_ADMIN_ORACLE_ADDRESS ??
    "") as Address;

  if (!registryAddr) throw new Error("Missing LEG_REGISTRY_ADDRESS");
  if (!adminOracleAddr) throw new Error("Missing ADMIN_ORACLE_ADDRESS");

  const chain: Chain = rpcUrl.includes("sepolia") ? baseSepolia : foundry;

  return { rpcUrl, privateKey, registryAddr, adminOracleAddr, chain };
}

// -- Main --------------------------------------------------------------------

async function main() {
  const cfg = getConfig();
  console.log("[register-legs] Starting leg registration");
  console.log(`[register-legs] RPC: ${cfg.rpcUrl}`);
  console.log(`[register-legs] Registry: ${cfg.registryAddr}`);
  console.log(`[register-legs] AdminOracle: ${cfg.adminOracleAddr}`);

  const account = privateKeyToAccount(cfg.privateKey);
  console.log(`[register-legs] Account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
    account,
  });

  // Read existing on-chain legs
  const legCount = safeBigIntToNumber(
    await publicClient.readContract({
      address: cfg.registryAddr,
      abi: REGISTRY_ABI,
      functionName: "legCount",
    }),
    "legCount",
  );
  console.log(`[register-legs] Existing on-chain legs: ${legCount}`);

  const existingQuestions = new Map<string, number>(); // normalized question -> legId
  for (let i = 0; i < legCount; i++) {
    const leg = await publicClient.readContract({
      address: cfg.registryAddr,
      abi: REGISTRY_ABI,
      functionName: "getLeg",
      args: [BigInt(i)],
    });
    existingQuestions.set(normalize(leg.question), i);
  }

  // Collect all catalog legs
  const catalogLegs: Array<{
    catalogId: number;
    question: string;
    sourceRef: string;
    cutoffTime: number;
    earliestResolve: number;
    probabilityPPM: number;
  }> = [];

  for (const market of SEED_MARKETS) {
    for (const leg of market.legs) {
      catalogLegs.push({
        catalogId: leg.id,
        question: leg.question,
        sourceRef: leg.sourceRef,
        cutoffTime: leg.cutoffTime,
        earliestResolve: leg.earliestResolve,
        probabilityPPM: leg.probabilityPPM,
      });
    }
  }

  // Optionally fetch BDL legs from services API
  try {
    const res = await fetch("http://127.0.0.1:3001/markets?category=nba");
    if (res.ok) {
      const nbaMarkets = await res.json();
      if (Array.isArray(nbaMarkets)) {
        for (const market of nbaMarkets) {
          for (const leg of market.legs) {
            catalogLegs.push({
              catalogId: leg.id,
              question: leg.question,
              sourceRef: leg.sourceRef ?? `bdl:${leg.id}`,
              cutoffTime: leg.cutoffTime,
              earliestResolve: leg.earliestResolve,
              probabilityPPM: leg.probabilityPPM,
            });
          }
        }
        console.log(`[register-legs] Fetched ${nbaMarkets.length} NBA markets from services`);
      }
    }
  } catch {
    console.log("[register-legs] Services not running, skipping NBA legs");
  }

  // Register missing legs
  const mapping: Record<string, number> = {}; // catalogId -> onChainId
  let created = 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDaysFromNow = nowSec + 7 * 24 * 3600;

  // Explicitly manage nonce to avoid "nonce too low" / "replacement transaction
  // underpriced" errors on real networks where RPC propagation lags behind
  // waitForTransactionReceipt.
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  console.log(`[register-legs] Starting nonce: ${nonce}`);

  for (const leg of catalogLegs) {
    const normalizedQ = normalize(leg.question);

    // Check if already registered
    if (existingQuestions.has(normalizedQ)) {
      const onChainId = existingQuestions.get(normalizedQ)!;
      mapping[String(leg.catalogId)] = onChainId;
      continue;
    }

    // Use catalog cutoff if in the future, else 7 days from now
    const cutoff = leg.cutoffTime > nowSec ? leg.cutoffTime : sevenDaysFromNow;
    const earliest = leg.earliestResolve > cutoff ? leg.earliestResolve : cutoff + 3600;

    console.log(`[register-legs] Creating leg ${created + 1} (nonce ${nonce}): "${leg.question.slice(0, 60)}..." (PPM: ${leg.probabilityPPM})`);

    const hash = await walletClient.writeContract({
      address: cfg.registryAddr,
      abi: REGISTRY_ABI,
      functionName: "createLeg",
      args: [
        leg.question,
        leg.sourceRef,
        BigInt(cutoff),
        BigInt(earliest),
        cfg.adminOracleAddr,
        BigInt(leg.probabilityPPM),
      ],
      nonce,
      chain: cfg.chain,
      account,
    });

    nonce++; // Increment locally before waiting -- we know the next nonce

    await publicClient.waitForTransactionReceipt({ hash });

    // Derive actual on-chain ID from post-creation legCount (race-safe)
    const legCountAfter = safeBigIntToNumber(
      await publicClient.readContract({
        address: cfg.registryAddr,
        abi: REGISTRY_ABI,
        functionName: "legCount",
      }),
      "legCountAfter",
    );
    const newId = legCountAfter - 1;
    existingQuestions.set(normalizedQ, newId);
    mapping[String(leg.catalogId)] = newId;
    created++;
  }

  console.log(`[register-legs] Created ${created} new legs, ${Object.keys(mapping).length} total mapped`);

  // Write mapping file
  const chainId = cfg.chain.id;
  const outputPath = resolve(__dirname, "../apps/web/public/leg-mapping.json");
  const output = {
    generated: new Date().toISOString(),
    chainId,
    legs: mapping,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`[register-legs] Wrote mapping to ${outputPath}`);
  console.log("[register-legs] Done.");
}

main().catch((err) => {
  console.error("[register-legs] Fatal:", err);
  process.exit(1);
});
