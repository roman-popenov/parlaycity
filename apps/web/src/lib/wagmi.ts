import { createConfig, http } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import { CHAIN_CONFIG } from "./config";

export const config = createConfig(
  getDefaultConfig({
    appName: "ParlayCity",
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
    chains: [foundry, baseSepolia],
    transports: {
      [baseSepolia.id]: http(CHAIN_CONFIG.baseSepolia.rpcUrl),
      [foundry.id]: http(CHAIN_CONFIG.localhost.rpcUrl),
    },
  }),
);
