"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useUSDCBalance, useMintTestUSDC } from "@/lib/hooks";

export function DemoBanner() {
  const { isConnected } = useAccount();
  const { balance } = useUSDCBalance();
  const { mint, isPending, isConfirming, isSuccess } = useMintTestUSDC();

  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore dismissed state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("demo:bannerDismissed");
      if (stored === "true") setDismissed(true);
    } catch {
      // sessionStorage unavailable
    }
    setHydrated(true);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("demo:bannerDismissed", "true");
    } catch {
      // sessionStorage unavailable
    }
  };

  // Hide conditions: not hydrated, not connected, has balance, or dismissed
  if (!hydrated) return null;
  if (!isConnected) return null;
  if (balance !== undefined && balance > 0n) return null;
  if (dismissed) return null;

  const buttonLabel = isPending
    ? "Signing..."
    : isConfirming
      ? "Minting..."
      : isSuccess
        ? "Minted!"
        : "Mint 1,000 Test USDC";

  return (
    <div
      data-testid="demo-banner"
      className="relative mx-auto max-w-7xl px-4 sm:px-6"
    >
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-pink/20 bg-gradient-to-r from-brand-pink/10 via-brand-purple/10 to-brand-pink/10 px-4 py-3">
        <span className="flex-shrink-0 rounded-full bg-brand-pink/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-pink">
          Demo
        </span>
        <p className="flex-1 text-sm text-gray-300">
          Welcome to ParlayVoo! Mint test USDC to get started.
        </p>
        <button
          onClick={() => mint()}
          disabled={isPending || isConfirming}
          className="btn-gradient flex-shrink-0 rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-gray-500 transition-colors hover:text-gray-300"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
