"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useModal } from "connectkit";
import { PARLAY_CONFIG, SERVICES_API_URL } from "@/lib/config";
import {
  sanitizeNumericInput,
  blockNonNumericKeys,
  useSessionState,
} from "@/lib/utils";
import { MOCK_LEGS, type MockLeg } from "@/lib/mock";
import { useBuyTicket, useParlayConfig, useUSDCBalance, useVaultStats } from "@/lib/hooks";
import { MultiplierClimb } from "./MultiplierClimb";

// ── Types ────────────────────────────────────────────────────────────────

interface SelectedLeg {
  leg: MockLeg;
  outcomeChoice: number; // 1 = yes, 2 = no
}

/** Serializable form for sessionStorage (bigint is not JSON-safe). */
interface StoredSelection {
  legId: string; // BigInt.toString()
  outcomeChoice: number;
}

interface RiskAdviceData {
  action: string;
  suggestedStake: string;
  kellyFraction: number;
  winProbability: number;
  reasoning: string;
  warnings: string[];
}

// ── Session storage keys ─────────────────────────────────────────────────

const SESSION_KEYS = {
  legs: "parlay:selectedLegs",
  stake: "parlay:stake",
  payoutMode: "parlay:payoutMode",
} as const;

// ── Pure helpers ─────────────────────────────────────────────────────────

/** Yes odds from mock data. No odds = complement: yesOdds / (yesOdds - 1). */
function effectiveOdds(leg: MockLeg, outcome: number): number {
  if (outcome === 2) return leg.odds / (leg.odds - 1);
  return leg.odds;
}

/** Restore SelectedLeg[] from serialized form by matching against MOCK_LEGS. */
function restoreSelections(stored: StoredSelection[]): SelectedLeg[] {
  const legMap = new Map(MOCK_LEGS.map((l) => [l.id.toString(), l]));
  const result: SelectedLeg[] = [];
  for (const s of stored) {
    const leg = legMap.get(s.legId);
    if (leg && (s.outcomeChoice === 1 || s.outcomeChoice === 2)) {
      result.push({ leg, outcomeChoice: s.outcomeChoice });
    }
  }
  return result;
}

/** Validate that a parsed risk response has the required shape. */
function isValidRiskResponse(data: unknown): data is RiskAdviceData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.action === "string" &&
    typeof d.suggestedStake === "string" &&
    /^\d+(?:\.\d*)?$/.test(d.suggestedStake) &&
    typeof d.kellyFraction === "number" &&
    typeof d.winProbability === "number" &&
    typeof d.reasoning === "string" &&
    Array.isArray(d.warnings) &&
    d.warnings.every((w: unknown) => typeof w === "string")
  );
}

// ── Component ────────────────────────────────────────────────────────────

export function ParlayBuilder() {
  const { isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();
  const { buyTicket, resetSuccess, isPending, isConfirming, isSuccess, error } = useBuyTicket();
  const { balance: usdcBalance } = useUSDCBalance();
  const { freeLiquidity, maxPayout } = useVaultStats();
  const { baseFeeBps, perLegFeeBps, maxLegs, minStakeUSDC } = useParlayConfig();

  // ── Input state (persisted to sessionStorage) ──────────────────────────

  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([]);
  const [stake, setStake] = useSessionState<string>(SESSION_KEYS.stake, "");
  const [payoutMode, setPayoutMode] = useSessionState<0 | 1 | 2>(SESSION_KEYS.payoutMode, 0);

  // Restore selectedLegs from sessionStorage on mount (needs special handling
  // because MockLeg contains bigint which isn't JSON-serializable).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(SESSION_KEYS.legs);
      if (raw) {
        const stored: StoredSelection[] = JSON.parse(raw);
        const restored = restoreSelections(stored);
        if (restored.length > 0) setSelectedLegs(restored);
      }
    } catch {
      // parse error or sessionStorage unavailable
    }
  }, []);

  // Persist selectedLegs to sessionStorage on change
  useEffect(() => {
    if (!mounted) return;
    try {
      const serialized: StoredSelection[] = selectedLegs.map((s) => ({
        legId: s.leg.id.toString(),
        outcomeChoice: s.outcomeChoice,
      }));
      sessionStorage.setItem(SESSION_KEYS.legs, JSON.stringify(serialized));
    } catch {
      // storage full or unavailable
    }
  }, [mounted, selectedLegs]);

  // ── Risk advisor state ─────────────────────────────────────────────────

  const [riskAdvice, setRiskAdvice] = useState<RiskAdviceData | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const riskFetchIdRef = useRef(0);

  // Clear stale risk advice, reset loading, and invalidate in-flight fetches
  useEffect(() => {
    setRiskAdvice(null);
    setRiskError(null);
    setRiskLoading(false);
    riskFetchIdRef.current++;
  }, [selectedLegs, stake, payoutMode]);

  // ── Derived values ─────────────────────────────────────────────────────

  const stakeNum = parseFloat(stake) || 0;
  const effectiveMaxLegs = maxLegs ?? PARLAY_CONFIG.maxLegs;
  const effectiveMinStake = minStakeUSDC ?? PARLAY_CONFIG.minStakeUSDC;
  const effectiveBaseFee = baseFeeBps ?? PARLAY_CONFIG.baseFee;
  const effectivePerLegFee = perLegFeeBps ?? PARLAY_CONFIG.perLegFee;

  const multiplier = useMemo(() => {
    return selectedLegs.reduce((acc, s) => acc * effectiveOdds(s.leg, s.outcomeChoice), 1);
  }, [selectedLegs]);

  const feeBps = effectiveBaseFee + effectivePerLegFee * selectedLegs.length;
  const feeAmount = (stakeNum * feeBps) / 10000;
  const potentialPayout = (stakeNum - feeAmount) * multiplier;

  const freeLiquidityNum = freeLiquidity !== undefined ? parseFloat(formatUnits(freeLiquidity, 6)) : 0;
  const maxPayoutNum = maxPayout !== undefined ? parseFloat(formatUnits(maxPayout, 6)) : 0;
  const insufficientLiquidity = potentialPayout > 0 && potentialPayout > freeLiquidityNum;
  const exceedsMaxPayout = potentialPayout > 0 && maxPayout !== undefined && potentialPayout > maxPayoutNum;
  const usdcBalanceNum = usdcBalance !== undefined ? parseFloat(formatUnits(usdcBalance, 6)) : 0;
  const insufficientBalance = stakeNum > 0 && usdcBalance !== undefined && stakeNum > usdcBalanceNum;

  const canBuy =
    mounted &&
    isConnected &&
    selectedLegs.length >= PARLAY_CONFIG.minLegs &&
    selectedLegs.length <= effectiveMaxLegs &&
    stakeNum >= effectiveMinStake &&
    !insufficientLiquidity &&
    !exceedsMaxPayout &&
    !insufficientBalance;

  const vaultEmpty = mounted && freeLiquidity !== undefined && freeLiquidity === 0n;

  // ── Handlers ───────────────────────────────────────────────────────────

  const toggleLeg = useCallback(
    (leg: MockLeg, outcome: number) => {
      resetSuccess();
      setSelectedLegs((prev) => {
        const existing = prev.findIndex((s) => s.leg.id === leg.id);
        if (existing >= 0) {
          if (prev[existing].outcomeChoice === outcome) {
            return prev.filter((_, i) => i !== existing);
          }
          const updated = [...prev];
          updated[existing] = { leg, outcomeChoice: outcome };
          return updated;
        }
        if (prev.length >= effectiveMaxLegs) return prev;
        return [...prev, { leg, outcomeChoice: outcome }];
      });
    },
    [resetSuccess, effectiveMaxLegs]
  );

  const handleBuy = async () => {
    if (!canBuy) return;
    const legIds = selectedLegs.map((s) => s.leg.id);
    const outcomes = selectedLegs.map((s) => s.outcomeChoice);
    const success = await buyTicket(legIds, outcomes, stakeNum, payoutMode);
    if (success) {
      setSelectedLegs([]);
      setStake("");
      setPayoutMode(0);
      setRiskAdvice(null);
      // No clearSessionState needed: the setters above reset to defaults,
      // which the persist effects write to sessionStorage automatically.
    }
  };

  const fetchRiskAdvice = useCallback(async () => {
    const localFetchId = ++riskFetchIdRef.current;
    setRiskLoading(true);
    setRiskAdvice(null);
    setRiskError(null);

    try {
      const probabilities = selectedLegs.map((s) => {
        const prob = 1 / effectiveOdds(s.leg, s.outcomeChoice);
        const scaled = Math.round(prob * 1_000_000);
        return Math.min(999_999, Math.max(1, scaled));
      });

      // x402 payment header is a proof-of-payment receipt, not a secret.
      // The protocol is designed for client-side usage.
      const res = await fetch(`${SERVICES_API_URL}/premium/risk-assess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-402-payment": process.env.NEXT_PUBLIC_X402_PAYMENT ?? "demo-token",
        },
        body: JSON.stringify({
          legIds: selectedLegs.map((s) => Number(s.leg.id)),
          outcomes: selectedLegs.map((s) => (s.outcomeChoice === 1 ? "Yes" : "No")),
          stake,
          probabilities,
          bankroll:
            usdcBalance !== undefined && usdcBalance > 0n
              ? formatUnits(usdcBalance, 6)
              : "100",
          riskTolerance: "moderate",
        }),
      });

      // Stale check: if inputs changed while fetch was in-flight, discard result
      if (localFetchId !== riskFetchIdRef.current) return;

      if (!res.ok) {
        setRiskError(`Risk analysis unavailable (${res.status})`);
        setRiskLoading(false);
        return;
      }

      const data: unknown = await res.json();
      if (localFetchId !== riskFetchIdRef.current) return;

      if (!isValidRiskResponse(data)) {
        setRiskError("Invalid response from risk advisor");
        setRiskLoading(false);
        return;
      }

      setRiskAdvice(data);
    } catch {
      if (localFetchId === riskFetchIdRef.current) {
        setRiskError("Failed to connect to risk advisor");
      }
    }

    if (localFetchId === riskFetchIdRef.current) setRiskLoading(false);
  }, [selectedLegs, stake, usdcBalance]);

  // ── Derived display ────────────────────────────────────────────────────

  const txState = isPending
    ? "pending"
    : isConfirming
      ? "confirming"
      : isSuccess
        ? "confirmed"
        : null;

  function buyButtonLabel(): string {
    if (!mounted || !isConnected) return "Connect Wallet";
    if (isPending) return "Waiting for approval...";
    if (isConfirming) return "Confirming...";
    if (isSuccess) return "Ticket Bought!";
    if (vaultEmpty) return "No Vault Liquidity";
    if (selectedLegs.length < PARLAY_CONFIG.minLegs) return `Select at least ${PARLAY_CONFIG.minLegs} legs`;
    if (insufficientBalance) return "Insufficient USDC Balance";
    if (exceedsMaxPayout) return `Max Payout $${maxPayoutNum.toFixed(0)}`;
    if (insufficientLiquidity) return "Insufficient Vault Liquidity";
    return "Buy Ticket";
  }

  // ── Render ─────────────────────────────────────────────────────────────

  // SSR guard: render invisible (preserves layout) until client hydration.
  // No transition class = instant switch, no flicker.
  return (
    <div className={`grid gap-8 lg:grid-cols-5 ${mounted ? "" : "pointer-events-none opacity-0"}`}>
      {/* Leg selector */}
      <div className="space-y-4 lg:col-span-3">
        {vaultEmpty && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
            No liquidity in the vault. Deposit USDC in the Vault tab to enable betting.
          </div>
        )}
        <h2 className="text-lg font-semibold text-gray-300">
          Pick Your Legs{" "}
          <span className="text-sm text-gray-500">
            ({selectedLegs.length}/{effectiveMaxLegs})
          </span>
        </h2>
        <div className={`grid gap-3 sm:grid-cols-2 ${vaultEmpty ? "pointer-events-none opacity-40" : ""}`}>
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
                    disabled={vaultEmpty}
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
                    disabled={vaultEmpty}
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
                  Balance: {parseFloat(formatUnits(usdcBalance, 6)).toFixed(2)}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={stake}
                onKeyDown={blockNonNumericKeys}
                onChange={(e) => { resetSuccess(); setStake(sanitizeNumericInput(e.target.value)); }}
                placeholder={`Min ${effectiveMinStake} USDC`}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-24 text-lg font-semibold text-white placeholder-gray-600 outline-none transition-colors focus:border-accent-blue/50"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {usdcBalance !== undefined && usdcBalance > 0n && (
                  <button
                    type="button"
                    onClick={() => setStake(formatUnits(usdcBalance!, 6))}
                    className="rounded-md bg-accent-blue/20 px-2 py-0.5 text-xs font-semibold text-accent-blue transition-colors hover:bg-accent-blue/30"
                  >
                    MAX
                  </button>
                )}
                <span className="text-sm text-gray-500">USDC</span>
              </div>
            </div>
          </div>

          {/* Payout mode selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Payout Mode
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
              {([
                { value: 0 as const, label: "Classic", desc: "All or nothing" },
                { value: 1 as const, label: "Progressive", desc: "Claim as legs win" },
                { value: 2 as const, label: "Cashout", desc: "Exit early w/ penalty" },
              ]).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => { resetSuccess(); setPayoutMode(value); }}
                  className={`rounded-lg px-2 py-2 text-center transition-all ${
                    payoutMode === value
                      ? "bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-[10px] opacity-60">{desc}</span>
                </button>
              ))}
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

          {/* Risk Advisor */}
          {selectedLegs.length >= PARLAY_CONFIG.minLegs && stakeNum > 0 && (
            <div className="space-y-2">
              <button
                onClick={fetchRiskAdvice}
                disabled={riskLoading}
                className="w-full rounded-lg border border-accent-purple/30 bg-accent-purple/10 py-2 text-xs font-semibold text-accent-purple transition-all hover:bg-accent-purple/20 disabled:opacity-50"
              >
                {riskLoading ? "Analyzing..." : "AI Risk Analysis (x402)"}
              </button>
              {riskError && (
                <div className="rounded-lg border border-neon-red/20 bg-neon-red/5 px-3 py-2 text-xs text-neon-red animate-fade-in">
                  {riskError}
                </div>
              )}
              {riskAdvice && (
                <div className={`rounded-lg border px-3 py-2.5 text-xs animate-fade-in ${
                  riskAdvice.action === "BUY" ? "border-neon-green/20 bg-neon-green/5 text-neon-green" :
                  riskAdvice.action === "REDUCE_STAKE" ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-400" :
                  "border-neon-red/20 bg-neon-red/5 text-neon-red"
                }`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold">{riskAdvice.action}</span>
                    <span className="text-gray-400">Kelly: {(riskAdvice.kellyFraction * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-gray-300">{riskAdvice.reasoning}</p>
                  {riskAdvice.warnings.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {riskAdvice.warnings.map((w, i) => (
                        <p key={i} className="text-yellow-400/80">! {w}</p>
                      ))}
                    </div>
                  )}
                  {riskAdvice.suggestedStake && riskAdvice.suggestedStake !== stake && (
                    <button
                      onClick={() => setStake(sanitizeNumericInput(riskAdvice!.suggestedStake))}
                      className="mt-1.5 rounded bg-accent-blue/20 px-2 py-0.5 text-accent-blue hover:bg-accent-blue/30"
                    >
                      Use suggested: ${riskAdvice.suggestedStake}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={!mounted || !isConnected ? () => openConnectModal(true) : handleBuy}
            disabled={mounted && isConnected && (!canBuy || vaultEmpty || isPending || isConfirming)}
            className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
              !mounted || !isConnected
                ? "bg-gradient-to-r from-accent-blue to-accent-purple text-white shadow-lg shadow-accent-purple/20 hover:shadow-accent-purple/40"
                : canBuy && !vaultEmpty && !isPending && !isConfirming
                  ? "bg-gradient-to-r from-accent-blue to-accent-purple text-white shadow-lg shadow-accent-purple/20 hover:shadow-accent-purple/40"
                  : "cursor-not-allowed bg-gray-800 text-gray-500"
            }`}
          >
            {buyButtonLabel()}
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
