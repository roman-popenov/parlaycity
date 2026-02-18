"use client";

import { formatUnits } from "viem";
import { useSettleTicket, useClaimPayout, useClaimProgressive, useCashoutEarly } from "@/lib/hooks";

export type TicketStatus = "Active" | "Won" | "Lost" | "Voided" | "Claimed";

export interface TicketLeg {
  description: string;
  odds: number;
  outcomeChoice: number; // 1 = yes, 2 = no, 0 = unknown
  resolved: boolean;
  result: number; // 0 = unresolved, 1 = Won, 2 = Lost, 3 = Voided (oracle LegStatus)
}

export interface TicketData {
  id: bigint;
  stake: bigint;
  payout: bigint;
  legs: TicketLeg[];
  status: TicketStatus;
  createdAt: number;
  payoutMode?: number; // 0=Classic, 1=Progressive, 2=EarlyCashout
  claimedAmount?: bigint;
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  Active: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  Won: "bg-neon-green/20 text-neon-green border-neon-green/30",
  Lost: "bg-neon-red/20 text-neon-red border-neon-red/30",
  Voided: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Claimed: "bg-accent-purple/20 text-accent-purple border-accent-purple/30",
};

const LEG_STATUS_CONFIG: Record<
  "win" | "loss" | "voided" | "pending",
  { label: string; tooltip: string; style: string }
> = {
  win: { label: "W", tooltip: "Won", style: "bg-neon-green/20 text-neon-green" },
  loss: { label: "L", tooltip: "Lost", style: "bg-neon-red/20 text-neon-red" },
  voided: { label: "X", tooltip: "Voided", style: "bg-yellow-500/20 text-yellow-400" },
  pending: { label: "P", tooltip: "Pending", style: "bg-white/10 text-gray-400" },
};

function getLegStatus(leg: TicketLeg): "win" | "loss" | "voided" | "pending" {
  if (!leg.resolved) return "pending";
  if (leg.outcomeChoice !== 1 && leg.outcomeChoice !== 2) return "pending";
  if (leg.result === 3) return "voided";
  const isNoBet = leg.outcomeChoice === 2;
  // Oracle: 1=Won (yes side won), 2=Lost (no side won)
  if (leg.result === 1) return isNoBet ? "loss" : "win";
  if (leg.result === 2) return isNoBet ? "win" : "loss";
  return "pending";
}

const PAYOUT_MODE_LABELS: Record<number, { label: string; style: string }> = {
  0: { label: "Classic", style: "text-gray-400" },
  1: { label: "Progressive", style: "text-accent-purple" },
  2: { label: "Cashout", style: "text-yellow-400" },
};

export function TicketCard({ ticket }: { ticket: TicketData }) {
  const { settle, isPending: isSettling } = useSettleTicket();
  const { claim, isPending: isClaiming } = useClaimPayout();
  const { claimProgressive, isPending: isClaimingProgressive } = useClaimProgressive();
  const { cashoutEarly, isPending: isCashingOut } = useCashoutEarly();

  const multiplier = ticket.legs.reduce((acc, l) => acc * l.odds, 1);
  const allResolved = ticket.legs.every((l) => l.resolved);
  const hasWonLegs = ticket.legs.some((l) => {
    const s = getLegStatus(l);
    return s === "win";
  });
  const hasUnresolved = ticket.legs.some((l) => !l.resolved);
  const hasLostLeg = ticket.legs.some((l) => getLegStatus(l) === "loss");
  const canSettle = ticket.status === "Active" && allResolved;
  const canClaim = ticket.status === "Won";
  const canClaimProgressive = ticket.status === "Active" && ticket.payoutMode === 1 && hasWonLegs && !hasLostLeg;
  const canCashout = ticket.status === "Active" && ticket.payoutMode === 2 && hasWonLegs && hasUnresolved && !hasLostLeg;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900 to-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <span className="text-xs text-gray-500">Ticket</span>
          <h3 className="text-lg font-bold text-white">
            #{ticket.id.toString()}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {ticket.payoutMode !== undefined && ticket.payoutMode > 0 && (
            <span className={`text-[10px] font-medium ${PAYOUT_MODE_LABELS[ticket.payoutMode]?.style ?? ""}`}>
              {PAYOUT_MODE_LABELS[ticket.payoutMode]?.label}
            </span>
          )}
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}
          >
            {ticket.status}
          </span>
        </div>
      </div>

      {/* Legs */}
      <div className="divide-y divide-white/5 px-6">
        {ticket.legs.map((leg, i) => {
          const status = getLegStatus(leg);
          return (
            <div key={i} className="flex items-center gap-3 py-3">
              {/* Status indicator with tooltip */}
              <div className="group relative flex-shrink-0">
                <div
                  className={`flex h-7 w-7 cursor-help items-center justify-center rounded-full text-xs font-bold ${LEG_STATUS_CONFIG[status].style}`}
                  tabIndex={0}
                  aria-label={LEG_STATUS_CONFIG[status].tooltip}
                  title={LEG_STATUS_CONFIG[status].tooltip}
                >
                  {LEG_STATUS_CONFIG[status].label}
                </div>
                <div
                  className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-hidden="true"
                >
                  {LEG_STATUS_CONFIG[status].tooltip}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-300">
                  {leg.description}
                </p>
                <p className="text-xs text-gray-500">
                  {leg.odds.toFixed(1)}x &middot;{" "}
                  {leg.outcomeChoice === 1 ? "YES" : leg.outcomeChoice === 2 ? "NO" : "?"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: payout info + actions */}
      <div className="border-t border-white/5 px-6 py-4">
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Stake</p>
            <p className="font-semibold text-white">
              ${Number(formatUnits(ticket.stake, 6)).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Multiplier</p>
            <p className="font-bold text-accent-purple">
              {multiplier.toFixed(2)}x
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Payout</p>
            <p className="font-bold text-neon-green">
              ${Number(formatUnits(ticket.payout, 6)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {canSettle && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); settle(ticket.id); }}
              disabled={isSettling}
              className="flex-1 rounded-xl border border-accent-blue/30 bg-accent-blue/10 py-2.5 text-sm font-semibold text-accent-blue transition-all hover:bg-accent-blue/20 disabled:opacity-50"
            >
              {isSettling ? "Settling..." : "Settle"}
            </button>
          )}
          {canClaim && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); claim(ticket.id); }}
              disabled={isClaiming}
              className="flex-1 rounded-xl bg-gradient-to-r from-neon-green/80 to-neon-green py-2.5 text-sm font-bold text-black transition-all hover:shadow-lg hover:shadow-neon-green/20 disabled:opacity-50"
            >
              {isClaiming ? "Claiming..." : "Claim Payout"}
            </button>
          )}
          {canClaimProgressive && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); claimProgressive(ticket.id); }}
              disabled={isClaimingProgressive}
              className="flex-1 rounded-xl border border-accent-purple/30 bg-accent-purple/10 py-2.5 text-sm font-semibold text-accent-purple transition-all hover:bg-accent-purple/20 disabled:opacity-50"
            >
              {isClaimingProgressive ? "Claiming..." : "Claim Progressive"}
            </button>
          )}
          {canCashout && (
            <button
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                // Slippage protection: 95% of expected payout as minOut, floor at 1
                const minOut = ticket.payout > 0n ? (ticket.payout * 95n) / 100n : 1n;
                cashoutEarly(ticket.id, minOut);
              }}
              disabled={isCashingOut}
              className="flex-1 rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-2.5 text-sm font-semibold text-yellow-400 transition-all hover:bg-yellow-500/20 disabled:opacity-50"
            >
              {isCashingOut ? "Cashing out..." : "Cash Out Early"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
