export const CHAIN_CONFIG = {
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
  },
  localhost: {
    id: 31337,
    name: "Anvil",
    rpcUrl: "http://127.0.0.1:8545",
  },
} as const;

export const CONTRACT_ADDRESSES: Record<string, string> = {
  houseVault: process.env.NEXT_PUBLIC_HOUSE_VAULT_ADDRESS ?? "",
  parlayEngine: process.env.NEXT_PUBLIC_PARLAY_ENGINE_ADDRESS ?? "",
  legRegistry: process.env.NEXT_PUBLIC_LEG_REGISTRY_ADDRESS ?? "",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
  lockVault: process.env.NEXT_PUBLIC_LOCK_VAULT_ADDRESS ?? "",
};

export const SERVICES_API_URL =
  process.env.NEXT_PUBLIC_SERVICES_URL ?? "http://localhost:3001";

export const PARLAY_CONFIG = {
  maxLegs: 5,
  minLegs: 2,
  minStakeUSDC: 1,
  baseFee: 100, // bps
  perLegFee: 50, // bps
} as const;
