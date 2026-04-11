"use client";

import { useEffect, useState } from "react";

interface RpcCall {
  method: string;
  ts: number;
}

declare global {
  interface Window {
    __rpcCalls?: RpcCall[];
  }
}

export function DebugRpcCounter() {
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState({ total: 0, lastMin: 0, perMin: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const calls = window.__rpcCalls ?? [];
      const now = Date.now();
      const lastMin = calls.filter((c) => now - c.ts < 60_000).length;
      const last10s = calls.filter((c) => now - c.ts < 10_000).length;
      setStats({ total: calls.length, lastMin, perMin: last10s * 6 });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] pointer-events-none rounded border border-green-400 bg-black/85 px-3 py-2 font-mono text-xs text-green-400">
      <div>RPC total: {stats.total}</div>
      <div>last 60s: {stats.lastMin}</div>
      <div>rate (extrap): {stats.perMin}/min</div>
    </div>
  );
}
