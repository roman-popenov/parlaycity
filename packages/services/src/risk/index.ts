import { Router } from "express";
import { parseRiskAssessRequest } from "@parlaycity/shared";
import type { RiskAssessResponse } from "@parlaycity/shared";
import { computeRiskAssessment } from "./compute.js";

const router = Router();

router.post("/risk-assess", (req, res) => {
  const parsed = parseRiskAssessRequest(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { stake, probabilities, bankroll, riskTolerance, categories } = parsed.data;
  const result = computeRiskAssessment({ stake, bankroll, riskTolerance, probabilities, categories });

  return res.json(result.data satisfies RiskAssessResponse);
});

export default router;
