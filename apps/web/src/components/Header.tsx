"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { HelpCircle } from "lucide-react";
import { useFTUE } from "./FTUESpotlight";

const NAV_LINKS = [
  { href: "/", label: "Parlay" },
  { href: "/vault", label: "Vault" },
  { href: "/tickets", label: "My Tickets" },
  { href: "/about", label: "About" },
] as const;

export function Header() {
  const pathname = usePathname();
  const { restart } = useFTUE();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            {/* Logo mark */}
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
              <path
                d="M10 22V10h4.5c1.2 0 2.2.35 2.9 1 .7.65 1.1 1.55 1.1 2.65 0 1.1-.4 2-1.1 2.65-.7.65-1.7 1-2.9 1H13v4.7H10z"
                fill="white"
              />
              <path
                d="M18 22l3.5-6.5L18 10h3l2 4 2-4h3l-3.5 6.5L28 22h-3l-2-4-2 4h-3z"
                fill="white"
                opacity="0.85"
              />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ec4899" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xl font-black tracking-tight">
              <span className="gradient-text">ParlayVoo</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  id={href === "/vault" ? "ftue-vault-link" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "gradient-bg text-white shadow-lg shadow-brand-pink/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={restart}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300"
            title="Replay tutorial"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <div id="ftue-connect-wallet">
            <ConnectKitButton />
          </div>
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            Testnet
          </span>
        </div>
      </div>
    </header>
  );
}
