import type { Market } from "@parlaycity/shared";

/**
 * All known market categories.
 * NBA is dynamic (BDL), everything else is seeded here.
 */
export const MARKET_CATEGORIES = [
  "crypto",
  "defi",
  "nft",
  "policy",
  "economics",
  "trivia",
  "ethdenver",
  "nba",
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

/**
 * Static seed markets. IDs 1-9 are stable (used by existing tests).
 * New categories start at ID 10+.
 */
export const SEED_MARKETS: Market[] = [
  // ── Crypto (IDs 1-3) ──────────────────────────────────────────────────
  {
    id: "ethdenver-2026",
    title: "ETHDenver 2026 Predictions",
    description: "Will these things happen at ETHDenver?",
    category: "crypto",
    legs: [
      { id: 1, question: "Will ETH be above $3000 by March 1?", sourceRef: "price-feed", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 550000, active: true },
      { id: 2, question: "Will Base TVL exceed $15B?", sourceRef: "defillama", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 500000, active: true },
      { id: 3, question: "Will Vitalik attend ETHDenver?", sourceRef: "social", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 450000, active: true },
    ],
  },
  // ── DeFi (IDs 4-6) ────────────────────────────────────────────────────
  {
    id: "defi-markets",
    title: "DeFi Market Moves",
    description: "Predict the next big DeFi moves",
    category: "defi",
    legs: [
      { id: 4, question: "Will Uniswap v4 launch on Base?", sourceRef: "uniswap-gov", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 600000, active: true },
      { id: 5, question: "Will total DEX volume hit $500B monthly?", sourceRef: "dune", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 450000, active: true },
      { id: 6, question: "Will a new stablecoin enter top 5 by mcap?", sourceRef: "coingecko", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
    ],
  },
  // ── NFT & Culture (IDs 7-9) ───────────────────────────────────────────
  {
    id: "nft-culture",
    title: "NFT & Culture",
    description: "Culture and community predictions",
    category: "nft",
    legs: [
      { id: 7, question: "Will an onchain game hit 100K DAU?", sourceRef: "dappradar", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
      { id: 8, question: "Will NFT trading volume recover to $2B monthly?", sourceRef: "nftgo", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 350000, active: true },
      { id: 9, question: "Will a DAO acquire a real-world asset over $10M?", sourceRef: "dao-news", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 400000, active: true },
    ],
  },
  // ── Policy (IDs 10-12) ────────────────────────────────────────────────
  {
    id: "us-policy-2026",
    title: "US Policy & Regulation",
    description: "Crypto regulation and policy predictions",
    category: "policy",
    legs: [
      { id: 10, question: "Will a US stablecoin bill pass by June 2026?", sourceRef: "congress-gov", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 500000, active: true },
      { id: 11, question: "Will the SEC approve a spot SOL ETF by Q3 2026?", sourceRef: "sec-filings", cutoffTime: 1759276800, earliestResolve: 1759363200, probabilityPPM: 400000, active: true },
      { id: 12, question: "Will the US create a strategic Bitcoin reserve?", sourceRef: "executive-orders", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 350000, active: true },
    ],
  },
  // ── Economics (IDs 13-15) ─────────────────────────────────────────────
  {
    id: "macro-economics",
    title: "Macro & Markets",
    description: "Economic predictions and market moves",
    category: "economics",
    legs: [
      { id: 13, question: "Will the Fed cut rates before June 2026?", sourceRef: "fed-minutes", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 550000, active: true },
      { id: 14, question: "Will S&P 500 hit 7000 by end of 2026?", sourceRef: "yahoo-finance", cutoffTime: 1767139200, earliestResolve: 1767225600, probabilityPPM: 450000, active: true },
      { id: 15, question: "Will global crypto market cap exceed $5T?", sourceRef: "coingecko", cutoffTime: 1767139200, earliestResolve: 1767225600, probabilityPPM: 450000, active: true },
    ],
  },
  // ── Trivia (IDs 16-18) ────────────────────────────────────────────────
  {
    id: "crypto-trivia",
    title: "Crypto Trivia & Fun",
    description: "Fun predictions for the crypto space",
    category: "trivia",
    legs: [
      { id: 16, question: "Will a memecoin enter the top 10 by market cap?", sourceRef: "coingecko", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 400000, active: true },
      { id: 17, question: "Will Elon Musk tweet about Dogecoin this week?", sourceRef: "twitter-api", cutoffTime: 1740000000, earliestResolve: 1740100000, probabilityPPM: 650000, active: true },
      { id: 18, question: "Will a crypto project raise $1B+ in a single round?", sourceRef: "crunchbase", cutoffTime: 1751328000, earliestResolve: 1751414400, probabilityPPM: 350000, active: true },
    ],
  },
  // ── ETHDenver (IDs 19-21) ─────────────────────────────────────────────
  {
    id: "ethdenver-special",
    title: "ETHDenver Specials",
    description: "Predictions specific to ETHDenver 2026",
    category: "ethdenver",
    legs: [
      { id: 19, question: "Will over 20,000 people attend ETHDenver?", sourceRef: "ethdenver-org", cutoffTime: 1740700000, earliestResolve: 1740800000, probabilityPPM: 550000, active: true },
      { id: 20, question: "Will a hackathon project get acquired within 30 days?", sourceRef: "twitter-api", cutoffTime: 1743379200, earliestResolve: 1743465600, probabilityPPM: 350000, active: true },
      { id: 21, question: "Will ParlayCity win a bounty at ETHDenver?", sourceRef: "ethdenver-org", cutoffTime: 1740700000, earliestResolve: 1740800000, probabilityPPM: 600000, active: true },
    ],
  },
];
