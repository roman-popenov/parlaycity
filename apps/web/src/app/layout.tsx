import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";
import { DemoBanner } from "@/components/DemoBanner";
import { FTUESpotlight, FTUEProvider } from "@/components/FTUESpotlight";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParlayVoo - Crash-Parlay AMM on Base",
  description:
    "On-chain parlay betting with crash-style cashout. Build multi-leg tickets, ride the multiplier, or be the house.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-gray-200 antialiased">
        {/* Ambient neon glow blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-60 -top-60 h-[700px] w-[700px] rounded-full bg-brand-pink/[0.07] blur-[150px]" />
          <div className="absolute -right-60 top-1/4 h-[600px] w-[600px] rounded-full bg-brand-purple/[0.06] blur-[150px]" />
          <div className="absolute -bottom-60 left-1/3 h-[500px] w-[500px] rounded-full bg-brand-purple-1/[0.04] blur-[130px]" />
        </div>
        <Providers>
          <FTUEProvider>
            <div className="relative z-10">
              <Header />
              <DemoBanner />
              <FTUESpotlight />
              <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                {children}
              </main>
            </div>
          </FTUEProvider>
        </Providers>
      </body>
    </html>
  );
}
