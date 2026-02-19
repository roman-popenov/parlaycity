import { useState, useEffect, useCallback } from "react";
import type { TicketStatus } from "@/components/TicketCard";

/**
 * Sanitize numeric input: strips non-digit/dot characters, limits to one
 * decimal point. Safety net for paste, autofill, and drag-drop -- the
 * primary guard is blockNonNumericKeys on keydown.
 */
export function sanitizeNumericInput(value: string): string {
  let sanitized = value.replace(/[^\d.]/g, "");
  const parts = sanitized.split(".");
  if (parts.length > 2) {
    sanitized = parts[0] + "." + parts.slice(1).join("");
  }
  return sanitized;
}

/** Allowed non-character keys for numeric inputs. */
const ALLOWED_KEYS = new Set([
  "Backspace", "Delete", "Tab", "Enter", "Escape",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End",
]);

/**
 * onKeyDown handler that blocks non-numeric keys at the keyboard level.
 * Allows: digits, single decimal point, navigation, and Ctrl/Cmd shortcuts.
 */
export function blockNonNumericKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  // Allow modifier shortcuts (Ctrl+A/C/V/X, Cmd+A/C/V/X)
  if (e.metaKey || e.ctrlKey) return;
  // Allow navigation and control keys
  if (ALLOWED_KEYS.has(e.key)) return;
  // Allow digits
  if (/^\d$/.test(e.key)) return;
  // Allow one decimal point (block if one already exists)
  if (e.key === ".") {
    if (e.currentTarget.value.includes(".")) e.preventDefault();
    return;
  }
  // Block everything else (letters, 'e', '+', '-', etc.)
  e.preventDefault();
}

export function mapStatus(statusCode: number): TicketStatus {
  switch (statusCode) {
    case 0: return "Active";
    case 1: return "Won";
    case 2: return "Lost";
    case 3: return "Voided";
    case 4: return "Claimed";
    default: return "Active";
  }
}

export function parseOutcomeChoice(outcome: `0x${string}`): number {
  try {
    const value = Number(BigInt(outcome));
    return value === 1 || value === 2 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * useState that persists to sessionStorage. SSR-safe: uses defaultValue for
 * server render, restores from storage on first client effect (avoids hydration
 * mismatch). Writes are synchronous via useEffect on value change.
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T,
  serialize: (v: T) => string = JSON.stringify,
  deserialize: (s: string) => T = JSON.parse,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  // Restore from sessionStorage on mount (client only, runs once)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        setValue(deserialize(stored));
      }
    } catch {
      // sessionStorage unavailable or parse error — keep default
    }
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to sessionStorage on change (skip the initial hydration write)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(key, serialize(value));
    } catch {
      // storage full or unavailable — silently ignore
    }
  }, [key, value, hydrated, serialize]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValue];
}

/**
 * Clears a sessionStorage key. Useful after successful actions (e.g., buy ticket)
 * to prevent restoring stale inputs on next visit.
 */
export function clearSessionState(...keys: string[]): void {
  try {
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
