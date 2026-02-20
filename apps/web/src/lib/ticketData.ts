import type { TicketData, TicketLeg } from "@/components/TicketCard";
import type { LegInfo, LegOracleResult, OnChainTicket } from "@/lib/hooks";
import { mapStatus, parseOutcomeChoice } from "@/lib/utils";

const PPM = 1_000_000;
const BPS = 10_000;
const BASE_CASHOUT_PENALTY_BPS = 1_500;

export function toTicketData(
  id: bigint,
  t: OnChainTicket,
  legMap: Map<string, LegInfo>,
  legStatuses: Map<string, LegOracleResult>,
): TicketData {
  const multiplier = Number(t.multiplierX1e6) / PPM;
  // Use effectiveStake (stake minus fee) for cashout math -- matches on-chain ParlayEngine.sol:613
  const effectiveStake = t.stake - t.feePaid;
  // Use ticket's snapshotted penalty if available, else default
  const penaltyBps = Number(t.cashoutPenaltyBps) || BASE_CASHOUT_PENALTY_BPS;
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

  // Compute cashout value using integer math (mirrors shared/math.ts computeCashoutValue)
  let cashoutValue: bigint | undefined;
  if (t.payoutMode === 2 && wonProbsPPM.length > 0 && unresolvedCount > 0 && effectiveStake > 0n) {
    const ppm = BigInt(PPM);
    let wonMultiplier = ppm;
    for (const p of wonProbsPPM) {
      if (p > 0 && p <= PPM) wonMultiplier = (wonMultiplier * ppm) / BigInt(p);
    }
    const fairValue = (effectiveStake * wonMultiplier) / ppm;
    const scaledPenalty = (BigInt(penaltyBps) * BigInt(unresolvedCount)) / BigInt(legs.length);
    let cv = (fairValue * (BigInt(BPS) - scaledPenalty)) / BigInt(BPS);
    if (cv > t.potentialPayout) cv = t.potentialPayout;
    cashoutValue = cv;
  }

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
