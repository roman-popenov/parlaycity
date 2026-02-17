import { VaultDashboard } from "@/components/VaultDashboard";

export default function VaultPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="bg-gradient-to-r from-accent-purple to-accent-blue bg-clip-text text-transparent">
            Be the House.
          </span>{" "}
          <span className="text-white">Earn the Edge.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-400">
          Deposit USDC into the vault. Earn yield from parlay fees and when
          bettors lose. The house always has the edge &mdash; now you can be
          the house.
        </p>
      </section>

      <VaultDashboard />

      {/* Explainer */}
      <section className="mx-auto max-w-3xl rounded-2xl border border-white/5 bg-gray-900/30 p-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Vault Mechanics
        </h2>
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-accent-blue">
              &bull;
            </span>
            Deposits earn a pro-rata share of all fees collected from parlay
            ticket purchases.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-accent-purple">
              &bull;
            </span>
            The vault underwrites potential payouts. Reserved liquidity backs
            active tickets.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-neon-green">
              &bull;
            </span>
            Withdrawals are available up to the unreserved balance (max 80%
            utilization cap).
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 font-bold text-neon-yellow">
              &bull;
            </span>
            When bettors lose, their stakes flow to the vault &mdash; increasing
            share value for all depositors.
          </li>
        </ul>
      </section>
    </div>
  );
}
