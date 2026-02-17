"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { PARLAY_CONFIG } from "@/lib/config";
import { MOCK_LEGS, type MockLeg } from "@/lib/mock";
import { useBuyTicket, useUSDCBalance, useVaultStats } from "@/lib/hooks";
import { MultiplierClimb } from "./MultiplierClimb";

interface SelectedLeg {
  leg: MockLeg;
  outcomeChoice: number; // 1 = yes, 2 = no
}

/** Yes odds come from mock data. No odds = complement: yesOdds / (yesOdds - 1) */
function effectiveOdds(leg: MockLeg, outcome: number): number {
  if (outcome === 2) return leg.odds / (leg.odds - 1);
  return leg.odds;
}

export function ParlayBuilder() {
  const { isConnected } = useAccount();
  const { buyTicket, isPending, isConfirming, isSuccess, error } = useBuyTicket();
  const { balance: usdcBalance } = useUSDCBalance();
  const { freeLiquidity } = useVaultStats();

  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([]);
  const [stake, setStake] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stakeNum = parseFloat(stake) || 0;

  const toggleLeg = useCallback(
    (leg: MockLeg, outcome: number) => {
      setSelectedLegs((prev) => {
        const existing = prev.findIndex((s) => s.leg.id === leg.id);
        if (existing >= 0) {
          // If same outcome, deselect. If different, change it.
          if (prev[existing].outcomeChoice === outcome) {
            return prev.filter((_, i) => i !== existing);
          }
          const updated = [...prev];
          updated[existing] = { leg, outcomeChoice: outcome };
          return updated;
        }
        if (prev.length >= PARLAY_CONFIG.maxLegs) return prev;
        return [...prev, { leg, outcomeChoice: outcome }];
      });
    },
    []
  );

  const multiplier = useMemo(() => {
    return selectedLegs.reduce((acc, s) => acc * effectiveOdds(s.leg, s.outcomeChoice), 1);
  }, [selectedLegs]);

  const feeBps =
    PARLAY_CONFIG.baseFee + PARLAY_CONFIG.perLegFee * selectedLegs.length;
  const feeAmount = (stakeNum * feeBps) / 10000;
  const potentialPayout = (stakeNum - feeAmount) * multiplier;

  const freeLiquidityNum = freeLiquidity !== undefined ? Number(freeLiquidity) / 1e6 : 0;
  const insufficientLiquidity = potentialPayout > 0 && potentialPayout > freeLiquidityNum;

  const canBuy =
    mounted &&
    isConnected &&
    selectedLegs.length >= PARLAY_CONFIG.minLegs &&
    selectedLegs.length <= PARLAY_CONFIG.maxLegs &&
    stakeNum >= PARLAY_CONFIG.minStakeUSDC &&
    !insufficientLiquidity;

  const handleBuy = async () => {
    if (!canBuy) return;
    const legIds = selectedLegs.map((s) => s.leg.id);
    const outcomes = selectedLegs.map((s) => s.outcomeChoice);
    const success = await buyTicket(legIds, outcomes, stakeNum);
    if (success) {
      setSelectedLegs([]);
      setStake("");
    }
  };

  const txState = isPending
    ? "pending"
    : isConfirming
      ? "confirming"
      : isSuccess
        ? "confirmed"
        : null;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Leg selector */}
      <div className="space-y-4 lg:col-span-3">
        <h2 className="text-lg font-semibold text-gray-300">
          Pick Your Legs{" "}
          <span className="text-sm text-gray-500">
            ({selectedLegs.length}/{PARLAY_CONFIG.maxLegs})
          </span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_LEGS.map((leg) => {
            const selected = selectedLegs.find((s) => s.leg.id === leg.id);
            return (
              <div
                key={leg.id.toString()}
                className={`group rounded-xl border p-4 transition-all duration-200 ${
                  selected
                    ? "border-accent-blue/50 bg-accent-blue/5"
                    : "border-white/5 bg-gray-900/50 hover:border-white/10"
                }`}
              >
                <p className="mb-3 text-sm font-medium text-gray-200">
                  {leg.description}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLeg(leg, 1)}
                    className={`flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      selected?.outcomeChoice === 1
                        ? "bg-neon-green/20 text-neon-green ring-1 ring-neon-green/30"
                        : "bg-neon-green/5 text-neon-green/60 hover:bg-neon-green/10 hover:text-neon-green"
                    }`}
                  >
                    <span>Yes</span>
                    <span className="ml-1 tabular-nums opacity-70">{effectiveOdds(leg, 1).toFixed(2)}x</span>
                  </button>
                  <button
                    onClick={() => toggleLeg(leg, 2)}
                    className={`flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      selected?.outcomeChoice === 2
                        ? "bg-neon-red/20 text-neon-red ring-1 ring-neon-red/30"
                        : "bg-neon-red/5 text-neon-red/60 hover:bg-neon-red/10 hover:text-neon-red"
                    }`}
                  >
                    <span>No</span>
                    <span className="ml-1 tabular-nums opacity-70">{effectiveOdds(leg, 2).toFixed(2)}x</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticket builder / summary panel */}
      <div className="lg:col-span-2">
        <div className="sticky top-20 space-y-6 rounded-2xl border border-white/5 bg-gray-900/60 p-6 backdrop-blur">
          {/* Multiplier climb */}
          <MultiplierClimb
            legMultipliers={selectedLegs.map((s) => effectiveOdds(s.leg, s.outcomeChoice))}
          />

          {/* Selected legs summary */}
          {selectedLegs.length > 0 && (
            <div className="space-y-2">
              {selectedLegs.map((s, i) => (
                <div
                  key={s.leg.id.toString()}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm animate-fade-in"
                >
                  <span className="truncate text-gray-300">
                    <span className="mr-2 text-gray-500">#{i + 1}</span>
                    {s.leg.description}
                  </span>
                  <span
                    className={`ml-2 flex-shrink-0 text-xs font-bold ${
                      s.outcomeChoice === 1 ? "text-neon-green" : "text-neon-red"
                    }`}
                  >
                    {s.outcomeChoice === 1 ? "YES" : "NO"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Stake input */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Stake (USDC)
              </label>
              {usdcBalance !== undefined && (
                <span className="text-xs text-gray-500">
                  Balance: {(Number(usdcBalance) / 1e6).toFixed(2)}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                min={PARLAY_CONFIG.minStakeUSDC}
                step="1"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder={`Min ${PARLAY_CONFIG.minStakeUSDC} USDC`}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-24 text-lg font-semibold text-white placeholder-gray-600 outline-none transition-colors focus:border-accent-blue/50"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {usdcBalance !== undefined && usdcBalance > 0n && (
                  <button
                    type="button"
                    onClick={() => setStake((Number(usdcBalance) / 1e6).toString())}
                    className="rounded-md bg-accent-blue/20 px-2 py-0.5 text-xs font-semibold text-accent-blue transition-colors hover:bg-accent-blue/30"
                  >
                    MAX
                  </button>
                )}
                <span className="text-sm text-gray-500">USDC</span>
              </div>
            </div>
          </div>

          {/* Payout breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Potential Payout</span>
              <span className="font-semibold text-white">
                ${potentialPayout.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Fee ({(feeBps / 100).toFixed(1)}%)</span>
              <span>${feeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Combined Odds</span>
              <span
                className="font-bold"
                style={{
                  color:
                    selectedLegs.length <= 2
                      ? "#22c55e"
                      : selectedLegs.length <= 3
                        ? "#eab308"
                        : "#ef4444",
                }}
              >
                {multiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={!canBuy || isPending || isConfirming}
            className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
              canBuy && !isPending && !isConfirming
                ? "bg-gradient-to-r from-accent-blue to-accent-purple text-white shadow-lg shadow-accent-purple/20 hover:shadow-accent-purple/40"
                : "cursor-not-allowed bg-gray-800 text-gray-500"
            }`}
          >
            {!mounted || !isConnected
              ? "Connect Wallet"
              : selectedLegs.length < PARLAY_CONFIG.minLegs
                ? `Select at least ${PARLAY_CONFIG.minLegs} legs`
                : insufficientLiquidity
                  ? "Insufficient Vault Liquidity"
                  : isPending
                    ? "Waiting for approval..."
                    : isConfirming
                      ? "Confirming..."
                      : isSuccess
                        ? "Ticket Bought!"
                        : "Buy Ticket"}
          </button>

          {/* Tx feedback */}
          {txState && (
            <div
              className={`rounded-lg px-4 py-2.5 text-center text-sm font-medium animate-fade-in ${
                txState === "confirmed"
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-accent-blue/10 text-accent-blue"
              }`}
            >
              {txState === "pending" && "Transaction submitted..."}
              {txState === "confirming" && "Waiting for confirmation..."}
              {txState === "confirmed" && "Your parlay ticket is live!"}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-neon-red/10 px-4 py-2.5 text-center text-sm text-neon-red animate-fade-in">
              {error.message.length > 100
                ? error.message.slice(0, 100) + "..."
                : error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
