import { ParlayBuilder } from "@/components/ParlayBuilder";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-blue bg-clip-text text-transparent">
            Build Your Parlay.
          </span>
          <br />
          <span className="text-white">Ride the Multiplier.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-400">
          Pick your legs, stack the odds, and watch your multiplier climb.
          Fully on-chain parlay tickets on Base.
        </p>
      </section>

      {/* Builder */}
      <ParlayBuilder />

      {/* Explainer */}
      <section className="mx-auto max-w-3xl rounded-2xl border border-white/5 bg-gray-900/30 p-8">
        <h2 className="mb-4 text-lg font-semibold text-white">
          How It Works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <div className="mb-2 text-2xl font-black text-accent-blue">1</div>
            <h3 className="mb-1 font-semibold text-white">Pick Legs</h3>
            <p className="text-sm text-gray-400">
              Choose 2-5 events and pick Yes/No on each. Each leg multiplies
              your odds.
            </p>
          </div>
          <div>
            <div className="mb-2 text-2xl font-black text-accent-purple">2</div>
            <h3 className="mb-1 font-semibold text-white">Stake USDC</h3>
            <p className="text-sm text-gray-400">
              Set your stake. Your potential payout is stake times the combined
              multiplier.
            </p>
          </div>
          <div>
            <div className="mb-2 text-2xl font-black text-neon-green">3</div>
            <h3 className="mb-1 font-semibold text-white">Win Big</h3>
            <p className="text-sm text-gray-400">
              All legs must hit for a payout. Higher risk, higher reward.
              Settle and claim on-chain.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
