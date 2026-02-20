"use client";

import { useState, useMemo } from "react";
import { PARLAY_CONFIG } from "@/lib/config";
import { useParlayConfig } from "@/lib/hooks";

interface MultiplierClimbProps {
  /** Per-leg multipliers (decimal, e.g. 2.5) */
  legMultipliers: number[];
  /** Whether a leg has crashed/failed */
  crashed?: boolean;
  /** How many legs have resolved as Won (drives progressive animation) */
  resolvedUpTo?: number;
  /** Per-leg resolution (won) state, by index */
  resolvedLegs?: boolean[];
}

/** Pick nice gridline values for log scale */
function logGridlines(maxVal: number): number[] {
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  return nice.filter((v) => v > 1 && v < maxVal);
}

/** Pick nice gridline values for linear scale */
function linearGridlines(maxVal: number): number[] {
  const step = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const normalized = maxVal / step;
  const interval =
    normalized <= 2 ? step * 0.5 : normalized <= 5 ? step : step * 2;
  const lines: number[] = [];
  for (let v = interval; v < maxVal; v += interval) {
    lines.push(Math.round(v * 100) / 100);
  }
  return lines.slice(0, 5); // max 5 gridlines
}

/** Dynamic ceiling: next "nice" number above maxVal */
function niceCeiling(maxVal: number, isLog: boolean): number {
  if (isLog) {
    const ceilings = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
    return ceilings.find((c) => c >= maxVal * 1.15) ?? maxVal * 1.5;
  }
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const steps = [1, 1.5, 2, 3, 5, 7.5, 10];
  for (const s of steps) {
    if (s * mag >= maxVal * 1.1) return s * mag;
  }
  return mag * 10;
}

function formatLabel(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(v % 1 === 0 ? 0 : 1);
  return v.toFixed(v % 1 === 0 ? 0 : 1);
}

export function MultiplierClimb({
  legMultipliers,
  crashed = false,
  resolvedUpTo,
  resolvedLegs,
}: MultiplierClimbProps) {
  const [isLog, setIsLog] = useState(true);
  const { maxLegs } = useParlayConfig();
  const effectiveMaxLegs = maxLegs ?? PARLAY_CONFIG.maxLegs;

  const runningMultiplier = useMemo(() => {
    if (legMultipliers.length === 0) return 1;
    return legMultipliers.reduce((acc, m) => acc * m, 1);
  }, [legMultipliers]);

  // Risk color: green -> yellow -> red as legs increase
  const riskLevel = legMultipliers.length / effectiveMaxLegs;
  const color =
    riskLevel <= 0.4
      ? "#22c55e"
      : riskLevel <= 0.7
        ? "#eab308"
        : "#ef4444";

  // Dynamic ceiling based on max multiplier
  const ceiling = useMemo(
    () => niceCeiling(Math.max(runningMultiplier, 2), isLog),
    [runningMultiplier, isLog]
  );

  // Map a multiplier value to Y coordinate (0 = top, 100 = bottom)
  const toY = useMemo(() => {
    const pad = 4;
    if (isLog) {
      const logCeil = Math.log(ceiling);
      return (val: number) => {
        const pct = Math.log(Math.max(val, 1)) / logCeil;
        return (100 - pad) - pct * (100 - 2 * pad);
      };
    }
    return (val: number) => {
      const pct = (val - 1) / (ceiling - 1);
      return (100 - pad) - pct * (100 - 2 * pad);
    };
  }, [ceiling, isLog]);

  // Generate SVG path points
  const points = useMemo(() => {
    const pad = 4;
    const pts: { x: number; y: number }[] = [{ x: pad, y: toY(1) }];
    let cumMultiplier = 1;

    legMultipliers.forEach((m, i) => {
      cumMultiplier *= m;
      const x = pad + ((i + 1) / effectiveMaxLegs) * (100 - 2 * pad);
      pts.push({ x, y: toY(cumMultiplier) });
    });

    return pts;
  }, [legMultipliers, toY, effectiveMaxLegs]);

  // Dynamic gridlines
  const gridlines = useMemo(() => {
    const raw = isLog ? logGridlines(ceiling) : linearGridlines(ceiling);
    // Keep max 4 to avoid clutter
    if (raw.length > 4) {
      const step = Math.ceil(raw.length / 4);
      return raw.filter((_, i) => i % step === 0).slice(0, 4);
    }
    return raw;
  }, [ceiling, isLog]);

  const pathD =
    points.length > 1
      ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`
      : "";

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Big multiplier display */}
      <div
        className={`text-center transition-all duration-500 ${crashed ? "animate-crash" : ""}`}
      >
        <span className="text-sm font-medium uppercase tracking-wider text-gray-500">
          Multiplier
        </span>
        <div
          className="text-5xl font-black tabular-nums transition-colors duration-300"
          style={{ color }}
        >
          {runningMultiplier.toFixed(2)}x
        </div>
      </div>

      {/* Climb visualization */}
      <div className="relative h-44 w-full rounded-xl border border-white/5 bg-gray-900/50">
        {/* Scale toggle slider */}
        <div
          onClick={() => setIsLog((v) => !v)}
          className="absolute right-2 top-2 z-10 flex cursor-pointer items-center rounded-full bg-white/5 p-0.5"
        >
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
              !isLog
                ? "bg-accent-blue/20 text-accent-blue"
                : "text-gray-600"
            }`}
          >
            Lin
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
              isLog
                ? "bg-accent-purple/20 text-accent-purple"
                : "text-gray-600"
            }`}
          >
            Log
          </span>
        </div>

        {/* Y-axis gridlines + labels */}
        {gridlines.map((val) => {
          const pct = ((toY(val) / 100) * 100);
          return (
            <div key={val} className="absolute left-0 right-0" style={{ top: `${pct}%` }}>
              <div className="h-px w-full bg-white/5" />
              <span className="absolute left-1.5 -translate-y-1/2 text-[9px] font-medium text-gray-600">
                {formatLabel(val)}x
              </span>
            </div>
          );
        })}

        {/* 1x baseline label */}
        <span
          className="absolute left-1.5 text-[9px] font-medium text-gray-600"
          style={{ top: `${(toY(1) / 100) * 100}%`, transform: "translateY(-50%)" }}
        >
          1x
        </span>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Gradient fill under the line */}
          {pathD && (
            <>
              <defs>
                <linearGradient
                  id="climbGrad"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${pathD} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`}
                fill="url(#climbGrad)"
                className="transition-all duration-500"
              />
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
                vectorEffect="non-scaling-stroke"
              />
              {/* Dot at the tip */}
              {points.length > 1 && (
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r="3"
                  fill={color}
                  className="animate-pulse-neon"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </>
          )}
        </svg>

        {/* Leg markers */}
        <div className="absolute bottom-2 left-0 flex w-full justify-around px-2">
          {[...Array(effectiveMaxLegs)].map((_, i) => {
            const resolved = resolvedLegs
              ? resolvedLegs[i] ?? false
              : resolvedUpTo !== undefined
                ? i < resolvedUpTo
                : i < legMultipliers.length;
            const isActive = i < legMultipliers.length;
            return (
              <div
                key={i}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  resolved
                    ? "scale-100 bg-neon-green/20 text-neon-green"
                    : isActive
                      ? "scale-100 bg-white/10 text-white"
                      : "scale-75 bg-white/5 text-gray-600"
                }`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Crashed overlay */}
        {crashed && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-red-950/60 backdrop-blur-sm">
            <span className="text-2xl font-black text-neon-red">CRASHED</span>
          </div>
        )}
      </div>
    </div>
  );
}
