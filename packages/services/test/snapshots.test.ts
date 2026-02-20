/**
 * API Response Shape Snapshots -- captures the type skeleton of each route.
 * Field additions, removals, or type changes fail the snapshot.
 *
 * Regenerate baselines: pnpm test -- --update
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

/**
 * Recursively convert values to their typeof string.
 * Arrays: take the shape of the first element (or "empty-array").
 * Dynamic timestamps/dates replaced with "<DYNAMIC>".
 */
function shapeOf(value: unknown): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "empty-array";
    return [shapeOf(value[0])];
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = shapeOf(v);
    }
    return result;
  }
  return typeof value;
}

/** Replace dynamic fields that change between runs. */
function stabilize(body: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(body));
  if ("timestamp" in copy) copy.timestamp = "<DYNAMIC>";
  if (copy.settlementCluster?.totalExposure !== undefined) {
    // nested objects are fine, just stabilize root timestamps
  }
  return copy;
}

// ── Snapshot cases ────────────────────────────────────────────────────────────

describe("Shape snapshots", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(shapeOf(stabilize(res.body))).toMatchSnapshot();
  });

  it("GET /markets (first item)", async () => {
    const res = await request(app).get("/markets");
    const first = res.body[0];
    expect(shapeOf(first)).toMatchSnapshot();
  });

  it("GET /markets/categories", async () => {
    const res = await request(app).get("/markets/categories");
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("GET /markets/ethdenver-2026", async () => {
    const res = await request(app).get("/markets/ethdenver-2026");
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("POST /quote (valid)", async () => {
    const res = await request(app)
      .post("/quote")
      .send({ legIds: [1, 2], outcomes: ["Yes", "Yes"], stake: "10" });
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("GET /exposure", async () => {
    const res = await request(app).get("/exposure");
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("POST /premium/sim (paid)", async () => {
    const res = await request(app)
      .post("/premium/sim")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        probabilities: [600_000, 450_000],
      });
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("POST /premium/risk-assess (paid)", async () => {
    const res = await request(app)
      .post("/premium/risk-assess")
      .set("x-402-payment", "demo-token")
      .send({
        stake: "10",
        probabilities: [600_000, 450_000],
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("POST /premium/agent-quote (paid)", async () => {
    const res = await request(app)
      .post("/premium/agent-quote")
      .set("x-402-payment", "demo-token")
      .send({
        legIds: [1, 2],
        outcomes: ["Yes", "Yes"],
        stake: "10",
        bankroll: "1000",
        riskTolerance: "moderate",
      });
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it("GET /vault/health", async () => {
    const res = await request(app).get("/vault/health");
    expect(shapeOf(stabilize(res.body))).toMatchSnapshot();
  });

  it("GET /vault/yield-report", async () => {
    const res = await request(app).get("/vault/yield-report");
    expect(shapeOf(stabilize(res.body))).toMatchSnapshot();
  });
});
