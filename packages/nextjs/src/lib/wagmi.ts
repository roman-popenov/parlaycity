import { createConfig, http } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { fallback } from "viem";
import { getDefaultConfig } from "connectkit";
import { CHAIN_CONFIG } from "./config";

const primarySepoliaRpc = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;

export const config = createConfig(
  getDefaultConfig({
    appName: "ParlayVoo",
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
    chains: [baseSepolia, foundry],
    transports: {
      [baseSepolia.id]: primarySepoliaRpc
        ? fallback([http(primarySepoliaRpc), http(CHAIN_CONFIG.baseSepolia.rpcUrl)])
        : http(CHAIN_CONFIG.baseSepolia.rpcUrl),
      [foundry.id]: http(CHAIN_CONFIG.localhost.rpcUrl),
    },
  }),
);
