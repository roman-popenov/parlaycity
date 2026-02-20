/**
 * Shared env-loading utilities for agent scripts.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Parse apps/web/.env.local into a key-value record.
 * Returns empty record if file is missing or unreadable.
 */
export function loadEnvLocal(): Record<string, string> {
  // Walk up from scripts/ to repo root, then into apps/web
  const envPath = resolve(__dirname, "../../apps/web/.env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      vars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

/**
 * Guard: when RPC_URL points to a non-local network, PRIVATE_KEY must be
 * explicitly provided. Prevents accidentally broadcasting with Anvil keys
 * on a real chain.
 */
export function requireExplicitKeyForRemoteRpc(rpcUrl: string): void {
  const isLocal =
    rpcUrl.includes("127.0.0.1") ||
    rpcUrl.includes("localhost") ||
    rpcUrl.includes("0.0.0.0");

  if (!isLocal && !process.env.PRIVATE_KEY) {
    throw new Error(
      `RPC_URL points to a remote network (${rpcUrl}) but PRIVATE_KEY is not set. ` +
        "Refusing to use default Anvil key on a non-local chain. " +
        "Set PRIVATE_KEY explicitly.",
    );
  }
}

/**
 * Parse a numeric env var with NaN guard and fallback.
 */
export function safeParseNumber(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.warn(`[env] ${name}="${raw}" is not a valid number, using default ${fallback}`);
    return fallback;
  }
  return n;
}

/**
 * Safe BigInt -> Number conversion. Throws if the value exceeds
 * Number.MAX_SAFE_INTEGER.
 */
export function safeBigIntToNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds Number.MAX_SAFE_INTEGER: ${value}`);
  }
  return Number(value);
}
