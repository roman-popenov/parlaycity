import { Router } from "express";
import {
  parseAgentQuoteRequest,
  parseUSDC,
  computeQuote,
} from "@parlaycity/shared";
import type { AgentQuoteResponse } from "@parlaycity/shared";
import { SEED_MARKETS } from "../catalog/seed.js";
import { computeRiskAssessment } from "../risk/compute.js";

const router = Router();

function getLegMap() {
  const map = new Map<number, { probabilityPPM: number; active: boolean; category: string }>();
  for (const market of SEED_MARKETS) {
    for (const leg of market.legs) {
      map.set(leg.id, { probabilityPPM: leg.probabilityPPM, active: leg.active, category: market.category });
    }
  }
  return map;
}

/**
 * POST /premium/agent-quote
 * x402-gated endpoint that combines quote + risk assessment in one call.
 * Resolves leg probabilities from the catalog so agents don't need to know them.
 */
router.post("/agent-quote", (req, res) => {
  const parsed = parseAgentQuoteRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds, outcomes, stake, bankroll, riskTolerance } = parsed.data;
  const legMap = getLegMap();

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

  return res.json({ quote, risk: result.data } satisfies AgentQuoteResponse);
});

export default router;
