"use client";

import { useState, useEffect } from "react";

interface DemoHintProps {
  sessionKey: string;
  step: number;
  message: string;
  visible: boolean;
}

export function DemoHint({ sessionKey, step, message, visible }: DemoHintProps) {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored === "true") setDismissed(true);
    } catch {
      // sessionStorage unavailable
    }
    setHydrated(true);
  }, [sessionKey]);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(sessionKey, "true");
    } catch {
      // sessionStorage unavailable
    }
  };

  if (!hydrated || !visible || dismissed) return null;

  return (
    <div
      data-testid={`demo-hint-${step}`}
      className="flex items-start gap-3 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3 animate-fade-in"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-pink/20 text-xs font-bold text-brand-pink">
        {step}
      </span>
      <p className="flex-1 text-sm text-gray-300">{message}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-gray-500 transition-colors hover:text-gray-300"
        aria-label="Dismiss hint"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
