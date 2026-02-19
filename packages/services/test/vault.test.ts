import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";
import { VaultHealth, ConcentrationWarning, YieldAction } from "@parlaycity/shared";

describe("GET /vault/health", () => {
  it("returns 200 with vault health data", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(Object.values(VaultHealth)).toContain(res.body.vaultHealth);
    expect(res.body.totalAssets).toBeTypeOf("string");
    expect(res.body.totalReserved).toBeTypeOf("string");
    expect(res.body.freeLiquidity).toBeTypeOf("string");
    expect(res.body.utilization).toBeTypeOf("number");
    expect(res.body.utilizationBps).toBeTypeOf("number");
    expect(res.body.activeTickets).toBeTypeOf("number");
  });

  it("returns concentration risk array", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(res.body.concentrationRisk).toBeInstanceOf(Array);
    expect(res.body.concentrationRisk.length).toBeGreaterThan(0);
    const first = res.body.concentrationRisk[0];
    expect(first).toHaveProperty("legId");
    expect(first).toHaveProperty("exposure");
    expect(first).toHaveProperty("pctOfTVL");
    expect(first).toHaveProperty("warning");
    expect(Object.values(ConcentrationWarning)).toContain(first.warning);
  });

  it("returns settlement cluster data", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(res.body.settlementCluster).toHaveProperty("next24h");
    expect(res.body.settlementCluster).toHaveProperty("totalExposure");
    expect(res.body.settlementCluster).toHaveProperty("liquiditySufficient");
    expect(res.body.settlementCluster.liquiditySufficient).toBeTypeOf("boolean");
  });

  it("returns recommendations array", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toBeInstanceOf(Array);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });

  it("concentration risk is sorted by exposure descending", async () => {
    const res = await request(app).get("/vault/health");
    const risks = res.body.concentrationRisk;
    for (let i = 1; i < risks.length; i++) {
      expect(risks[i - 1].pctOfTVL).toBeGreaterThanOrEqual(risks[i].pctOfTVL);
    }
  });

  it("returns timestamp as a finite number", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeTypeOf("number");
    expect(Number.isFinite(res.body.timestamp)).toBe(true);
  });

  it("all numeric fields are finite (no NaN/Infinity)", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(Number.isFinite(res.body.utilization)).toBe(true);
    expect(Number.isFinite(res.body.utilizationBps)).toBe(true);
    expect(Number.isFinite(res.body.activeTickets)).toBe(true);
    expect(Number.isFinite(res.body.timestamp)).toBe(true);
    expect(Number.isFinite(res.body.settlementCluster.next24h)).toBe(true);
  });

  it("concentration risk entries have finite pctOfTVL", async () => {
    const res = await request(app).get("/vault/health");
    for (const entry of res.body.concentrationRisk) {
      expect(Number.isFinite(entry.pctOfTVL)).toBe(true);
      expect(entry.pctOfTVL).toBeGreaterThanOrEqual(0);
      expect(entry.pctOfTVL).toBeLessThanOrEqual(1);
    }
  });

  it("vaultHealth is HEALTHY for mock data (37% utilization)", async () => {
    // Mock: 18,500 / 50,000 = 37% utilization => HEALTHY (<=50%)
    const res = await request(app).get("/vault/health");
    expect(res.body.vaultHealth).toBe(VaultHealth.HEALTHY);
  });

  it("utilization matches expected value from mock data", async () => {
    // 18,500,000,000 / 50,000,000,000 = 0.37
    const res = await request(app).get("/vault/health");
    expect(res.body.utilization).toBeCloseTo(0.37, 2);
    expect(res.body.utilizationBps).toBe(3700);
  });

  it("freeLiquidity = totalAssets - totalReserved", async () => {
    const res = await request(app).get("/vault/health");
    // 50,000 - 18,500 = 31,500
    expect(res.body.freeLiquidity).toBe("31500");
  });

  it("concentration risk includes all warning levels", async () => {
    const res = await request(app).get("/vault/health");
    const warnings = res.body.concentrationRisk.map((c: { warning: string }) => c.warning);
    // With mock data: leg 1 = 8.4% (HIGH), leg 2 = 6.2% (HIGH), leg 3 = 5.6% (HIGH),
    // leg 4 = 3% (MEDIUM would be >3% and <=5%), leg 5 = 1.8% (LOW)
    expect(warnings).toContain(ConcentrationWarning.HIGH);
    expect(warnings).toContain(ConcentrationWarning.LOW);
  });

  it("recommendations include utilization advice for mock data", async () => {
    const res = await request(app).get("/vault/health");
    // 37% utilization < 40% triggers "consider deploying idle USDC to yield"
    const yieldRec = res.body.recommendations.find((r: string) => r.includes("yield"));
    expect(yieldRec).toBeDefined();
  });

  it("recommendations include concentration warning for mock data", async () => {
    const res = await request(app).get("/vault/health");
    const concRec = res.body.recommendations.find((r: string) => r.includes("concentration"));
    expect(concRec).toBeDefined();
  });

  it("settlementCluster.liquiditySufficient is true for mock data", async () => {
    const res = await request(app).get("/vault/health");
    // freeLiquidity = 31,500 USDC >= next24hExposure = 8,500 USDC
    expect(res.body.settlementCluster.liquiditySufficient).toBe(true);
  });
});

describe("GET /vault/yield-report", () => {
  it("returns 200 with yield report", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.status).toBe(200);
    expect(res.body.protocols).toBeInstanceOf(Array);
    expect(res.body.protocols.length).toBeGreaterThan(0);
  });

  it("returns protocol details", async () => {
    const res = await request(app).get("/vault/yield-report");
    const proto = res.body.protocols[0];
    expect(proto).toHaveProperty("name");
    expect(proto).toHaveProperty("apy");
    expect(proto).toHaveProperty("tvl");
    expect(proto).toHaveProperty("riskScore");
  });

  it("returns current strategy", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.currentStrategy).toHaveProperty("protocol");
    expect(res.body.currentStrategy).toHaveProperty("apy");
    expect(res.body.currentStrategy).toHaveProperty("deployed");
    expect(res.body.currentStrategy).toHaveProperty("idle");
  });

  it("returns yield recommendation", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.recommendation).toHaveProperty("action");
    expect(Object.values(YieldAction)).toContain(res.body.recommendation.action);
    expect(res.body.recommendation).toHaveProperty("targetProtocol");
    expect(res.body.recommendation).toHaveProperty("targetApy");
    expect(res.body.recommendation).toHaveProperty("reasoning");
    expect(res.body.recommendation.reasoning).toBeTypeOf("string");
  });

  it("includes projected improvement", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.recommendation).toHaveProperty("projectedAnnualImprovement");
    expect(res.body.recommendation.projectedAnnualImprovement).toBeTypeOf("number");
  });

  it("returns timestamp", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.timestamp).toBeTypeOf("number");
    expect(Number.isFinite(res.body.timestamp)).toBe(true);
  });

  it("yield recommendation is ROTATE for mock data (Aerodrome > Aave by >50bps)", async () => {
    // Aerodrome 7.12% vs Aave 4.82% = 2.3% improvement > 0.5%
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.recommendation.action).toBe(YieldAction.ROTATE);
  });

  it("projected improvement is a positive finite number", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(Number.isFinite(res.body.recommendation.projectedAnnualImprovement)).toBe(true);
    expect(res.body.recommendation.projectedAnnualImprovement).toBeGreaterThan(0);
  });

  it("protocols are sorted by APY in recommendation reasoning", async () => {
    const res = await request(app).get("/vault/yield-report");
    // Target protocol should be highest APY
    const sortedByApy = [...res.body.protocols].sort(
      (a: { apy: number }, b: { apy: number }) => b.apy - a.apy,
    );
    expect(res.body.recommendation.targetProtocol).toBe(sortedByApy[0].name);
    expect(res.body.recommendation.targetApy).toBe(sortedByApy[0].apy);
  });

  it("all protocol entries have required fields", async () => {
    const res = await request(app).get("/vault/yield-report");
    for (const proto of res.body.protocols) {
      expect(proto.name).toBeTypeOf("string");
      expect(Number.isFinite(proto.apy)).toBe(true);
      expect(proto.apy).toBeGreaterThan(0);
      expect(proto.tvl).toBeTypeOf("string");
      expect(proto.riskScore).toBeTypeOf("string");
      expect(proto.protocol).toBeTypeOf("string");
    }
  });

  it("currentStrategy APY matches first protocol", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.currentStrategy.apy).toBe(res.body.protocols[0].apy);
    expect(res.body.currentStrategy.protocol).toBe(res.body.protocols[0].name);
  });

  it("all numeric response fields are finite", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(Number.isFinite(res.body.currentStrategy.apy)).toBe(true);
    expect(Number.isFinite(res.body.recommendation.targetApy)).toBe(true);
    expect(Number.isFinite(res.body.recommendation.projectedAnnualImprovement)).toBe(true);
    expect(Number.isFinite(res.body.timestamp)).toBe(true);
  });

  it("recommendation reasoning is a non-empty string", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(res.body.recommendation.reasoning).toBeTypeOf("string");
    expect(res.body.recommendation.reasoning.length).toBeGreaterThan(0);
  });
});
