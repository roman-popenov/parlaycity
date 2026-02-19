import { describe, it, expect } from "vitest";
import { computeRiskAssessment, RISK_CAPS } from "../src/risk/compute.js";
import { RiskAction } from "@parlaycity/shared";

describe("computeRiskAssessment", () => {
  const baseInput = {
    stake: "10",
    bankroll: "100",
    riskTolerance: "moderate" as const,
    probabilities: [600_000, 450_000],
  };

  it("returns ok: true for valid input", () => {
    const result = computeRiskAssessment(baseInput);
    expect(result.ok).toBe(true);
    expect(Object.values(RiskAction)).toContain(result.data.action);
  });

  it("returns ok: false with AVOID for invalid probabilities (zero)", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      probabilities: [0, 450_000],
    });
    expect(result.ok).toBe(false);
    expect(result.data.action).toBe(RiskAction.AVOID);
    expect(result.data.warnings).toContain("Invalid probability from catalog data");
  });

  it("returns ok: false with AVOID for probabilities > PPM", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      probabilities: [1_000_001, 450_000],
    });
    expect(result.ok).toBe(false);
    expect(result.data.action).toBe(RiskAction.AVOID);
    expect(result.data.warnings).toContain("Invalid probability from catalog data");
  });

  it("returns ok: false with AVOID for negative probabilities", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      probabilities: [-1, 450_000],
    });
    expect(result.ok).toBe(false);
    expect(result.data.action).toBe(RiskAction.AVOID);
  });

  it("detects correlated categories", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      categories: ["crypto", "crypto"],
    });
    expect(result.ok).toBe(true);
    expect(result.data.warnings.some(w => w.includes("correlated"))).toBe(true);
  });

  it("no correlation warning for distinct categories", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      categories: ["crypto", "defi"],
    });
    expect(result.ok).toBe(true);
    expect(result.data.warnings.every(w => !w.includes("correlated"))).toBe(true);
  });

  it("caps kelly by risk profile", () => {
    const result = computeRiskAssessment({
      ...baseInput,
      riskTolerance: "conservative",
    });
    expect(result.ok).toBe(true);
    expect(result.data.kellyFraction).toBeLessThanOrEqual(RISK_CAPS.conservative.maxKelly);
  });

  it("AVOID when too many legs for conservative", () => {
    const result = computeRiskAssessment({
      stake: "10",
      bankroll: "100",
      riskTolerance: "conservative",
      probabilities: [600_000, 450_000, 500_000, 400_000],
    });
    expect(result.data.action).toBe(RiskAction.AVOID);
    expect(result.data.warnings.some(w => w.includes("max 3 legs"))).toBe(true);
  });

  it("preserves riskTolerance in response", () => {
    const result = computeRiskAssessment(baseInput);
    expect(result.data.riskTolerance).toBe("moderate");
  });

  it("no NaN or Infinity in numeric fields", () => {
    const result = computeRiskAssessment(baseInput);
    const d = result.data;
    for (const val of [d.kellyFraction, d.winProbability, d.expectedValue, d.confidence, d.fairMultiplier, d.netMultiplier]) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });
});
