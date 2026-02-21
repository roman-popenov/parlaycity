/**
 * BallDontLie API client for real NBA market data.
 *
 * Fetches upcoming games and transforms them into Market[] format
 * with moneyline + over/under legs. Results cached in-memory (5 min TTL).
 *
 * Requires BDL_API_KEY env var. Gracefully disabled if not set.
 */
import type { Market, Leg } from "@parlaycity/shared";

const BDL_BASE = "https://api.balldontlie.io/v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const NBA_LEG_ID_OFFSET = 1000; // NBA legs start at 1000 to avoid seed collisions

// ── BDL API types ──────────────────────────────────────────────────────────

interface BDLTeam {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

interface BDLGame {
  id: number;
  date: string;
  season: number;
  status: string;
  home_team: BDLTeam;
  visitor_team: BDLTeam;
  home_team_score: number;
  visitor_team_score: number;
}

interface BDLTeamSeasonAverage {
  team: BDLTeam;
  season: number;
  season_type: string;
  stats: Record<string, number | string>;
}

// ── Cache ──────────────────────────────────────────────────────────────────

let cachedMarkets: Market[] | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return cachedMarkets !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ── BDL API helpers ────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.BDL_API_KEY ?? null;
}

async function bdlFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("BDL_API_KEY not set");

  const url = new URL(`${BDL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    throw new Error(`BDL API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Date helpers ───────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * BDL uses the **start year** of the NBA season: 2025-26 season = 2025.
 * Oct+ = current year starts a new season. Jan-Sep = season started previous year.
 */
export function getBDLSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  return month >= 9 ? year : year - 1;
}

// ── Probability estimation ─────────────────────────────────────────────────

/**
 * Estimate win probability for home team based on team scoring averages.
 * Uses a simple model: home team gets 3-point home advantage on point differential.
 * Returns probability in PPM (0-1_000_000).
 */
function estimateMoneylinePPM(
  homeAvgPts: number,
  homeAvgOppPts: number,
  awayAvgPts: number,
  awayAvgOppPts: number,
): number {
  // Home team expected margin = (home offense - away defense) + home court advantage
  // vs (away offense - home defense)
  const homeExpected = (homeAvgPts + awayAvgOppPts) / 2 + 3; // 3pt home advantage
  const awayExpected = (awayAvgPts + homeAvgOppPts) / 2;
  const diff = homeExpected - awayExpected;

  // Convert point differential to win probability using logistic function
  // ~2.5 points per 10% change in win probability
  const prob = 1 / (1 + Math.exp(-diff / 4));
  const ppm = Math.round(prob * 1_000_000);

  // Clamp to reasonable range [100_000, 900_000]
  return Math.min(900_000, Math.max(100_000, ppm));
}

/**
 * Estimate total points for over/under line.
 * Returns { line, overPPM } where overPPM is probability of going over.
 */
function estimateOverUnder(
  homeAvgPts: number,
  awayAvgPts: number,
): { line: number; overPPM: number } {
  const expectedTotal = homeAvgPts + awayAvgPts;
  // Set line at the expected total (so over/under is ~50/50)
  const line = Math.round(expectedTotal * 2) / 2; // round to nearest 0.5
  return { line, overPPM: 500_000 }; // 50/50 by design
}

// ── Fetch team stats ───────────────────────────────────────────────────────

async function fetchTeamStats(teamIds: number[]): Promise<Map<number, { avgPts: number; avgOppPts: number }>> {
  const stats = new Map<number, { avgPts: number; avgOppPts: number }>();
  const season = getBDLSeason();

  try {
    // BDL team_season_averages accepts team_ids[] params
    const params: Record<string, string> = {
      season: String(season),
      season_type: "reg",
      type: "base",
    };
    // Add team_ids as repeated params
    const url = new URL(`${BDL_BASE}/team_season_averages/general`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.append(k, v);
    }
    for (const id of teamIds) {
      url.searchParams.append("team_ids[]", String(id));
    }

    const apiKey = getApiKey();
    if (!apiKey) return stats;

    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return stats;

    const data = (await res.json()) as { data: BDLTeamSeasonAverage[] };
    for (const entry of data.data) {
      const pts = typeof entry.stats.pts === "number" ? entry.stats.pts : parseFloat(String(entry.stats.pts)) || 110;
      const oppPts = typeof entry.stats.opp_pts === "number" ? entry.stats.opp_pts : parseFloat(String(entry.stats.opp_pts)) || 110;
      stats.set(entry.team.id, { avgPts: pts, avgOppPts: oppPts });
    }
  } catch (e) {
    console.warn("[bdl] Failed to fetch team stats:", (e as Error).message);
  }

  return stats;
}

// ── Transform games to markets ─────────────────────────────────────────────

function gameToMarket(game: BDLGame, legIdBase: number, teamStats: Map<number, { avgPts: number; avgOppPts: number }>): Market {
  const home = game.home_team;
  const away = game.visitor_team;

  const homeStats = teamStats.get(home.id) ?? { avgPts: 110, avgOppPts: 110 };
  const awayStats = teamStats.get(away.id) ?? { avgPts: 110, avgOppPts: 110 };

  const moneylinePPM = estimateMoneylinePPM(homeStats.avgPts, homeStats.avgOppPts, awayStats.avgPts, awayStats.avgOppPts);
  const { line, overPPM } = estimateOverUnder(homeStats.avgPts, awayStats.avgPts);

  const gameDate = new Date(game.date);
  const dateStr = gameDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const cutoffTime = Math.floor(gameDate.getTime() / 1000);
  const earliestResolve = cutoffTime + 4 * 3600; // ~4 hours after game start

  const legs: Leg[] = [
    {
      id: legIdBase,
      question: `Will ${home.full_name} beat ${away.full_name}?`,
      sourceRef: `bdl:game:${game.id}`,
      cutoffTime,
      earliestResolve,
      probabilityPPM: moneylinePPM,
      active: true,
    },
    {
      id: legIdBase + 1,
      question: `Will ${away.abbreviation} @ ${home.abbreviation} total score be over ${line}?`,
      sourceRef: `bdl:game:${game.id}:ou`,
      cutoffTime,
      earliestResolve,
      probabilityPPM: overPPM,
      active: true,
    },
  ];

  return {
    id: `nba-${game.id}`,
    title: `${away.abbreviation} @ ${home.abbreviation} - ${dateStr}`,
    description: `${away.full_name} at ${home.full_name}`,
    category: "nba",
    legs,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns true if BDL integration is available (API key is set).
 */
export function isBDLEnabled(): boolean {
  return getApiKey() !== null;
}

/**
 * Fetch NBA markets from BallDontLie. Returns cached results if fresh.
 * Returns empty array if BDL_API_KEY is not set or API fails.
 */
export async function fetchNBAMarkets(): Promise<Market[]> {
  if (!isBDLEnabled()) return [];
  if (isCacheValid()) return cachedMarkets!;

  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7); // next 7 days

    const data = await bdlFetch<{ data: BDLGame[] }>("/games", {
      "start_date": formatDate(today),
      "end_date": formatDate(endDate),
      per_page: "25",
    });

    // Filter to upcoming games (not Final)
    const upcoming = data.data.filter((g) => g.status !== "Final");

    if (upcoming.length === 0) {
      // If no upcoming, include recent non-final games (e.g. in-progress).
      // Completed ("Final") games are excluded to prevent already-decided
      // outcomes from being registered as bettable legs on-chain.
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const recentData = await bdlFetch<{ data: BDLGame[] }>("/games", {
        "start_date": formatDate(yesterday),
        "end_date": formatDate(today),
        per_page: "10",
      });
      upcoming.push(...recentData.data.filter((g) => g.status !== "Final").slice(0, 6));
    }

    // Collect unique team IDs for stats
    const teamIds = new Set<number>();
    for (const game of upcoming) {
      teamIds.add(game.home_team.id);
      teamIds.add(game.visitor_team.id);
    }

    // Fetch team stats for probability estimation
    const teamStats = await fetchTeamStats([...teamIds]);

    // Transform games to markets (IDs derived from game.id for stability)
    const markets: Market[] = upcoming.map((game) =>
      gameToMarket(game, NBA_LEG_ID_OFFSET + game.id * 2, teamStats),
    );

    cachedMarkets = markets;
    cacheTimestamp = Date.now();
    console.log(`[bdl] Fetched ${markets.length} NBA markets (${upcoming.length} games)`);
    return markets;
  } catch (e) {
    console.warn("[bdl] Failed to fetch NBA markets:", (e as Error).message);
    // Return stale cache if available, otherwise empty
    return cachedMarkets ?? [];
  }
}

// ── Resolution helpers ────────────────────────────────────────────────────

export type { BDLGame };

export interface BDLGameResult {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  sourceRefMoneyline: string;
  sourceRefOU: string;
  catalogLegIdMoneyline: number;
  catalogLegIdOU: number;
}

/**
 * Fetch completed ("Final") NBA games from the past N days.
 * No caching -- resolution needs fresh data every call.
 * Returns empty array if BDL is disabled or API fails.
 */
export async function fetchCompletedGames(lookbackDays = 3): Promise<BDLGameResult[]> {
  if (!isBDLEnabled()) return [];

  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - lookbackDays);

    const data = await bdlFetch<{ data: BDLGame[] }>("/games", {
      "start_date": formatDate(startDate),
      "end_date": formatDate(today),
      per_page: "100",
    });

    return data.data
      .filter((g) => g.status === "Final")
      .map((g) => ({
        gameId: g.id,
        homeTeam: g.home_team.full_name,
        awayTeam: g.visitor_team.full_name,
        homeScore: g.home_team_score,
        awayScore: g.visitor_team_score,
        sourceRefMoneyline: `bdl:game:${g.id}`,
        sourceRefOU: `bdl:game:${g.id}:ou`,
        catalogLegIdMoneyline: NBA_LEG_ID_OFFSET + g.id * 2,
        catalogLegIdOU: NBA_LEG_ID_OFFSET + g.id * 2 + 1,
      }));
  } catch (e) {
    console.warn("[bdl] Failed to fetch completed games:", (e as Error).message);
    return [];
  }
}

/**
 * Clear the BDL cache. Useful for testing.
 */
export function clearBDLCache(): void {
  cachedMarkets = null;
  cacheTimestamp = 0;
}
