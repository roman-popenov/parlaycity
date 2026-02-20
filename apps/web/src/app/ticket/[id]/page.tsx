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
const PPM = 1_000_000;
const BPS = 10_000;
const BASE_CASHOUT_PENALTY_BPS = 1_500;

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
  let hasLostLeg = false;

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
      const isLost = (result === 1 && isNoBet) || (result === 2 && !isNoBet);
      if (isWon && effectivePPM > 0) {
        wonProbsPPM.push(effectivePPM);
      }
      if (isLost) {
        hasLostLeg = true;
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

  // Compute cashout value using integer math (mirrors shared/math.ts computeCashoutValue)
  let cashoutValue: bigint | undefined;
  if (
    onChainTicket.payoutMode === 2 &&
    !hasLostLeg &&
    wonProbsPPM.length > 0 &&
    unresolvedCount > 0 &&
    effectiveStake > 0n
  ) {
    const ppm = BigInt(PPM);
    let wonMultiplier = ppm;
    for (const p of wonProbsPPM) {
      if (p > 0 && p <= PPM) wonMultiplier = (wonMultiplier * ppm) / BigInt(p);
    }
    const fairValue = (effectiveStake * wonMultiplier) / ppm;
    const scaledPenalty = (BigInt(penaltyBps) * BigInt(unresolvedCount)) / BigInt(legs.length);
    let cv = (fairValue * (BigInt(BPS) - scaledPenalty)) / BigInt(BPS);
    if (cv > onChainTicket.potentialPayout) cv = onChainTicket.potentialPayout;
    cashoutValue = cv;
  }

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

  // Crash game loop: compute leg multipliers and resolution state
  const legMultipliers: number[] = [];
  let resolvedWon = 0;
  let crashed = false;
  const resolvedLegs: boolean[] = [];

  for (const leg of ticket.legs) {
    legMultipliers.push(leg.odds);
    let isWon = false;
    let isLost = false;
    if (leg.resolved) {
      isWon =
        (leg.result === 1 && leg.outcomeChoice === 1) ||
        (leg.result === 2 && leg.outcomeChoice === 2);
      isLost =
        (leg.result === 1 && leg.outcomeChoice === 2) ||
        (leg.result === 2 && leg.outcomeChoice === 1);
      if (isWon) resolvedWon++;
      if (isLost) crashed = true;
    }
    resolvedLegs.push(isWon);
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

  const displayValue = crashed
    ? 0n
    : ticket.payoutMode === 2 && cashoutValue !== undefined
      ? cashoutValue
      : ticket.payout;

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
            resolvedLegs={resolvedLegs}
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
                {`$${Number(formatUnits(displayValue, 6)).toFixed(2)}`}
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
          resolvedLegs={resolvedLegs}
        />
      )}

      <TicketCard ticket={ticket} />
    </div>
  );
}
