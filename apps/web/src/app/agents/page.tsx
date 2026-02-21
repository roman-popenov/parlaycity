"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bot,
  Wallet,
  Fuel,
  Activity,
  ExternalLink,
  RefreshCw,
  Layers,
  Ticket,
  DollarSign,
  Zap,
  Search,
  Shield,
  TrendingUp,
} from "lucide-react";

interface AgentTx {
  hash: string;
  method: string;
  gasUsed: string;
  gasCost: string;
  timestamp: number;
  status: string;
  to: string;
}

interface AgentStats {
  wallet: string;
  ethBalance: string;
  usdcBalance: string;
  legCount: number;
  ticketCount: number;
  totalGasSpentEth: string;
  recentTxs: AgentTx[];
  contracts: Record<string, string | null>;
  chainId: number;
  timestamp: number;
}

const BASESCAN_URL = "https://sepolia.basescan.org";

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatGas(eth: string): string {
  const val = parseFloat(eth);
  if (val === 0) return "0";
  if (val < 0.000001) return "<0.000001 ETH";
  return `${val.toFixed(6)} ETH`;
}

export default function AgentsPage() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AgentStats;
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative pt-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-purple/20 bg-brand-purple/5 px-4 py-1.5 text-xs font-medium text-brand-purple-1">
          <Bot className="h-3 w-3" />
          Base Agents &middot; Autonomous &middot; On-Chain
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
          <span className="gradient-text">Agent Dashboard</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-gray-400">
          Real-time performance metrics for ParlayVoo&apos;s autonomous on-chain
          agents. No login required.
        </p>
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-5 w-5 text-brand-pink" />}
          label="Agent ETH Balance"
          value={stats ? `${parseFloat(stats.ethBalance).toFixed(4)} ETH` : "--"}
          link={stats ? `${BASESCAN_URL}/address/${stats.wallet}` : undefined}
          loading={loading}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-neon-green" />}
          label="Agent USDC Balance"
          value={stats ? `${parseFloat(stats.usdcBalance).toLocaleString()} USDC` : "--"}
          loading={loading}
        />
        <StatCard
          icon={<Fuel className="h-5 w-5 text-brand-gold" />}
          label="Total Gas Spent"
          value={stats ? formatGas(stats.totalGasSpentEth) : "--"}
          loading={loading}
        />
        <StatCard
          icon={<Layers className="h-5 w-5 text-brand-purple-1" />}
          label="Legs Registered"
          value={stats ? String(stats.legCount) : "--"}
          loading={loading}
        />
      </section>

      {/* Agent Activity */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Market Discovery Agent */}
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-pink/20 to-transparent">
              <Search className="h-5 w-5 text-brand-pink" />
            </div>
            <div>
              <h3 className="font-bold text-white">Market Discovery Agent</h3>
              <p className="text-xs text-gray-500">
                Discovers NBA games, registers legs, resolves outcomes
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Markets Registered</span>
              <span className="text-sm font-bold text-white">
                {stats?.legCount ?? "--"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Data Source</span>
              <span className="text-sm font-bold text-brand-pink">
                BallDontLie API
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Resolution</span>
              <span className="text-sm font-bold text-neon-green">
                Automatic (game scores)
              </span>
            </div>
          </div>
        </div>

        {/* Settler Bot */}
        <div className="glass-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon-green/20 to-transparent">
              <Zap className="h-5 w-5 text-neon-green" />
            </div>
            <div>
              <h3 className="font-bold text-white">Settler Bot</h3>
              <p className="text-xs text-gray-500">
                Permissionless ticket settlement, releases vault reserves
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Tickets in System</span>
              <span className="text-sm font-bold text-white">
                {stats?.ticketCount ?? "--"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Settlement</span>
              <span className="text-sm font-bold text-neon-green">
                Permissionless
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-gray-400">Poll Interval</span>
              <span className="text-sm font-bold text-gray-300">10s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section>
        <h2 className="mb-6 text-center text-2xl font-bold text-white">
          Self-Sustaining <span className="gradient-text">Revenue Model</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: DollarSign,
              title: "x402 API Revenue",
              desc: "Premium endpoints charge USDC per call. External agents pay for risk analysis.",
              color: "text-brand-pink",
              bg: "from-brand-pink/10 to-transparent",
            },
            {
              icon: TrendingUp,
              title: "Fee Routing (90/5/5)",
              desc: "90% to LP lockers, 5% to vault, 5% to safety module. Every bet generates protocol revenue.",
              color: "text-neon-green",
              bg: "from-neon-green/10 to-transparent",
            },
            {
              icon: Search,
              title: "Market Making",
              desc: "Agent discovers and registers markets, enabling bets and fee collection. Value creation is indirect but measurable.",
              color: "text-brand-purple-1",
              bg: "from-brand-purple/10 to-transparent",
            },
            {
              icon: Shield,
              title: "Settlement Service",
              desc: "Settler bot releases vault reserves, maintaining protocol health and enabling more bets (more fees).",
              color: "text-brand-gold",
              bg: "from-brand-gold/10 to-transparent",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="glass-card p-5 text-center animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.bg}`}
                >
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="mb-1 text-sm font-bold text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-500">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            Recent Agent Transactions
          </h2>
          <button
            onClick={() => {
              setLoading(true);
              fetchStats();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-neon-red/20 bg-neon-red/5 p-3 text-sm text-neon-red">
            {error}
          </div>
        )}

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Tx Hash</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Gas Cost</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && !stats ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      <Activity className="mx-auto mb-2 h-5 w-5 animate-pulse" />
                      Loading agent transactions...
                    </td>
                  </tr>
                ) : stats?.recentTxs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  stats?.recentTxs.map((tx) => (
                    <tr
                      key={tx.hash}
                      className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={`${BASESCAN_URL}/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-mono text-xs text-brand-pink hover:underline"
                        >
                          {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-gray-300">
                          {tx.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {formatGas(tx.gasCost)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {timeAgo(tx.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            tx.status === "success"
                              ? "bg-neon-green/10 text-neon-green"
                              : "bg-neon-red/10 text-neon-red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="mx-auto max-w-2xl">
        <div className="glass-card p-8 text-center">
          <h2 className="mb-4 text-xl font-bold text-white">
            Explore <span className="gradient-text">On-Chain</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {stats?.wallet && (
              <a
                href={`${BASESCAN_URL}/address/${stats.wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <Wallet className="h-4 w-4" /> Agent Wallet
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {stats?.contracts.parlayEngine && (
              <a
                href={`${BASESCAN_URL}/address/${stats.contracts.parlayEngine}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <Ticket className="h-4 w-4" /> ParlayEngine
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {stats?.contracts.legRegistry && (
              <a
                href={`${BASESCAN_URL}/address/${stats.contracts.legRegistry}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <Layers className="h-4 w-4" /> LegRegistry
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Link
              href="/about"
              className="flex items-center gap-1.5 rounded-lg border border-brand-pink/20 bg-brand-pink/5 px-4 py-2 text-sm text-brand-pink transition-all hover:bg-brand-pink/10"
            >
              Learn More
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-600">
            Builder code: <code className="text-gray-400">parlayvoo</code>{" "}
            (ERC-8021 attribution on every tx)
          </p>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  link,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
  loading: boolean;
}) {
  const content = (
    <div className="glass-card flex flex-col items-center p-5 text-center transition-all hover:bg-white/[0.04]">
      <div className="mb-2">{icon}</div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold text-white ${loading ? "animate-pulse" : ""}`}
      >
        {value}
      </p>
    </div>
  );

  if (link) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}
