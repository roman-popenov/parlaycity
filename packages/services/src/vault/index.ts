import { Router } from "express";

const router = Router();

// Mock vault state (in production, these would read from on-chain)
const MOCK_VAULT = {
  totalAssets: 50_000_000_000n, // 50,000 USDC (6 decimals)
  totalReserved: 18_500_000_000n, // 18,500 USDC
  totalShares: 48_000_000_000n,
  activeTickets: 42,
};

// Mock per-leg exposure
const MOCK_LEG_EXPOSURE: Record<number, { exposure: bigint; ticketCount: number; category: string }> = {
  1: { exposure: 4_200_000_000n, ticketCount: 12, category: "NBA" },
  2: { exposure: 3_100_000_000n, ticketCount: 8, category: "NFL" },
  3: { exposure: 2_800_000_000n, ticketCount: 15, category: "NBA" },
  4: { exposure: 1_500_000_000n, ticketCount: 5, category: "Crypto" },
  5: { exposure: 900_000_000n, ticketCount: 3, category: "ETHDenver" },
};

// Mock yield protocols
const MOCK_YIELDS = [
  { name: "Aave V3 (Base)", apy: 4.82, tvl: "1.2B", riskScore: "A", protocol: "aave-v3" },
  { name: "Morpho (Base)", apy: 5.41, tvl: "380M", riskScore: "A-", protocol: "morpho" },
  { name: "Compound V3 (Base)", apy: 3.95, tvl: "890M", riskScore: "A+", protocol: "compound-v3" },
  { name: "Aerodrome USDC/USDbC", apy: 7.12, tvl: "45M", riskScore: "B+", protocol: "aerodrome" },
];

function formatUSDC(raw: bigint): string {
  const divisor = 1_000_000n;
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * GET /vault/health
 * Vault Guardian: health assessment, concentration risk, settlement clustering
 */
router.get("/health", (_req, res) => {
  const totalAssets = MOCK_VAULT.totalAssets;
  const totalReserved = MOCK_VAULT.totalReserved;
  const freeLiquidity = totalAssets - totalReserved;
  const utilizationBps = Number((totalReserved * 10_000n) / totalAssets);
  const utilization = utilizationBps / 10_000;

  // Health status based on utilization
  let vaultHealth: "HEALTHY" | "CAUTION" | "CRITICAL";
  if (utilizationBps <= 5000) vaultHealth = "HEALTHY";
  else if (utilizationBps <= 7500) vaultHealth = "CAUTION";
  else vaultHealth = "CRITICAL";

  // Concentration risk: flag any leg > 5% of TVL
  const concentrationRisk = Object.entries(MOCK_LEG_EXPOSURE)
    .map(([legId, data]) => {
      const pctOfTVL = Number((data.exposure * 10_000n) / totalAssets) / 10_000;
      return {
        legId: parseInt(legId),
        exposure: formatUSDC(data.exposure),
        ticketCount: data.ticketCount,
        category: data.category,
        pctOfTVL: Math.round(pctOfTVL * 10_000) / 10_000,
        warning: pctOfTVL > 0.05 ? "HIGH" as const : pctOfTVL > 0.03 ? "MEDIUM" as const : "LOW" as const,
      };
    })
    .sort((a, b) => b.pctOfTVL - a.pctOfTVL);

  // Settlement cluster (mock: next 24h)
  const next24hSettlements = 12;
  const next24hExposure = 8_500_000_000n;
  const liquiditySufficient = freeLiquidity > next24hExposure;

  // Recommendations
  const recommendations: string[] = [];
  const highConcentration = concentrationRisk.filter(c => c.warning === "HIGH");
  if (highConcentration.length > 0) {
    const categories = [...new Set(highConcentration.map(c => c.category))];
    recommendations.push(`Increase edge by 50bps for legs in ${categories.join(", ")} (high concentration)`);
  }
  if (utilization < 0.4) {
    recommendations.push(`Utilization at ${(utilization * 100).toFixed(1)}% — consider deploying idle USDC to yield`);
  }
  if (utilizationBps > 7000) {
    recommendations.push("Utilization approaching cap — consider increasing fees or pausing new tickets");
  }
  if (liquiditySufficient && utilization < 0.5) {
    recommendations.push("Settlement cluster is manageable — safe to deploy excess to yield");
  }

  return res.json({
    vaultHealth,
    totalAssets: formatUSDC(totalAssets),
    totalReserved: formatUSDC(totalReserved),
    freeLiquidity: formatUSDC(freeLiquidity),
    utilization: Math.round(utilization * 10_000) / 10_000,
    utilizationBps,
    activeTickets: MOCK_VAULT.activeTickets,
    concentrationRisk,
    settlementCluster: {
      next24h: next24hSettlements,
      totalExposure: formatUSDC(next24hExposure),
      liquiditySufficient,
    },
    recommendations,
    timestamp: Date.now(),
  });
});

/**
 * GET /vault/yield-report
 * Yield Optimizer: rate comparison across DeFi protocols
 */
router.get("/yield-report", (_req, res) => {
  // Current strategy (mock)
  const currentProtocol = MOCK_YIELDS[0]; // Aave V3
  const idleUSDC = 15_000_000_000n; // 15,000 USDC idle
  const deployedUSDC = 5_000_000_000n; // 5,000 USDC deployed

  // Find optimal
  const sorted = [...MOCK_YIELDS].sort((a, b) => b.apy - a.apy);
  const optimal = sorted[0];
  const currentApy = currentProtocol.apy;
  const optimalApy = optimal.apy;
  const improvement = optimalApy - currentApy;

  // Projected annual yield improvement on idle capital
  const idleNum = Number(idleUSDC) / 1_000_000;
  const projectedImprovement = Math.round(idleNum * (improvement / 100) * 100) / 100;

  return res.json({
    protocols: MOCK_YIELDS,
    currentStrategy: {
      protocol: currentProtocol.name,
      apy: currentApy,
      deployed: formatUSDC(deployedUSDC),
      idle: formatUSDC(idleUSDC),
    },
    recommendation: {
      action: improvement > 0.5 ? "ROTATE" : "HOLD",
      targetProtocol: optimal.name,
      targetApy: optimalApy,
      reasoning: improvement > 0.5
        ? `${optimal.name} offers ${optimalApy}% APY vs current ${currentApy}%. Rotating ${formatUSDC(idleUSDC)} USDC would yield ~$${projectedImprovement}/year more.`
        : `Current strategy is within 50bps of optimal. Hold position.`,
      projectedAnnualImprovement: projectedImprovement,
    },
    timestamp: Date.now(),
  });
});

export default router;
