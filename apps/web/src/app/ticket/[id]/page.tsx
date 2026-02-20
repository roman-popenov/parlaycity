"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatUnits } from "viem";
import { useTicket, useUserTickets, useLegDescriptions, useLegStatuses } from "@/lib/hooks";
import {
  TicketCard,
  type TicketData,
  type TicketLeg,
} from "@/components/TicketCard";
import { MultiplierClimb } from "@/components/MultiplierClimb";
import { mapStatus, parseOutcomeChoice } from "@/lib/utils";
import { computeCashoutValueLocal } from "@/lib/cashout-math";

export default function TicketPage() {
  const params = useParams();
  const router = useRouter();
  const idStr = params.id as string;
  const ticketId = (() => {
    try {
      return BigInt(idStr);
    } catch {
      return undefined;
    }
  })();

  const { ticket: onChainTicket, isLoading } = useTicket(ticketId);
  const { tickets: userTickets } = useUserTickets();
  const legMap = useLegDescriptions(onChainTicket?.legIds ?? []);
  const legStatuses = useLegStatuses(onChainTicket?.legIds ?? [], legMap);

  // Find prev/next ticket IDs from user's tickets
  const sortedIds = userTickets.map((t) => t.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const currentIdx = ticketId !== undefined ? sortedIds.findIndex((id) => id === ticketId) : -1;
  const prevId = currentIdx > 0 ? sortedIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < sortedIds.length - 1 ? sortedIds[currentIdx + 1] : null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
      </div>
    );
  }

  if (!onChainTicket) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Ticket not found.</p>
        <Link
          href="/tickets"
          className="mt-4 inline-block text-sm text-accent-blue hover:underline"
        >
          Back to My Tickets
        </Link>
      </div>
    );
  }

  const multiplier = Number(onChainTicket.multiplierX1e6) / 1_000_000;
  const ticket: TicketData = {
    id: ticketId!,
    stake: onChainTicket.stake,
    feePaid: onChainTicket.feePaid,
    payout: onChainTicket.potentialPayout,
    legs: onChainTicket.legIds.map(
      (legId, i): TicketLeg => {
        const leg = legMap.get(legId.toString());
        const ppm = leg ? Number(leg.probabilityPPM) / 1_000_000 : 0;
        const outcomeChoice = parseOutcomeChoice(onChainTicket.outcomes[i]);
        const isNo = outcomeChoice === 2;
        const effectiveProb = outcomeChoice === 2 ? 1 - ppm : outcomeChoice === 1 ? ppm : 0;
        const odds = effectiveProb > 0 ? 1 / effectiveProb : multiplier ** (1 / onChainTicket.legIds.length);
        const oracleResult = legStatuses.get(legId.toString());
        return {
          description: leg?.question ?? `Leg #${legId.toString()}`,
          odds,
          outcomeChoice,
          resolved: oracleResult?.resolved ?? false,
          result: oracleResult?.status ?? 0, // 0=Unresolved, 1=Won, 2=Lost, 3=Voided
        };
      }
    ),
    status: mapStatus(onChainTicket.status),
    createdAt: Number(onChainTicket.createdAt),
    payoutMode: onChainTicket.payoutMode,
    claimedAmount: onChainTicket.claimedAmount,
  };

  // Crash game loop: compute leg multipliers and resolution state
  const legMultipliers: number[] = [];
  let resolvedWon = 0;
  let crashed = false;

  for (const leg of ticket.legs) {
    legMultipliers.push(leg.odds);
    if (leg.resolved) {
      const isWon =
        (leg.result === 1 && leg.outcomeChoice === 1) ||
        (leg.result === 2 && leg.outcomeChoice === 2);
      const isLost =
        (leg.result === 1 && leg.outcomeChoice === 2) ||
        (leg.result === 2 && leg.outcomeChoice === 1);
      if (isWon) resolvedWon++;
      if (isLost) crashed = true;
    }
  }

  // Current live multiplier: product of won leg odds
  let liveMultiplier = 1;
  for (const leg of ticket.legs) {
    if (!leg.resolved) continue;
    const isWon =
      (leg.result === 1 && leg.outcomeChoice === 1) ||
      (leg.result === 2 && leg.outcomeChoice === 2);
    if (isWon) liveMultiplier *= leg.odds;
  }

  // Compute live cashout value for EarlyCashout tickets
  let liveCashoutValue: bigint | null = null;
  if (ticket.payoutMode === 2 && ticket.status === "Active" && !crashed && resolvedWon > 0) {
    const unresolvedCount = ticket.legs.filter((l) => !l.resolved || l.result === 3).length;
    if (unresolvedCount > 0) {
      const wonProbsPPM: number[] = [];
      for (const leg of ticket.legs) {
        if (!leg.resolved) continue;
        const isWon =
          (leg.result === 1 && leg.outcomeChoice === 1) ||
          (leg.result === 2 && leg.outcomeChoice === 2);
        if (isWon) {
          const prob = leg.odds > 0 ? Math.round(1_000_000 / leg.odds) : 500_000;
          wonProbsPPM.push(Math.max(1, Math.min(999_999, prob)));
        }
      }
      if (wonProbsPPM.length > 0) {
        const effectiveStake = ticket.stake > ticket.feePaid ? ticket.stake - ticket.feePaid : 0n;
        liveCashoutValue = computeCashoutValueLocal(
          effectiveStake,
          wonProbsPPM,
          unresolvedCount,
          ticket.legs.length,
          ticket.payout,
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => prevId !== null ? router.push(`/ticket/${prevId.toString()}`) : null}
          disabled={prevId === null}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          Prev
        </button>

        <Link
          href="/tickets"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          All Tickets
        </Link>

        <button
          onClick={() => nextId !== null ? router.push(`/ticket/${nextId.toString()}`) : null}
          disabled={nextId === null}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">
          Ticket #{idStr}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Created{" "}
          {new Date(ticket.createdAt * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Crash game visualization for active tickets */}
      {ticket.status === "Active" && (
        <div className="space-y-3">
          <MultiplierClimb
            legMultipliers={legMultipliers}
            crashed={crashed}
            resolvedUpTo={resolvedWon}
          />
          {/* Live stats bar */}
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-gray-900/50 px-4 py-3">
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Live</p>
              <p className={`text-lg font-bold tabular-nums ${crashed ? "text-neon-red" : "text-neon-green"}`}>
                {crashed ? "0.00x" : `${liveMultiplier.toFixed(2)}x`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Legs Won</p>
              <p className="text-lg font-bold tabular-nums text-white">
                {resolvedWon}/{ticket.legs.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {ticket.payoutMode === 2 ? "Cashout" : "Potential"}
              </p>
              <p className="text-lg font-bold tabular-nums text-yellow-400">
                {liveCashoutValue !== null
                  ? `$${Number(formatUnits(liveCashoutValue, 6)).toFixed(2)}`
                  : `$${Number(formatUnits(ticket.payout, 6)).toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settled state -- show final multiplier visualization */}
      {(ticket.status === "Won" || ticket.status === "Lost" || ticket.status === "Claimed") && (
        <MultiplierClimb
          legMultipliers={legMultipliers}
          crashed={crashed}
          resolvedUpTo={resolvedWon}
        />
      )}

      <TicketCard ticket={ticket} />
    </div>
  );
}
