import { NextResponse } from "next/server";
import { SEED_MARKETS } from "@/lib/mcp/tools";
import { fetchNBAMarkets } from "@/lib/bdl";

/**
 * GET /api/markets -- serve seed + live NBA markets.
 * Replaces the Express services `/markets` endpoint for Vercel deployment.
 * NBA markets fetched from BallDontLie API when BDL_API_KEY is set.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categoryFilter = searchParams.get("category");

  // Merge seed + NBA markets
  const nbaMarkets = await fetchNBAMarkets();
  let markets = [...SEED_MARKETS, ...nbaMarkets];

  if (categoryFilter) {
    const cats = categoryFilter.split(",").map((c) => c.trim().toLowerCase());
    markets = markets.filter((m) => cats.includes(m.category));
  }

  // Return in the APIMarket[] shape the frontend expects
  const response = markets.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    legs: m.legs.map((l) => ({
      id: l.id,
      question: l.question,
      sourceRef: l.sourceRef,
      cutoffTime: l.cutoffTime,
      earliestResolve: l.earliestResolve,
      probabilityPPM: l.probabilityPPM,
      active: l.active,
    })),
  }));

  return NextResponse.json(response);
}
