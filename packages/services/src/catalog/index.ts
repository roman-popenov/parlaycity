import { Router } from "express";
import { SEED_MARKETS } from "./seed.js";

const router = Router();

/** GET /markets - list all markets */
router.get("/", (_req, res) => {
  res.json(SEED_MARKETS);
});

/** GET /markets/:id - get a single market */
router.get("/:id", (req, res) => {
  const market = SEED_MARKETS.find((m) => m.id === req.params.id);
  if (!market) {
    return res.status(404).json({ error: "Market not found" });
  }
  return res.json(market);
});

export default router;
