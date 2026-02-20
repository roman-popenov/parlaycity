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
import { PPM, BASE_CASHOUT_PENALTY_BPS, computeClientCashoutValue } from "@/lib/cashout";

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

  const multiplier = Number(onChainTicket.multiplierX1e6) / PPM;
  // Use effectiveStake (stake minus fee) for cashout math -- matches on-chain ParlayEngine.sol:613
  const effectiveStake = onChainTicket.stake - onChainTicket.feePaid;
  // Use ticket's snapshotted penalty if available, else default
  const penaltyBps = Number(onChainTicket.cashoutPenaltyBps) || BASE_CASHOUT_PENALTY_BPS;

  // Build legs in a single pass, collecting cashout inputs simultaneously
  const wonProbsPPM: number[] = [];
  let unresolvedCount = 0;

  const legs: TicketLeg[] = onChainTicket.legIds.map((legId, i): TicketLeg => {
    const leg = legMap.get(legId.toString());
    const rawPPM = leg ? Number(leg.probabilityPPM) : 0;
    const outcomeChoice = parseOutcomeChoice(onChainTicket.outcomes[i]);
    const effectivePPM = outcomeChoice === 2
      ? PPM - rawPPM
      : outcomeChoice === 1 ? rawPPM : 0;
    const odds = effectivePPM > 0 ? PPM / effectivePPM : multiplier ** (1 / onChainTicket.legIds.length);
    const oracleResult = legStatuses.get(legId.toString());
    const resolved = oracleResult?.resolved ?? false;
    const result = oracleResult?.status ?? 0;

    if (resolved && result !== 3) {
      // Non-voided resolved leg
      const isNoBet = outcomeChoice === 2;
      const isWon = (result === 1 && !isNoBet) || (result === 2 && isNoBet);
      if (isWon && effectivePPM > 0) {
        wonProbsPPM.push(effectivePPM);
      }
    } else {
      // Unresolved OR voided (result === 3) -- matches ParlayEngine.sol:554-557
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

  // Compute cashout value using shared integer math (mirrors ParlayMath.sol)
  const cashoutValue = onChainTicket.payoutMode === 2
    ? computeClientCashoutValue(effectiveStake, wonProbsPPM, unresolvedCount, legs.length, onChainTicket.potentialPayout, penaltyBps)
    : undefined;

  const ticket: TicketData = {
    id: ticketId!,
    stake: onChainTicket.stake,
    feePaid: onChainTicket.feePaid,
    payout: onChainTicket.potentialPayout,
    legs,
    status: mapStatus(onChainTicket.status),
    createdAt: Number(onChainTicket.createdAt),
    payoutMode: onChainTicket.payoutMode,
    claimedAmount: onChainTicket.claimedAmount,
    cashoutPenaltyBps: penaltyBps,
    cashoutValue,
  };

  // Crash game loop: derive from already-computed leg data
  const legMultipliers = legs.map((l) => l.odds);
  const resolvedWon = wonProbsPPM.length;
  const crashed = legs.some((l) => {
    if (!l.resolved || l.result === 3) return false;
    const isNoBet = l.outcomeChoice === 2;
    return !((l.result === 1 && !isNoBet) || (l.result === 2 && isNoBet));
  });
  const liveMultiplier = crashed ? 0 : legs.reduce((m, l) => {
    if (!l.resolved || l.result === 3) return m;
    const isNoBet = l.outcomeChoice === 2;
    const isWon = (l.result === 1 && !isNoBet) || (l.result === 2 && isNoBet);
    return isWon ? m * l.odds : m;
  }, 1);

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
                {ticket.payoutMode === 2 && !crashed ? "Cashout" : "Potential"}
              </p>
              <p className="text-lg font-bold tabular-nums text-yellow-400">
                {cashoutValue !== undefined && !crashed
                  ? `$${Number(formatUnits(cashoutValue, 6)).toFixed(2)}`
                  : `$${Number(formatUnits(ticket.payout, 6)).toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settled state -- show final multiplier visualization */}
      {(ticket.status === "Won" || ticket.status === "Lost" || ticket.status === "Voided" || ticket.status === "Claimed") && (
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
