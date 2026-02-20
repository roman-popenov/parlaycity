import { Router } from "express";
import { getAllMarkets, getCategoryInfo, MARKET_CATEGORIES } from "./registry.js";

const router = Router();

/**
 * GET /markets - list all markets, optionally filtered by category.
 * Query params:
 *   ?category=nba,crypto  -- comma-separated category filter
 */
router.get("/", async (req, res) => {
  const categoryParam = req.query.category;
  let categories: string[] | undefined;

  if (typeof categoryParam === "string" && categoryParam.trim()) {
    categories = categoryParam.split(",").map((c) => c.trim().toLowerCase());
  }

  const markets = await getAllMarkets(categories);
  res.json(markets);
});

/**
 * GET /markets/categories - list available categories with counts.
 */
router.get("/categories", async (_req, res) => {
  const info = await getCategoryInfo();
  res.json({
    available: MARKET_CATEGORIES,
    categories: info,
  });
});

/**
 * GET /markets/:id - get a single market by ID.
 */
router.get("/:id", async (req, res) => {
  const markets = await getAllMarkets();
  const market = markets.find((m) => m.id === req.params.id);
  if (!market) {
    return res.status(404).json({ error: "Market not found" });
  }
  return res.json(market);
});

export default router;
