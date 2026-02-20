import { Router } from "express";
import {
  parseQuoteRequest,
  parseUSDC,
  computeQuote,
} from "@parlaycity/shared";
import { getSeedLegMap } from "../catalog/registry.js";

const router = Router();

/** POST /quote - compute a parlay quote */
router.post("/", (req, res) => {
  const parsed = parseQuoteRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { legIds, outcomes, stake } = parsed.data;
  const legMap = getSeedLegMap();

  // Validate all legs exist and are active
  const probabilities: number[] = [];
  for (const legId of legIds) {
    const leg = legMap.get(legId);
    if (!leg) {
      return res.status(400).json({ error: `Leg ${legId} not found` });
    }
    if (!leg.active) {
      return res.status(400).json({ error: `Leg ${legId} is not active` });
    }
    probabilities.push(leg.probabilityPPM);
  }

  // Check for duplicate legs
  if (new Set(legIds).size !== legIds.length) {
    return res.status(400).json({ error: "Duplicate leg IDs not allowed" });
  }

  const stakeRaw = parseUSDC(stake);
  const quote = computeQuote(probabilities, stakeRaw, legIds, outcomes);

  return res.json(quote);
});

export default router;
