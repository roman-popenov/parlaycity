"use client";

import { Zap, Coins, Trophy } from "lucide-react";

const STEPS = [
  {
    icon: Zap,
    title: "Pick Your Legs",
    description:
      "Choose 2-5 prediction markets and pick Yes or No on each. Each leg multiplies your odds for a bigger payout.",
    color: "text-brand-pink",
    borderColor: "border-brand-pink/20",
    glowColor: "shadow-brand-pink/10",
    bgColor: "from-brand-pink/15 to-brand-pink/5",
  },
  {
    icon: Coins,
    title: "Stake USDC",
    description:
      "Set your stake amount. Your potential payout equals stake times the combined multiplier, minus protocol fees.",
    color: "text-brand-purple-1",
    borderColor: "border-brand-purple/20",
    glowColor: "shadow-brand-purple/10",
    bgColor: "from-brand-purple/15 to-brand-purple/5",
  },
  {
    icon: Trophy,
    title: "Win Big",
    description:
      "Watch your multiplier climb as legs resolve. Cash out early, claim progressive payouts, or ride to full payout.",
    color: "text-brand-gold",
    borderColor: "border-brand-gold/20",
    glowColor: "shadow-brand-gold/10",
    bgColor: "from-brand-gold/15 to-brand-gold/5",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-4xl">
      <h2 className="mb-10 text-center text-2xl font-bold text-white">
        How It <span className="gradient-text">Works</span>
      </h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className={`glass-card relative overflow-hidden border ${step.borderColor} p-6 text-center shadow-lg ${step.glowColor} animate-fade-in-up`}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {/* Watermark number */}
              <div className="pointer-events-none absolute right-3 top-0 select-none text-[6rem] font-black leading-none opacity-[0.04]">
                {i + 1}
              </div>

              {/* Icon */}
              <div
                className={`relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.bgColor}`}
              >
                <Icon className={`h-7 w-7 ${step.color}`} />
              </div>

              <h3 className="mb-2 text-lg font-bold text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
