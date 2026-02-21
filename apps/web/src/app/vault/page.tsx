import { VaultDashboard } from "@/components/VaultDashboard";
import { RehabLocks } from "@/components/RehabLocks";

export default function VaultPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span className="gradient-text">Be the House.</span>{" "}
          <span className="text-white">Earn the Edge.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-gray-400">
          Deposit USDC into the vault. Earn yield from parlay fees and when
          bettors lose. The house always has the edge &mdash; now you can be
          the house.
        </p>
      </section>

      <VaultDashboard />

      <RehabLocks />
    </div>
  );
}
