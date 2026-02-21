"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── FTUE Hook ──────────────────────────────────────────────────────────

interface FTUEStep {
  targetId: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const PHASE_1_STEPS: FTUEStep[] = [
  {
    targetId: "ftue-connect-wallet",
    title: "Connect Your Wallet",
    description: "Start by connecting your wallet to interact with ParlayVoo on Base.",
    position: "bottom",
  },
  {
    targetId: "ftue-builder",
    title: "Build Your Parlay",
    description: "Pick 2-5 prediction legs and choose Yes or No on each. Your odds multiply together!",
    position: "top",
  },
  {
    targetId: "ftue-vault-link",
    title: "Become the House",
    description: "Deposit USDC into the vault to earn yield from fees and losing bets.",
    position: "bottom",
  },
];

const PHASE_2_STEPS: FTUEStep[] = [
  {
    targetId: "parlay-panel",
    title: "Your Parlay Ticket",
    description: "Selected legs appear here. Watch your multiplier grow as you add legs.",
    position: "left",
  },
  {
    targetId: "parlay-multiplier",
    title: "Multiplier Climb",
    description: "This is your rocket! Watch it climb as legs resolve in your favor.",
    position: "left",
  },
  {
    targetId: "stake-input",
    title: "Set Your Stake",
    description: "Enter how much USDC to wager. Your potential payout = stake x multiplier.",
    position: "left",
  },
];

const STORAGE_KEY = "ftue:completed";
const PHASE2_STORAGE_KEY = "ftue:phase2_completed";

export function useFTUE() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0); // 0 = inactive
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const p1Done = sessionStorage.getItem(STORAGE_KEY) === "true";
      const p2Done = sessionStorage.getItem(PHASE2_STORAGE_KEY) === "true";
      if (!p1Done) {
        setPhase(1);
        setStepIndex(0);
      } else if (!p2Done) {
        setPhase(2);
        setStepIndex(0);
      }
    } catch {
      // sessionStorage unavailable
    }
    setHydrated(true);
  }, []);

  const steps = phase === 1 ? PHASE_1_STEPS : phase === 2 ? PHASE_2_STEPS : [];

  const next = useCallback(() => {
    setStepIndex((prev) => {
      if (prev >= steps.length - 1) {
        // Complete current phase
        try {
          if (phase === 1) {
            sessionStorage.setItem(STORAGE_KEY, "true");
            setPhase(2);
            return 0;
          } else {
            sessionStorage.setItem(PHASE2_STORAGE_KEY, "true");
            setPhase(0);
            return 0;
          }
        } catch {
          setPhase(0);
          return 0;
        }
      }
      return prev + 1;
    });
  }, [steps.length, phase]);

  const prev = useCallback(() => {
    setStepIndex((p) => Math.max(0, p - 1));
  }, []);

  const skip = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
      sessionStorage.setItem(PHASE2_STORAGE_KEY, "true");
    } catch {
      // sessionStorage unavailable
    }
    setPhase(0);
    setStepIndex(0);
  }, []);

  const restart = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(PHASE2_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable
    }
    setPhase(1);
    setStepIndex(0);
  }, []);

  const active = hydrated && phase > 0 && steps.length > 0;
  const currentStep = active ? steps[stepIndex] : null;

  return { active, phase, stepIndex, steps, currentStep, next, prev, skip, restart };
}

// ── Spotlight Component ────────────────────────────────────────────────

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function FTUESpotlight() {
  const { active, stepIndex, steps, currentStep, next, prev, skip } = useFTUE();
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);

  // Track whether the target element exists on the current page
  const [targetExists, setTargetExists] = useState(false);

  // Measure target element position
  useEffect(() => {
    if (!active || !currentStep) {
      setRect(null);
      setTargetExists(false);
      return;
    }

    function measure() {
      const el = document.getElementById(currentStep!.targetId);
      if (el) {
        setTargetExists(true);
        const r = el.getBoundingClientRect();
        const pad = 8;
        setRect({
          top: r.top - pad,
          left: r.left - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        });
      } else {
        setTargetExists(false);
        setRect(null);
      }
      rafRef.current = requestAnimationFrame(measure);
    }

    measure();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, currentStep]);

  // Don't render anything if FTUE inactive or target element not on current page
  if (!active || !currentStep) return null;
  if (!targetExists) return null;

  const tooltipPosition = currentStep.position ?? "bottom";

  return (
    <>
      {/* Spotlight cutout */}
      {rect && (
        <div
          className="ftue-spotlight"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          data-testid="ftue-tooltip"
          className="fixed z-[10000] w-80 rounded-2xl border border-brand-pink/30 bg-gray-900/95 p-5 shadow-2xl backdrop-blur-xl"
          style={getTooltipStyle(rect, tooltipPosition)}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{currentStep.title}</h3>
            <button
              onClick={skip}
              className="text-xs text-gray-500 transition-colors hover:text-gray-300"
            >
              Skip
            </button>
          </div>
          <p className="mb-4 text-sm text-gray-400">{currentStep.description}</p>

          {/* Progress dots */}
          <div className="mb-3 flex justify-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? "w-4 bg-brand-pink"
                    : i < stepIndex
                      ? "bg-brand-pink/50"
                      : "bg-gray-700"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={stepIndex === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white disabled:opacity-30"
            >
              Back
            </button>
            <button
              onClick={next}
              className="btn-gradient rounded-lg px-4 py-1.5 text-xs font-bold text-white"
            >
              {stepIndex === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      )}

      {/* Click-to-skip overlay when spotlight not visible yet (initial render) */}
      {!rect && targetExists && (
        <div className="ftue-overlay" onClick={next} />
      )}
    </>
  );
}

function getTooltipStyle(
  rect: SpotlightRect,
  position: string,
): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case "top":
      return {
        bottom: `calc(100vh - ${rect.top}px + ${gap}px)`,
        left: Math.max(16, rect.left + rect.width / 2 - 160),
      };
    case "left":
      return {
        top: rect.top + rect.height / 2 - 80,
        right: `calc(100vw - ${rect.left}px + ${gap}px)`,
      };
    case "right":
      return {
        top: rect.top + rect.height / 2 - 80,
        left: rect.left + rect.width + gap,
      };
    case "bottom":
    default:
      return {
        top: rect.top + rect.height + gap,
        left: Math.max(16, rect.left + rect.width / 2 - 160),
      };
  }
}
