import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import {
  computeMultiplier,
  computeEdge,
  applyEdge,
  computePayout,
  PPM,
  USDC_DECIMALS,
  RiskAction,
} from "@parlaycity/shared";
import type { RiskProfile } from "@parlaycity/shared";
import { LEG_MAP } from "@/lib/mcp/tools";

const RISK_CAPS: Record<
  RiskProfile,
  { maxKelly: number; maxLegs: number; minWinProb: number }
> = {
  conservative: { maxKelly: 0.05, maxLegs: 3, minWinProb: 0.15 },
  moderate: { maxKelly: 0.15, maxLegs: 4, minWinProb: 0.05 },
  aggressive: { maxKelly: 1.0, maxLegs: 5, minWinProb: 0.0 },
};

/**
 * POST /api/premium/agent-quote
 *
 * Combined quote + risk assessment for the ParlayBuilder risk advisor.
 * Mirrors the Express `/premium/agent-quote` response shape.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { legIds, outcomes, stake, bankroll, riskTolerance } = body as {
      legIds: number[];
      outcomes: string[];
      stake: string;
      bankroll: string;
      riskTolerance: string;
    };

    // Validate inputs
    if (!Array.isArray(legIds) || legIds.length < 2 || legIds.length > 5) {
      return NextResponse.json(
        { error: "legIds must be an array of 2-5 numbers" },
        { status: 400 },
      );
    }

    // Resolve legs + probabilities from catalog
    const probs: number[] = [];
    const categories: string[] = [];
    for (const id of legIds) {
      const leg = LEG_MAP.get(id);
      if (!leg) {
        return NextResponse.json(
          { error: `Leg ${id} not found` },
          { status: 400 },
        );
      }
      if (!leg.active) {
        return NextResponse.json(
          { error: `Leg ${id} is not active` },
          { status: 400 },
        );
      }
      probs.push(leg.probabilityPPM);
      categories.push(leg.category);
    }

    // ── Quote computation ──────────────────────────────────────────────
    const stakeNum = parseFloat(stake) || 0;
    if (stakeNum < 1) {
      return NextResponse.json(
        { error: "Stake must be at least 1 USDC" },
        { status: 400 },
      );
    }

    const stakeRaw = BigInt(Math.round(stakeNum * 10 ** USDC_DECIMALS));
    const fairMultiplierX1e6 = computeMultiplier(probs);
    const edgeBps = computeEdge(probs.length);
    const netMultiplierX1e6 = applyEdge(fairMultiplierX1e6, edgeBps);
    const payout = computePayout(stakeRaw, netMultiplierX1e6);
    const fee = computePayout(stakeRaw, fairMultiplierX1e6) - payout;

    const quote = {
      legIds,
      outcomes,
      stake,
      multiplierX1e6: fairMultiplierX1e6.toString(),
      potentialPayout: formatUnits(payout, USDC_DECIMALS),
      feePaid: formatUnits(fee, USDC_DECIMALS),
      edgeBps,
      probabilities: probs,
      valid: true,
    };

    // ── Risk assessment ────────────────────────────────────────────────
    const profile: RiskProfile =
      riskTolerance === "conservative" || riskTolerance === "aggressive"
        ? riskTolerance
        : "moderate";
    const caps = RISK_CAPS[profile];
    const warnings: string[] = [];
    const numLegs = probs.length;

    // BigInt overflow guard
    if (fairMultiplierX1e6 > BigInt(Number.MAX_SAFE_INTEGER)) {
      return NextResponse.json({
        quote,
        risk: {
          action: RiskAction.AVOID,
          suggestedStake: "0.00",
          kellyFraction: 0,
          winProbability: 0,
          expectedValue: 0,
          confidence: 0.5,
          reasoning: "Combined multiplier exceeds safe computation range.",
          warnings: ["Multiplier too large"],
          riskTolerance: profile,
          fairMultiplier: 0,
          netMultiplier: 0,
          edgeBps,
        },
      });
    }

    const fairMultFloat = Number(fairMultiplierX1e6) / PPM;
    const netMultFloat = Number(netMultiplierX1e6) / PPM;
    const winProbability = 1 / fairMultFloat;
    const ev = winProbability * netMultFloat - 1;
    const expectedValue = Math.round(ev * stakeNum * 100) / 100;

    const b = netMultFloat - 1;
    const p = winProbability;
    const q = 1 - p;
    let kellyFraction = b > 0 ? Math.max(0, (b * p - q) / b) : 0;
    kellyFraction = Math.min(kellyFraction, caps.maxKelly);

    const bankrollNum = parseFloat(bankroll) || 1000;
    const suggestedStake = Math.round(kellyFraction * bankrollNum * 100) / 100;

    if (numLegs > caps.maxLegs) {
      warnings.push(
        `${profile} profile recommends max ${caps.maxLegs} legs, you have ${numLegs}`,
      );
    }
    if (winProbability < caps.minWinProb) {
      warnings.push(
        `Win probability ${(winProbability * 100).toFixed(2)}% is below ${profile} minimum of ${(caps.minWinProb * 100).toFixed(0)}%`,
      );
    }

    // Correlation detection
    const catCounts: Record<string, number> = {};
    for (const cat of categories) {
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(catCounts)) {
      if (count > 1) {
        warnings.push(`${count} legs in category "${cat}" may be correlated`);
      }
    }

    let action: string = RiskAction.BUY;
    let reasoning = "";

    if (winProbability < caps.minWinProb || numLegs > caps.maxLegs) {
      action = RiskAction.AVOID;
      reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability exceeds ${profile} risk tolerance limits.`;
    } else if (kellyFraction === 0) {
      action = RiskAction.REDUCE_STAKE;
      reasoning = `House edge (${edgeBps}bps) exceeds edge on fair odds. Kelly suggests $0.`;
    } else if (suggestedStake < stakeNum) {
      action = RiskAction.REDUCE_STAKE;
      reasoning = `Kelly criterion suggests ${suggestedStake.toFixed(2)} USDC (${(kellyFraction * 100).toFixed(2)}% of bankroll). Your proposed stake of ${stake} USDC exceeds this.`;
    } else {
      reasoning = `${numLegs}-leg parlay at ${(winProbability * 100).toFixed(2)}% win probability. Kelly suggests ${(kellyFraction * 100).toFixed(2)}% of bankroll = ${suggestedStake.toFixed(2)} USDC.`;
    }

    const confidence = Math.max(0.5, 1 - (numLegs - 2) * 0.1);

    const risk = {
      action,
      suggestedStake: suggestedStake.toFixed(2),
      kellyFraction: Math.round(kellyFraction * 10_000) / 10_000,
      winProbability: Math.round(winProbability * 1_000_000) / 1_000_000,
      expectedValue,
      confidence: Math.round(confidence * 100) / 100,
      reasoning,
      warnings,
      riskTolerance: profile,
      fairMultiplier: Math.round(fairMultFloat * 100) / 100,
      netMultiplier: Math.round(netMultFloat * 100) / 100,
      edgeBps,
    };

    return NextResponse.json({ quote, risk });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
