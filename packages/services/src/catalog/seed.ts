import type { Market } from "@parlaycity/shared";

export const SEED_MARKETS: Market[] = [
  {
    id: "ethdenver-2026",
    title: "ETHDenver 2026 Predictions",
    description: "Will these things happen at ETHDenver?",
    category: "crypto",
    legs: [
      { id: 1, question: "Will ETH be above $3000 by March 1?", sourceRef: "price-feed", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 600000, active: true },
      { id: 2, question: "Will Base TVL exceed $15B?", sourceRef: "defillama", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 450000, active: true },
      { id: 3, question: "Will Vitalik attend ETHDenver?", sourceRef: "social", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 350000, active: true },
    ],
  },
  {
    id: "defi-markets",
    title: "DeFi Market Moves",
    description: "Predict the next big DeFi moves",
    category: "defi",
    legs: [
      { id: 4, question: "Will Uniswap v4 launch on Base?", sourceRef: "uniswap-gov", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 700000, active: true },
      { id: 5, question: "Will total DEX volume hit $500B monthly?", sourceRef: "dune", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
      { id: 6, question: "Will a new stablecoin enter top 5 by mcap?", sourceRef: "coingecko", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 250000, active: true },
    ],
  },
  {
    id: "nft-culture",
    title: "NFT & Culture",
    description: "Culture and community predictions",
    category: "nft",
    legs: [
      { id: 7, question: "Will an onchain game hit 100K DAU?", sourceRef: "dappradar", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 300000, active: true },
      { id: 8, question: "Will NFT trading volume recover to $2B monthly?", sourceRef: "nftgo", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 200000, active: true },
      { id: 9, question: "Will a DAO acquire a real-world asset over $10M?", sourceRef: "dao-news", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 150000, active: true },
    ],
  },
];
