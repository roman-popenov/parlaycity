import { Router } from "express";
import {
  parseAgentQuoteRequest,
  parseUSDC,
  computeQuote,
} from "@parlaycity/shared";
import type { AgentQuoteResponse, AiInsight } from "@parlaycity/shared";
import { getFullLegMap } from "../catalog/registry.js";
import { computeRiskAssessment } from "../risk/compute.js";
import { runZGInference, buildRiskPrompt } from "./0g-inference.js";

const router = Router();

/**
 * POST /premium/agent-quote
 * x402-gated endpoint that combines quote + risk assessment in one call.
 * Resolves leg probabilities from the catalog so agents don't need to know them.
 */
router.post("/agent-quote", async (req, res) => {
  const parsed = parseAgentQuoteRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds, outcomes, stake, bankroll, riskTolerance } = parsed.data;
  const legMap = await getFullLegMap();

  // Validate all legs exist and are active, collect probabilities + categories
  const probabilities: number[] = [];
  const categories: string[] = [];
  for (const legId of legIds) {
    const leg = legMap.get(legId);
    if (!leg) {
      return res.status(400).json({ error: `Leg ${legId} not found` });
    }
    if (!leg.active) {
      return res.status(400).json({ error: `Leg ${legId} is not active` });
    }
    probabilities.push(leg.probabilityPPM);
    categories.push(leg.category);
  }

  // Check for duplicate legs
  if (new Set(legIds).size !== legIds.length) {
    return res.status(400).json({ error: "Duplicate leg IDs not allowed" });
  }

  // --- Quote ---
  const stakeRaw = parseUSDC(stake);
  const quote = computeQuote(probabilities, stakeRaw, legIds, outcomes);

  // --- Risk Assessment (shared with /premium/risk-assess) ---
  const result = computeRiskAssessment({ stake, bankroll, riskTolerance, probabilities, categories });
  const risk = result.data;

  // --- 0G AI Insight (best-effort, 5s timeout) ---
  let aiInsight: AiInsight | undefined;
  try {
    const prompt = buildRiskPrompt({
      legIds,
      outcomes,
      winProbability: risk.winProbability,
      kellyFraction: risk.kellyFraction,
      expectedValue: risk.expectedValue,
      fairMultiplier: risk.fairMultiplier,
      netMultiplier: risk.netMultiplier,
      edgeBps: risk.edgeBps,
      warnings: risk.warnings,
      action: risk.action,
      riskTolerance,
      stake,
    });

    let timeoutId: ReturnType<typeof setTimeout>;
    const inference = await Promise.race([
      runZGInference(prompt),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 5_000);
      }),
    ]);
    clearTimeout(timeoutId!);

    if (inference) {
      aiInsight = {
        analysis: inference.content,
        model: inference.model,
        provider: inference.provider,
        verified: inference.verified,
      };
    }
  } catch (e) {
    console.warn("[agent-quote] AI insight failed:", (e as Error).message);
  }

  const response: AgentQuoteResponse = { quote, risk, ...(aiInsight && { aiInsight }) };
  return res.json(response);
});

export default router;
