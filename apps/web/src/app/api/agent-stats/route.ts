import { NextResponse } from "next/server";
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  parseAbi,
  toFunctionSelector,
} from "viem";
import { baseSepolia } from "viem/chains";

const AGENT_WALLET = (process.env.NEXT_PUBLIC_AGENT_WALLET ??
  "0x1214ACab3De95D9C72354562D223f45e16a80389") as `0x${string}`;

const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";

const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);
const REGISTRY_ABI = parseAbi([
  "function legCount() view returns (uint256)",
]);
const ENGINE_ABI = parseAbi([
  "function ticketCount() view returns (uint256)",
]);

// Pre-compute known function selectors for tx decoding
const METHOD_NAMES: Record<string, string> = {};
const KNOWN_SIGS: [string, string][] = [
  ["function createLeg(string,string,uint256,uint256,address,uint256)", "createLeg"],
  ["function resolve(uint256,uint8,bytes32)", "resolve"],
  ["function settleTicket(uint256)", "settleTicket"],
  ["function buyTicket(uint256[],bytes32[],uint256)", "buyTicket"],
  ["function buyTicketWithMode(uint256[],bytes32[],uint256,uint8)", "buyTicketWithMode"],
  ["function deposit(uint256,address)", "deposit"],
  ["function withdraw(uint256,address)", "withdraw"],
  ["function lock(uint256,uint8)", "lock"],
  ["function unlock(uint256)", "unlock"],
  ["function claimPayout(uint256)", "claimPayout"],
  ["function claimProgressive(uint256)", "claimProgressive"],
  ["function cashoutEarly(uint256,uint256)", "cashoutEarly"],
  ["function approve(address,uint256)", "approve"],
  ["function mint(address,uint256)", "mint"],
  ["function earlyWithdraw(uint256)", "earlyWithdraw"],
  ["function notifyFees(uint256)", "notifyFees"],
  ["function routeFees(uint256)", "routeFees"],
];
for (const [sig, name] of KNOWN_SIGS) {
  METHOD_NAMES[toFunctionSelector(sig)] = name;
}

function decodeMethod(input: string): string {
  if (!input || input === "0x" || input.length < 10) return "transfer";
  const sig = input.slice(0, 10).toLowerCase();
  return METHOD_NAMES[sig] ?? sig;
}

// Simple in-memory cache (60s TTL)
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    });

    const usdcAddr = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined;
    const registryAddr = process.env.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS as `0x${string}` | undefined;
    const engineAddr = process.env.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS as `0x${string}` | undefined;

    // Parallel on-chain reads
    const [ethBalance, usdcBalance, legCount, ticketCount] = await Promise.all([
      client.getBalance({ address: AGENT_WALLET }),
      usdcAddr
        ? client.readContract({
            address: usdcAddr,
            abi: USDC_ABI,
            functionName: "balanceOf",
            args: [AGENT_WALLET],
          })
        : Promise.resolve(0n),
      registryAddr
        ? client.readContract({
            address: registryAddr,
            abi: REGISTRY_ABI,
            functionName: "legCount",
          })
        : Promise.resolve(0n),
      engineAddr
        ? client.readContract({
            address: engineAddr,
            abi: ENGINE_ABI,
            functionName: "ticketCount",
          })
        : Promise.resolve(0n),
    ]);

    // Fetch recent txs from Basescan
    let recentTxs: Array<{
      hash: string;
      method: string;
      gasUsed: string;
      gasCost: string;
      timestamp: number;
      status: string;
      to: string;
    }> = [];
    let totalGasSpent = 0n;

    try {
      const apiKey = process.env.BASESCAN_API_KEY ?? "";
      const url = `https://api-sepolia.basescan.org/api?module=account&action=txlist&address=${AGENT_WALLET}&sort=desc&page=1&offset=50${apiKey ? `&apikey=${apiKey}` : ""}`;
      const res = await fetch(url);
      const json = (await res.json()) as {
        status: string;
        result: Array<{
          hash: string;
          from: string;
          input: string;
          gasUsed: string;
          gasPrice: string;
          timeStamp: string;
          isError: string;
          to: string;
        }>;
      };

      if (json.status === "1" && Array.isArray(json.result)) {
        // Only include txs sent BY the agent (not incoming transfers)
        const agentTxs = json.result.filter(
          (tx) => tx.from.toLowerCase() === AGENT_WALLET.toLowerCase(),
        );

        recentTxs = agentTxs.slice(0, 20).map((tx) => {
          const gasUsed = BigInt(tx.gasUsed);
          const gasPrice = BigInt(tx.gasPrice);
          const gasCost = gasUsed * gasPrice;
          return {
            hash: tx.hash,
            method: decodeMethod(tx.input),
            gasUsed: tx.gasUsed,
            gasCost: formatEther(gasCost),
            timestamp: Number(tx.timeStamp),
            status: tx.isError === "0" ? "success" : "failed",
            to: tx.to,
          };
        });

        totalGasSpent = agentTxs.reduce((sum: bigint, tx) => {
          return sum + BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
        }, 0n);
      }
    } catch {
      // Basescan unavailable -- continue without tx history
    }

    const data = {
      wallet: AGENT_WALLET,
      ethBalance: formatEther(ethBalance),
      usdcBalance: formatUnits(usdcBalance as bigint, 6),
      legCount: Number(legCount),
      ticketCount: Number(ticketCount),
      totalGasSpentEth: formatEther(totalGasSpent),
      recentTxs,
      contracts: {
        parlayEngine: engineAddr ?? null,
        legRegistry: registryAddr ?? null,
        houseVault: process.env.NEXT_PUBLIC_HOUSE_VAULT_ADDRESS ?? null,
        lockVault: process.env.NEXT_PUBLIC_LOCK_VAULT_ADDRESS ?? null,
        usdc: usdcAddr ?? null,
      },
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532),
      timestamp: Date.now(),
    };

    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to fetch agent stats", detail: msg },
      { status: 500 },
    );
  }
}
