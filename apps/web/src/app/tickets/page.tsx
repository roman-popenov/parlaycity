"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useUserTickets, useLegDescriptions, useLegStatuses, type OnChainTicket, type LegInfo, type LegOracleResult } from "@/lib/hooks";
import { TicketCard, type TicketData, type TicketLeg } from "@/components/TicketCard";
import { mapStatus } from "@/lib/utils";

function toTicketData(
  id: bigint,
  t: OnChainTicket,
  legMap: Map<string, LegInfo>,
  legStatuses: Map<string, LegOracleResult>,
): TicketData {
  const multiplier = Number(t.multiplierX1e6) / 1_000_000;
  return {
    id,
    stake: t.stake,
    payout: t.potentialPayout,
    legs: t.legIds.map((legId, i): TicketLeg => {
      const leg = legMap.get(legId.toString());
      const ppm = leg ? Number(leg.probabilityPPM) / 1_000_000 : 0;
      const isNo = Number(t.outcomes[i]) === 2;
      const effectiveProb = isNo ? 1 - ppm : ppm;
      const odds = effectiveProb > 0 ? 1 / effectiveProb : multiplier ** (1 / t.legIds.length);
      const oracleResult = legStatuses.get(legId.toString());
      return {
        description: leg?.question ?? `Leg #${legId.toString()}`,
        odds,
        outcomeChoice: Number(t.outcomes[i]) || 1,
        resolved: oracleResult?.resolved ?? false,
        result: oracleResult?.status ?? 0,
      };
    }),
    status: mapStatus(t.status),
    createdAt: Number(t.createdAt),
  };
}

export default function TicketsPage() {
  const { isConnected } = useAccount();
  const { tickets, totalCount, isLoading, error, refetch } = useUserTickets();

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

      {!isLoading && tickets.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map(({ id, ticket }) => (
            <Link
              key={id.toString()}
              href={`/ticket/${id.toString()}`}
              className="block transition-transform hover:scale-[1.02]"
            >
              <TicketCard ticket={toTicketData(id, ticket, legMap, legStatuses)} />
            </Link>
          ))}
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
