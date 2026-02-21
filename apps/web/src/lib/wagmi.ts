import { createConfig, http } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import { CHAIN_CONFIG } from "./config";

export const config = createConfig(
  getDefaultConfig({
    appName: "ParlayVoo",
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
    chains: [baseSepolia, foundry],
    transports: {
      [baseSepolia.id]: http(CHAIN_CONFIG.baseSepolia.rpcUrl),
      [foundry.id]: http(CHAIN_CONFIG.localhost.rpcUrl),
    },
  }),
);
