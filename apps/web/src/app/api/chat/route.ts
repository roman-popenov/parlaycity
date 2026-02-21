import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  listMarkets,
  getQuote,
  assessRisk,
  getVaultHealth,
  getLegStatus,
  getProtocolConfig,
} from "@/lib/mcp/tools";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are ParlayCity AI, an expert assistant for the ParlayCity crash-parlay protocol on Base.
You help users discover betting markets, understand quotes and risk, and check protocol health.
Use your tools to fetch live data -- never make up numbers. Be concise and helpful.
When showing market data, format it clearly. When showing risk assessments, highlight the action recommendation.
USDC amounts are in 6-decimal format on-chain but display as human-readable dollars.`,
    messages,
    tools: {
      list_markets: tool({
        description:
          "List available betting markets. Optionally filter by category (crypto, defi, nft, policy, economics, trivia, ethdenver).",
        parameters: z.object({
          category: z
            .string()
            .optional()
            .describe("Filter by category name"),
        }),
        execute: async (input) => listMarkets(input),
      }),
      get_quote: tool({
        description:
          "Get a parlay quote for specific legs with a stake amount. Returns multiplier, potential payout, and fees.",
        parameters: z.object({
          legIds: z
            .array(z.number())
            .min(2)
            .max(5)
            .describe("Array of leg IDs (2-5 legs)"),
          stake: z
            .number()
            .positive()
            .describe("Stake amount in USDC"),
        }),
        execute: async (input) => getQuote(input),
      }),
      assess_risk: tool({
        description:
          "Assess the risk of a parlay using Kelly criterion. Returns action recommendation (BUY/REDUCE_STAKE/AVOID), suggested stake, and win probability.",
        parameters: z.object({
          legIds: z
            .array(z.number())
            .min(2)
            .max(5)
            .describe("Array of leg IDs"),
          stake: z.number().positive().describe("Proposed stake in USDC"),
          bankroll: z
            .number()
            .positive()
            .optional()
            .describe("Total bankroll in USDC (default 1000)"),
        }),
        execute: async (input) => assessRisk(input),
      }),
      get_vault_health: tool({
        description:
          "Check the health of the HouseVault -- total assets, reserved amounts, free liquidity, and utilization percentage.",
        parameters: z.object({}),
        execute: async () => getVaultHealth(),
      }),
      get_leg_status: tool({
        description:
          "Get the status of a specific betting leg by ID, including on-chain registration status.",
        parameters: z.object({
          legId: z.number().describe("The leg ID to look up"),
        }),
        execute: async (input) => getLegStatus(input),
      }),
      get_protocol_config: tool({
        description:
          "Get ParlayCity protocol configuration -- fee structure, limits, contract addresses, and chain info.",
        parameters: z.object({}),
        execute: async () => getProtocolConfig(),
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
