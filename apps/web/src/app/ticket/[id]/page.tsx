"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { RehabCTA } from "@/components/RehabCTA";
import { mapStatus, parseOutcomeChoice, isLegWon } from "@/lib/utils";
import { PPM, BASE_CASHOUT_PENALTY_BPS, computeClientCashoutValue } from "@/lib/cashout";

/** Hook to replay the rocket climb animation on settled tickets */
function useReplay(resolvedWon: number, crashed: boolean) {
  const [replaying, setReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const [replayCrashed, setReplayCrashed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const startReplay = useCallback(() => {
    setReplaying(true);
    setReplayStep(0);
    setReplayCrashed(false);
  }, []);

  useEffect(() => {
    if (!replaying) return;

    if (replayStep < resolvedWon) {
      timerRef.current = setTimeout(() => {
        setReplayStep((s) => s + 1);
      }, 1200);
    } else if (replayStep === resolvedWon && crashed && !replayCrashed) {
      timerRef.current = setTimeout(() => {
        setReplayCrashed(true);
      }, 800);
    }

    return () => clearTimeout(timerRef.current);
  }, [replaying, replayStep, crashed, replayCrashed, resolvedWon]);

  const stopReplay = useCallback(() => {
    clearTimeout(timerRef.current);
    setReplaying(false);
    setReplayStep(0);
    setReplayCrashed(false);
  }, []);

  return { replaying, replayStep, replayCrashed, startReplay, stopReplay };
}

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
  const isActive = onChainTicket?.status === 0;
  const legStatuses = useLegStatuses(onChainTicket?.legIds ?? [], legMap, isActive ? 2000 : 5000);

  const sortedIds = userTickets.map((t) => t.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const currentIdx = ticketId !== undefined ? sortedIds.findIndex((id) => id === ticketId) : -1;
  const prevId = currentIdx > 0 ? sortedIds[currentIdx - 1] : null;
  const nextId = currentIdx >= 0 && currentIdx < sortedIds.length - 1 ? sortedIds[currentIdx + 1] : null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-pink border-t-transparent" />
      </div>
    );
  }

  if (!onChainTicket) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Ticket not found.</p>
        <Link
          href="/tickets"
          className="mt-4 inline-block text-sm text-brand-pink hover:underline"
        >
          Back to My Tickets
        </Link>
      </div>
    );
  }

  const multiplier = Number(onChainTicket.multiplierX1e6) / PPM;
  const effectiveStake = onChainTicket.stake - onChainTicket.feePaid;
  const rawPenalty = Number(onChainTicket.cashoutPenaltyBps);
  const penaltyBps = Number.isFinite(rawPenalty) ? rawPenalty : BASE_CASHOUT_PENALTY_BPS;

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
      if (isLegWon(outcomeChoice, result) && effectivePPM > 0) {
        wonProbsPPM.push(effectivePPM);
      }
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

  const legMultipliers = legs.map((l) => l.odds);
  const resolvedWon = legs.filter((l) =>
    l.resolved && l.result !== 3 && isLegWon(l.outcomeChoice, l.result),
  ).length;
  const crashed = legs.some((l) =>
    l.resolved && l.result !== 3 && !isLegWon(l.outcomeChoice, l.result),
  );
  const liveMultiplier = crashed ? 0 : legs.reduce((m, l) => {
    if (!l.resolved || l.result === 3) return m;
    return isLegWon(l.outcomeChoice, l.result) ? m * l.odds : m;
  }, 1);

  const isSettled = ticket.status === "Won" || ticket.status === "Lost" || ticket.status === "Voided" || ticket.status === "Claimed";

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
            animated
          />
          {/* Live stats bar */}
          <div className="glass-card flex items-center justify-between px-4 py-3">
            <div className="text-center">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Live</p>
              <p className={`text-lg font-bold tabular-nums ${crashed ? "text-neon-red" : "text-brand-green"}`}>
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
              <p className="text-lg font-bold tabular-nums text-brand-gold">
                {cashoutValue !== undefined && !crashed
                  ? `$${Number(formatUnits(cashoutValue, 6)).toFixed(2)}`
                  : `$${Number(formatUnits(ticket.payout, 6)).toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settled state -- replay-capable multiplier visualization */}
      {isSettled && (
        <SettledClimb
          legMultipliers={legMultipliers}
          crashed={crashed}
          resolvedWon={resolvedWon}
        />
      )}

      {/* Rehab CTA for lost tickets */}
      {ticket.status === "Lost" && (
        <RehabCTA stake={ticket.stake} />
      )}

      <TicketCard ticket={ticket} />
    </div>
  );
}

/** Settled ticket climb with replay button */
function SettledClimb({
  legMultipliers,
  crashed,
  resolvedWon,
}: {
  legMultipliers: number[];
  crashed: boolean;
  resolvedWon: number;
}) {
  const { replaying, replayStep, replayCrashed, startReplay, stopReplay } =
    useReplay(resolvedWon, crashed);

  return (
    <div className="space-y-2">
      <MultiplierClimb
        legMultipliers={legMultipliers}
        crashed={replaying ? replayCrashed : crashed}
        resolvedUpTo={replaying ? replayStep : resolvedWon}
        animated={replaying}
      />
      <div className="flex justify-center">
        {!replaying ? (
          <button
            onClick={startReplay}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            Replay
          </button>
        ) : (
          <button
            onClick={stopReplay}
            className="rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-4 py-1.5 text-sm text-brand-pink transition-colors hover:bg-brand-pink/20"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
