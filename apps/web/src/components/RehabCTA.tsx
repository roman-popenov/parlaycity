"use client";

import Link from "next/link";
import { formatUnits } from "viem";

interface RehabCTAProps {
  /** Original ticket stake in USDC (6 decimals) */
  stake: bigint;
}

/**
 * "Silver lining" card shown on lost tickets.
 * Illustrates the 10% rehab lock (losers -> LP shares for 120 days).
 * Purely presentational -- rehab contracts don't exist yet.
 */
export function RehabCTA({ stake }: RehabCTAProps) {
  // 10% of stake locked as LP shares
  const rehabAmount = stake / 10n;
  const formatted =
    rehabAmount > 0n
      ? Number(formatUnits(rehabAmount, 6)).toFixed(2)
      : "0.00";

  return (
    <div className="animate-fade-in-up rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-yellow-950/20 p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" role="img" aria-label="shield">
          🛡️
        </span>
        <h3 className="text-lg font-bold text-amber-300">
          Your ticket crashed. But you&apos;re not empty-handed.
        </h3>
      </div>

      <p className="mb-4 text-sm text-amber-200/70">
        <span className="font-semibold text-amber-200">${formatted}</span> of
        your stake has been locked as LP shares in the vault, earning fees for{" "}
        <span className="font-semibold text-amber-200">120 days</span>. Turn
        your loss into long-term yield.
      </p>

      <div className="mb-4 rounded-xl border border-amber-500/10 bg-amber-900/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/60">
              Rehab Lock
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-300">
              ${formatted}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/60">
              Lock Period
            </p>
            <p className="text-sm font-semibold text-amber-300">120 days</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400/60">
              Weight
            </p>
            <p className="text-sm font-semibold text-amber-300">1.00x</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/vault"
          className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-center text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          View Your Rehab Lock
        </Link>
        <Link
          href="/vault"
          className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Become the House
        </Link>
      </div>
    </div>
  );
}
