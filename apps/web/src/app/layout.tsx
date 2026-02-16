import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "ParlayCity - Build Your Parlay",
  description:
    "On-chain parlay betting on Base. Build multi-leg tickets, ride the multiplier, or become the house.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-gray-200 antialiased">
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
