"use client";

import { formatUnits } from "viem";
import { useSettleTicket, useClaimPayout } from "@/lib/hooks";

export type TicketStatus = "Active" | "Won" | "Lost" | "Voided" | "Claimed";

export interface TicketLeg {
  description: string;
  odds: number;
  outcomeChoice: number; // 1 = yes, 2 = no
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
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  Active: "bg-accent-blue/20 text-accent-blue border-accent-blue/30",
  Won: "bg-neon-green/20 text-neon-green border-neon-green/30",
  Lost: "bg-neon-red/20 text-neon-red border-neon-red/30",
  Voided: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Claimed: "bg-accent-purple/20 text-accent-purple border-accent-purple/30",
};

function getLegStatus(leg: TicketLeg): "win" | "loss" | "voided" | "pending" {
  if (!leg.resolved) return "pending";
  if (leg.result === 3) return "voided";
  const isNoBet = leg.outcomeChoice === 2;
  // Oracle: 1=Won (yes side won), 2=Lost (no side won)
  if (leg.result === 1) return isNoBet ? "loss" : "win";
  if (leg.result === 2) return isNoBet ? "win" : "loss";
  return "pending";
}

export function TicketCard({ ticket }: { ticket: TicketData }) {
  const { settle, isPending: isSettling } = useSettleTicket();
  const { claim, isPending: isClaiming } = useClaimPayout();

  const multiplier = ticket.legs.reduce((acc, l) => acc * l.odds, 1);
  const allResolved = ticket.legs.every((l) => l.resolved);
  const canSettle = ticket.status === "Active" && allResolved;
  const canClaim = ticket.status === "Won";

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
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}
        >
          {ticket.status}
        </span>
      </div>

      {/* Legs */}
      <div className="divide-y divide-white/5 px-6">
        {ticket.legs.map((leg, i) => {
          const status = getLegStatus(leg);
          return (
            <div key={i} className="flex items-center gap-3 py-3">
              {/* Status indicator */}
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  status === "win"
                    ? "bg-neon-green/20 text-neon-green"
                    : status === "loss"
                      ? "bg-neon-red/20 text-neon-red"
                      : status === "voided"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-white/10 text-gray-400"
                }`}
              >
                {status === "win" ? "W" : status === "loss" ? "L" : status === "voided" ? "V" : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-300">
                  {leg.description}
                </p>
                <p className="text-xs text-gray-500">
                  {leg.odds.toFixed(1)}x &middot;{" "}
                  {leg.outcomeChoice === 1 ? "YES" : "NO"}
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
        </div>
      </div>
    </div>
  );
}
