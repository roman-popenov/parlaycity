"use client";

import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { useUserTickets } from "@/lib/hooks";
import { HOUSE_VAULT_ABI, contractAddresses } from "@/lib/contracts";

const REHAB_LOCK_DAYS = 120;
const SHARES_UNIT = 1_000_000n; // 1 vUSDC share (6 decimals)

interface RehabLock {
  ticketId: string;
  /** 10% of stake, in raw USDC units (6 decimals) */
  rehabRaw: bigint;
  rehabUsd: string;
  shares: string;
  currentValue: string;
  feesEarned: string;
  lockedAt: Date;
  maturesAt: Date;
  weight: string;
  matured: boolean;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Rehab locks derived from the connected user's lost tickets.
 * Fees are REAL -- derived from vault share price appreciation.
 * As tickets are bought and fees flow to the vault, share price rises
 * and "fees earned" updates in real time.
 */
export function RehabLocks() {
  const { tickets } = useUserTickets();

  // Read current vault share price: how much 1 vUSDC share is worth in USDC
  const { data: assetsPerShare } = useReadContract({
    address: contractAddresses.houseVault as `0x${string}`,
    abi: HOUSE_VAULT_ABI,
    functionName: "convertToAssets",
    args: [SHARES_UNIT],
    query: {
      enabled: !!contractAddresses.houseVault,
      refetchInterval: 3000, // Fast poll to show fees updating in real time
    },
  });

  // Status 2 = Lost
  const lostTickets = tickets.filter((t) => t.ticket.status === 2);

  if (lostTickets.length === 0) return null;

  // Share price: how many USDC per 1 vUSDC (as a float)
  const sharePrice = assetsPerShare !== undefined
    ? Number(formatUnits(assetsPerShare as bigint, 6))
    : 1.0;

  const locks: RehabLock[] = lostTickets.map((t) => {
    const stake = t.ticket.stake;
    // 10% of stake -> rehab amount (in USDC raw units)
    const rehabRaw = stake / 10n;
    const rehabUsd = Number(formatUnits(rehabRaw, 6)).toFixed(2);

    // Shares "minted" at 1:1 (rehab amount in vUSDC terms)
    const sharesFloat = Number(rehabUsd);
    const shares = sharesFloat.toFixed(2);

    // Current value = shares * current share price
    const currentVal = sharesFloat * sharePrice;
    const currentValue = currentVal.toFixed(2);

    // Fees = share price appreciation above 1:1
    // On a fresh demo vault, winning tickets drain the vault so sharePrice < 1.0.
    // Losing tickets (which created these rehab locks) ADD to vault, so net
    // effect is slightly positive. Show 4 decimals to capture micro-fees.
    const fees = Math.max(0, currentVal - sharesFloat);
    const feesEarned = fees < 0.01 ? fees.toFixed(4) : fees.toFixed(2);

    const createdAt = Number(t.ticket.createdAt);
    const lockedAt = new Date(createdAt * 1000);
    const maturesAt = new Date(
      (createdAt + REHAB_LOCK_DAYS * 86400) * 1000,
    );
    const matured = maturesAt.getTime() < Date.now();

    return {
      ticketId: t.id.toString(),
      rehabRaw,
      rehabUsd,
      shares,
      currentValue,
      feesEarned,
      lockedAt,
      maturesAt,
      weight: matured ? "1.55" : "1.00",
      matured,
    };
  });

  return (
    <section className="mx-auto max-w-3xl animate-fade-in-up">
      <div className="rounded-2xl border border-amber-500/10 bg-gradient-to-br from-amber-950/20 to-gray-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label="seedling">
              🌱
            </span>
            <h2 className="text-lg font-semibold text-white">Rehab Locks</h2>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Demo
          </span>
        </div>

        <p className="mb-5 text-sm text-gray-400">
          Lost bets aren&apos;t total losses. 10% of losing stakes are
          force-locked as LP shares for 120 days, converting losers into
          long-term liquidity providers. Fees update in real time as new
          tickets are bought.
        </p>

        <div className="space-y-3">
          {locks.map((lock) => (
            <div
              key={lock.ticketId}
              className={`rounded-xl border p-4 ${
                lock.matured
                  ? "border-neon-green/20 bg-neon-green/5"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {/* Ticket + Value */}
                <div className="min-w-[100px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Ticket #{lock.ticketId}
                  </p>
                  <p className="text-sm font-bold tabular-nums text-white">
                    {lock.shares} vUSDC{" "}
                    <span className="text-gray-500">(${lock.currentValue})</span>
                  </p>
                </div>

                {/* Fees Earned */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Fees Earned
                  </p>
                  <p className="text-sm font-bold tabular-nums text-neon-green">
                    +${lock.feesEarned}
                  </p>
                </div>

                {/* Weight */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Weight
                  </p>
                  <p className="text-sm font-bold tabular-nums text-amber-300">
                    {lock.weight}x
                  </p>
                </div>

                {/* Status / Countdown */}
                <div className="ml-auto text-right">
                  {lock.matured ? (
                    <>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-neon-green">
                        Matured
                      </p>
                      <div className="mt-1 flex gap-2">
                        <button
                          disabled
                          className="rounded-lg bg-neon-green/10 px-3 py-1 text-xs font-semibold text-neon-green opacity-60"
                          title="Demo only"
                        >
                          Withdraw
                        </button>
                        <button
                          disabled
                          className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 opacity-60"
                          title="Demo only"
                        >
                          Re-lock 1.55x
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        Unlocks In
                      </p>
                      <p className="text-sm font-bold tabular-nums text-white">
                        {daysUntil(lock.maturesAt)} days
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Date row */}
              <p className="mt-2 text-[10px] text-gray-600">
                Locked{" "}
                {lock.lockedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                &rarr; Matures{" "}
                {lock.maturesAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
