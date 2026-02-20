/**
 * Mock data for development when contracts aren't deployed.
 * Lets us build and demo the UI without on-chain calls.
 */

export interface MockLeg {
  id: bigint;
  description: string;
  odds: number; // decimal multiplier, e.g. 2.0
  resolved: boolean;
  outcome: number; // 0 = unresolved, 1 = yes, 2 = no
  expiresAt: number;
}

// Matches on-chain legs created by Deploy.s.sol (0-indexed)
// Odds derived from probabilityPPM: odds = 1_000_000 / probabilityPPM
export const MOCK_LEGS: MockLeg[] = [
  {
    id: 0n,
    description: "Will ETH hit $5000 by end of March?",
    odds: 2.50, // ~400,000 PPM
    resolved: false,
    outcome: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  },
  {
    id: 1n,
    description: "Will BTC hit $150k by end of March?",
    odds: 2.86, // ~350,000 PPM
    resolved: false,
    outcome: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  },
  {
    id: 2n,
    description: "Will SOL hit $300 by end of March?",
    odds: 2.86, // ~350,000 PPM
    resolved: false,
    outcome: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  },
];

export const MOCK_VAULT_STATS = {
  totalAssets: 500_000n * 10n ** 6n, // 500k USDC
  totalReserved: 125_000n * 10n ** 6n, // 125k USDC
  maxUtilBps: 7000n, // 70%
  utilization: 25, // 25%
};
