"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useUserTickets, useLegDescriptions, useLegStatuses, type OnChainTicket, type LegInfo, type LegOracleResult } from "@/lib/hooks";
import { TicketCard, type TicketData, type TicketLeg, type TicketStatus } from "@/components/TicketCard";
import { mapStatus, parseOutcomeChoice, isLegWon } from "@/lib/utils";
import { PPM, BASE_CASHOUT_PENALTY_BPS, computeClientCashoutValue } from "@/lib/cashout";

type TabFilter = "all" | "active" | "settled" | "cashed";

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "settled", label: "Settled" },
  { key: "cashed", label: "Cashed Out" },
];

function matchesTab(status: TicketStatus, tab: TabFilter): boolean {
  switch (tab) {
    case "all":
      return true;
    case "active":
      return status === "Active";
    case "settled":
      return status === "Won" || status === "Lost" || status === "Voided";
    case "cashed":
      return status === "Claimed";
  }
}

function toTicketData(
  id: bigint,
  t: OnChainTicket,
  legMap: Map<string, LegInfo>,
  legStatuses: Map<string, LegOracleResult>,
): TicketData {
  const multiplier = Number(t.multiplierX1e6) / PPM;
  const effectiveStake = t.stake - t.feePaid;
  // Nullish check: on-chain 0 bps is a valid penalty (|| would replace it with default)
  const rawPenalty = Number(t.cashoutPenaltyBps);
  const penaltyBps = Number.isFinite(rawPenalty) ? rawPenalty : BASE_CASHOUT_PENALTY_BPS;
  const wonProbsPPM: number[] = [];
  let unresolvedCount = 0;

  const legs: TicketLeg[] = t.legIds.map((legId, i): TicketLeg => {
    const leg = legMap.get(legId.toString());
    const rawPPM = leg ? Number(leg.probabilityPPM) : 0;
    const outcomeChoice = parseOutcomeChoice(t.outcomes[i]);
    const effectivePPM = outcomeChoice === 2
      ? PPM - rawPPM
      : outcomeChoice === 1 ? rawPPM : 0;
    const odds = effectivePPM > 0 ? PPM / effectivePPM : multiplier ** (1 / t.legIds.length);
    const oracleResult = legStatuses.get(legId.toString());
    const resolved = oracleResult?.resolved ?? false;
    const result = oracleResult?.status ?? 0;

    if (resolved && result !== 3) {
      if (isLegWon(outcomeChoice, result) && effectivePPM > 0) wonProbsPPM.push(effectivePPM);
    } else {
      unresolvedCount++;
    }

    return {
      description: leg?.question ?? `Leg #${legId.toString()}`,
      odds,
      outcomeChoice,
      resolved,
      result,
      probabilityPPM: effectivePPM,
    };
  });

  // Compute cashout value for EarlyCashout tickets
  const cashoutValue = t.payoutMode === 2
    ? computeClientCashoutValue(effectiveStake, wonProbsPPM, unresolvedCount, legs.length, t.potentialPayout, penaltyBps)
    : undefined;

  return {
    id,
    stake: t.stake,
    feePaid: t.feePaid,
    payout: t.potentialPayout,
    legs,
    status: mapStatus(t.status),
    createdAt: Number(t.createdAt),
    payoutMode: t.payoutMode,
    claimedAmount: t.claimedAmount,
    cashoutPenaltyBps: penaltyBps,
    cashoutValue,
  };
}

export default function TicketsPage() {
  const { isConnected } = useAccount();
  const { tickets, totalCount, isLoading, error, refetch } = useUserTickets();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // Collect all unique leg IDs across all tickets
  const allLegIds = useMemo(() => {
    const ids: bigint[] = [];
    for (const { ticket } of tickets) {
      for (const legId of ticket.legIds) {
        if (!ids.some((id) => id === legId)) ids.push(legId);
      }
    }
    return ids;
  }, [tickets]);

  const legMap = useLegDescriptions(allLegIds);
  const legStatuses = useLegStatuses(allLegIds, legMap);

  // Build ticket data and compute tab counts
  const ticketDataList = useMemo(
    () => tickets.map(({ id, ticket }) => toTicketData(id, ticket, legMap, legStatuses)),
    [tickets, legMap, legStatuses],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabFilter, number> = { all: 0, active: 0, settled: 0, cashed: 0 };
    for (const td of ticketDataList) {
      counts.all++;
      if (matchesTab(td.status, "active")) counts.active++;
      if (matchesTab(td.status, "settled")) counts.settled++;
      if (matchesTab(td.status, "cashed")) counts.cashed++;
    }
    return counts;
  }, [ticketDataList]);

  const filtered = useMemo(
    () => ticketDataList.filter((td) => matchesTab(td.status, activeTab)),
    [ticketDataList, activeTab],
  );

  return (
    <div className="space-y-8">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">
            My Tickets{" "}
            {tickets.length > 0 && (
              <span className="text-lg font-medium text-gray-500">
                ({tickets.length})
              </span>
            )}
          </h1>
          <p className="mt-2 text-gray-400">
            Track your parlays, settle resolved tickets, and claim winnings.
          </p>
          {totalCount > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {totalCount} total ticket{totalCount !== 1 ? "s" : ""} on-chain
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          Refresh
        </button>
      </section>

      {/* Status tabs */}
      {tickets.length > 0 && (
        <div className="flex gap-1 rounded-xl border border-white/5 bg-gray-900/50 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span
                  className={`ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    activeTab === tab.key
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "bg-white/5 text-gray-600"
                  }`}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-neon-red/10 px-4 py-3 text-sm text-neon-red">
          Failed to load tickets: {error.length > 200 ? error.slice(0, 200) + "..." : error}
        </div>
      )}

      {isLoading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((td) => (
            <Link
              key={td.id.toString()}
              href={`/ticket/${td.id.toString()}`}
              className="block transition-transform hover:scale-[1.02]"
            >
              <TicketCard ticket={td} />
            </Link>
          ))}
        </div>
      )}

      {!isLoading && tickets.length > 0 && filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-500">
            No {activeTab === "active" ? "active" : activeTab === "settled" ? "settled" : activeTab === "cashed" ? "cashed out" : ""} tickets.
          </p>
        </div>
      )}

      {!isLoading && tickets.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-gray-500">No tickets yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple px-6 py-2.5 text-sm font-bold text-white"
          >
            Build Your First Parlay
          </Link>
        </div>
      )}
    </div>
  );
}
