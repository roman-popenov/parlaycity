import { NextResponse } from "next/server";
import { SEED_MARKETS } from "@/lib/mcp/tools";

/**
 * GET /api/markets — serve seed markets in the same shape the ParlayBuilder expects.
 * Replaces the Express services `/markets` endpoint for Vercel deployment.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categoryFilter = searchParams.get("category");

  let markets = SEED_MARKETS;

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
