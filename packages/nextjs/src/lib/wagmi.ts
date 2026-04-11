import { createConfig, http } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { fallback, type Transport } from "viem";
import { getDefaultConfig } from "connectkit";
import { CHAIN_CONFIG } from "./config";

const primarySepoliaRpc = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;

// Wraps a transport to record every JSON-RPC request on window.__rpcCalls.
// Used by the DebugRpcCounter overlay (?debug=1).
const counted = (inner: Transport): Transport =>
  ((args: Parameters<Transport>[0]) => {
    const t = inner(args);
    const orig = t.request;
    const request: typeof orig = async (params, opts) => {
      if (typeof window !== "undefined") {
        const w = window as unknown as { __rpcCalls?: { method: string; ts: number }[] };
        if (!w.__rpcCalls) w.__rpcCalls = [];
        w.__rpcCalls.push({ method: (params as { method: string }).method, ts: Date.now() });
        if (w.__rpcCalls.length > 5000) w.__rpcCalls.splice(0, w.__rpcCalls.length - 5000);
      }
      return orig(params, opts);
    };
    return { ...t, request };
  }) as Transport;

export const config = createConfig(
  getDefaultConfig({
    appName: "ParlayVoo",
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
    chains: [baseSepolia, foundry],
    transports: {
      [baseSepolia.id]: primarySepoliaRpc
        ? counted(fallback([http(primarySepoliaRpc), http(CHAIN_CONFIG.baseSepolia.rpcUrl)]))
        : counted(http(CHAIN_CONFIG.baseSepolia.rpcUrl)),
      [foundry.id]: counted(http(CHAIN_CONFIG.localhost.rpcUrl)),
    },
  }),
);
