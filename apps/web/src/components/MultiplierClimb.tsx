"use client";

import { useMemo } from "react";
import { PARLAY_CONFIG } from "@/lib/config";

interface MultiplierClimbProps {
  /** Per-leg multipliers (decimal, e.g. 2.5) */
  legMultipliers: number[];
  /** Whether a leg has crashed/failed */
  crashed?: boolean;
}

export function MultiplierClimb({
  legMultipliers,
  crashed = false,
}: MultiplierClimbProps) {
  const runningMultiplier = useMemo(() => {
    if (legMultipliers.length === 0) return 1;
    return legMultipliers.reduce((acc, m) => acc * m, 1);
  }, [legMultipliers]);

  // Risk color: green -> yellow -> red as legs increase
  const riskLevel = legMultipliers.length / PARLAY_CONFIG.maxLegs;
  const color =
    riskLevel <= 0.4
      ? "#22c55e"
      : riskLevel <= 0.7
        ? "#eab308"
        : "#ef4444";

  // Generate SVG path points for the climb
  const points = useMemo(() => {
    const pts: { x: number; y: number }[] = [{ x: 0, y: 100 }];
    let cumMultiplier = 1;

    legMultipliers.forEach((m, i) => {
      cumMultiplier *= m;
      const x = ((i + 1) / PARLAY_CONFIG.maxLegs) * 100;
      // Map multiplier to height: 1x = bottom, higher = higher
      const y = Math.max(5, 100 - Math.min(cumMultiplier * 15, 95));
      pts.push({ x, y });
    });

    return pts;
  }, [legMultipliers]);

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
      <div className="relative h-40 w-full overflow-hidden rounded-xl border border-white/5 bg-gray-900/50">
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px w-full bg-white"
              style={{ top: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>

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
                d={`${pathD} L ${points[points.length - 1].x} 100 L 0 100 Z`}
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
          {[...Array(PARLAY_CONFIG.maxLegs)].map((_, i) => (
            <div
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                i < legMultipliers.length
                  ? "scale-100 bg-white/10 text-white"
                  : "scale-75 bg-white/5 text-gray-600"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Crashed overlay */}
        {crashed && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60 backdrop-blur-sm">
            <span className="text-2xl font-black text-neon-red">CRASHED</span>
          </div>
        )}
      </div>
    </div>
  );
}
