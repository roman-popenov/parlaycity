import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia, foundry } from "viem/chains";
import { LEG_REGISTRY_ABI } from "@/lib/contracts";
import { NBA_LEG_ID_OFFSET } from "@/lib/bdl";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
const chain = chainId === 31337 ? foundry : baseSepolia;
const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL ??
  (chainId === 31337 ? "http://127.0.0.1:8545" : "https://sepolia.base.org");

const registryAddr = (process.env.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ?? "") as `0x${string}`;

let cachedMapping: { generated: string; chainId: number; legs: Record<string, number> } | null = null;
let cacheTimestamp = 0;

/**
 * GET /api/leg-mapping
 *
 * Dynamically queries LegRegistry on-chain and builds a catalog-ID -> on-chain-ID mapping.
 * Cached for 5 minutes to avoid excessive RPC calls.
 */
export async function GET() {
  if (cachedMapping && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedMapping, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  if (!registryAddr) {
    return NextResponse.json(
      { error: "LEG_REGISTRY_ADDRESS not configured" },
      { status: 503 },
    );
  }

  try {
    const client = createPublicClient({ chain, transport: http(rpcUrl) });

    const legCount = Number(
      await client.readContract({
        address: registryAddr,
        abi: LEG_REGISTRY_ABI,
        functionName: "legCount",
      }),
    );

    const mapping: Record<string, number> = {};

    for (let i = 0; i < legCount; i++) {
      const leg = (await client.readContract({
        address: registryAddr,
        abi: LEG_REGISTRY_ABI,
        functionName: "getLeg",
        args: [BigInt(i)],
      })) as { question: string; sourceRef: string };

      // Seed legs: on-chain 0-20 -> catalog 1-21
      if (i <= 20) {
        mapping[String(i + 1)] = i;
        continue;
      }

      // NBA legs: derive catalog ID from sourceRef
      const mlMatch = leg.sourceRef.match(/^bdl:game:(\d+)$/);
      const ouMatch = leg.sourceRef.match(/^bdl:game:(\d+):ou$/);

      if (mlMatch) {
        const gameId = parseInt(mlMatch[1]);
        mapping[String(NBA_LEG_ID_OFFSET + gameId * 2)] = i;
      } else if (ouMatch) {
        const gameId = parseInt(ouMatch[1]);
        mapping[String(NBA_LEG_ID_OFFSET + gameId * 2 + 1)] = i;
      } else {
        console.warn(`[leg-mapping] Unrecognized sourceRef for leg ${i}: "${leg.sourceRef}"`);
      }
    }

    cachedMapping = {
      generated: new Date().toISOString(),
      chainId,
      legs: mapping,
    };
    cacheTimestamp = Date.now();

    return NextResponse.json(cachedMapping, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    // Fall back to static file if on-chain query fails
    return NextResponse.json(
      { error: `Failed to query LegRegistry: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
