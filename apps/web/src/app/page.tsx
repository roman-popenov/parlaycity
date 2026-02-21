import { ParlayBuilder } from "@/components/ParlayBuilder";

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Build Your <span className="gradient-text">Parlay</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-gray-400">
          Pick your legs, set your stake, and ride the multiplier. Cash out early or go for the full payout.
        </p>
      </section>

      {/* Builder */}
      <ParlayBuilder />
    </div>
  );
}
