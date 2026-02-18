import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("GET /vault/health", () => {
  it("returns 200 with vault health data", async () => {
    const res = await request(app).get("/vault/health");
    expect(res.status).toBe(200);
    expect(["HEALTHY", "CAUTION", "CRITICAL"]).toContain(res.body.vaultHealth);
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
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(first.warning);
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
    expect(["ROTATE", "HOLD"]).toContain(res.body.recommendation.action);
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
  });
});
