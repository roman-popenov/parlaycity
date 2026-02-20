/**
 * Unified market registry that combines static seed markets with dynamic
 * data sources (BDL for NBA). Single source of truth for all route handlers.
 */
import type { Market } from "@parlaycity/shared";
import { SEED_MARKETS, MARKET_CATEGORIES } from "./seed.js";
import { fetchNBAMarkets, isBDLEnabled } from "./bdl.js";

export { MARKET_CATEGORIES };

export interface LegInfo {
  probabilityPPM: number;
  active: boolean;
  category: string;
}

/**
 * Get all markets, optionally filtered by category.
 * Includes seed markets + dynamically fetched NBA markets.
 */
export async function getAllMarkets(categories?: string[]): Promise<Market[]> {
  let markets = [...SEED_MARKETS];

  // Add NBA markets from BDL if available
  if (isBDLEnabled()) {
    try {
      const nba = await fetchNBAMarkets();
      markets = [...markets, ...nba];
    } catch (e) {
      console.warn("[registry] BDL fetch failed:", (e as Error).message);
    }
  }

  // Filter by category if specified
  if (categories && categories.length > 0) {
    const catSet = new Set(categories.map((c) => c.toLowerCase()));
    markets = markets.filter((m) => catSet.has(m.category.toLowerCase()));
  }

  return markets;
}

/**
 * Get all markets synchronously (seed only, no BDL).
 * Used by endpoints that need immediate access without async.
 */
export function getSeedMarkets(): Market[] {
  return SEED_MARKETS;
}

/**
 * Build a leg lookup map from all seed markets.
 * This is synchronous and always includes all seed legs.
 * For NBA legs, callers should use getAllMarkets() and build their own map.
 */
export function getSeedLegMap(): Map<number, LegInfo> {
  const map = new Map<number, LegInfo>();
  for (const market of SEED_MARKETS) {
    for (const leg of market.legs) {
      map.set(leg.id, {
        probabilityPPM: leg.probabilityPPM,
        active: leg.active,
        category: market.category,
      });
    }
  }
  return map;
}

/**
 * Build a leg lookup map from all available markets (seed + BDL).
 * Async because NBA data may need fetching.
 */
export async function getFullLegMap(): Promise<Map<number, LegInfo>> {
  const markets = await getAllMarkets();
  const map = new Map<number, LegInfo>();
  for (const market of markets) {
    for (const leg of market.legs) {
      map.set(leg.id, {
        probabilityPPM: leg.probabilityPPM,
        active: leg.active,
        category: market.category,
      });
    }
  }
  return map;
}

/**
 * Get available categories with their market counts.
 */
export async function getCategoryInfo(): Promise<Array<{ category: string; marketCount: number; legCount: number; source: string }>> {
  const markets = await getAllMarkets();
  const catMap = new Map<string, { marketCount: number; legCount: number }>();

  for (const market of markets) {
    const existing = catMap.get(market.category) ?? { marketCount: 0, legCount: 0 };
    existing.marketCount++;
    existing.legCount += market.legs.length;
    catMap.set(market.category, existing);
  }

  return [...catMap.entries()].map(([category, counts]) => ({
    category,
    ...counts,
    source: category === "nba" ? "balldontlie" : "seed",
  }));
}
