import { NextResponse } from "next/server";
import {
  listMarkets,
  getQuote,
  assessRisk,
  getVaultHealth,
  getLegStatus,
  getProtocolConfig,
} from "@/lib/mcp/tools";

// MCP tool definitions for tools/list response
const TOOL_DEFINITIONS = [
  {
    name: "list_markets",
    description:
      "List available ParlayVoo betting markets. Optionally filter by category.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Filter by category: crypto, defi, nft, policy, economics, trivia, ethdenver",
        },
      },
    },
  },
  {
    name: "get_quote",
    description:
      "Get a parlay quote -- multiplier, potential payout, and fees for given legs and stake.",
    inputSchema: {
      type: "object",
      properties: {
        legIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of 2-5 leg IDs",
        },
        stake: { type: "number", description: "Stake in USDC" },
      },
      required: ["legIds", "stake"],
    },
  },
  {
    name: "get_vault_health",
    description:
      "Check HouseVault health: total assets, reserved, free liquidity, utilization.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_leg_status",
    description: "Get status of a specific betting leg by ID.",
    inputSchema: {
      type: "object",
      properties: {
        legId: { type: "number", description: "Leg ID" },
      },
      required: ["legId"],
    },
  },
  {
    name: "assess_risk",
    description:
      "Assess parlay risk using Kelly criterion. Returns BUY/REDUCE_STAKE/AVOID recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        legIds: {
          type: "array",
          items: { type: "number" },
          description: "Array of 2-5 leg IDs",
        },
        stake: { type: "number", description: "Proposed stake in USDC" },
        bankroll: {
          type: "number",
          description: "Total bankroll in USDC (default 1000)",
        },
      },
      required: ["legIds", "stake"],
    },
  },
  {
    name: "get_protocol_config",
    description:
      "Get protocol configuration: fees, limits, contract addresses, chain info.",
    inputSchema: { type: "object", properties: {} },
  },
];

// Tool name -> executor mapping
const TOOL_EXECUTORS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  list_markets: (args) => listMarkets(args as { category?: string }),
  get_quote: (args) =>
    getQuote(args as { legIds: number[]; stake: number }),
  get_vault_health: () => getVaultHealth(),
  get_leg_status: (args) => getLegStatus(args as { legId: number }),
  assess_risk: (args) =>
    assessRisk(args as { legIds: number[]; stake: number; bankroll?: number }),
  get_protocol_config: () => getProtocolConfig(),
};

/**
 * MCP JSON-RPC endpoint for external AI agents.
 * Supports: tools/list, tools/call
 */
export async function POST(req: Request) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400 },
    );
  }

  const { id, method, params } = body;

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOL_DEFINITIONS },
    });
  }

  if (method === "tools/call") {
    const toolName = (params?.name as string) ?? "";
    const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};
    const executor = TOOL_EXECUTORS[toolName];

    if (!executor) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      });
    }

    try {
      const result = await executor(toolArgs);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        },
      });
    } catch (e) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: e instanceof Error ? e.message : String(e),
              }),
            },
          ],
          isError: true,
        },
      });
    }
  }

  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    },
    { status: 400 },
  );
}

// GET for discoverability
export async function GET() {
  return NextResponse.json({
    name: "parlayvoo-mcp",
    version: "1.0.0",
    description:
      "ParlayVoo MCP server -- crash-parlay AMM on Base. Provides market discovery, quotes, risk assessment, and on-chain state.",
    tools: TOOL_DEFINITIONS.map((t) => t.name),
    protocol: "MCP JSON-RPC",
    usage: "POST with { jsonrpc: '2.0', method: 'tools/list' | 'tools/call', params: { name, arguments } }",
  });
}
