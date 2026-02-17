"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              ParlayCity
            </span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link
              href="/"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Parlay
            </Link>
            <Link
              href="/vault"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Vault
            </Link>
            <Link
              href="/tickets"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              My Tickets
            </Link>
          </nav>
        </div>
        <ConnectKitButton />
      </div>
    </header>
  );
}
