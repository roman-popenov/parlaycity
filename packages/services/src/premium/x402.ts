import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { isAddress } from "viem";
import type { Request, Response, NextFunction } from "express";

// ── Constants ────────────────────────────────────────────────────────────

// Known x402-supported networks and their testnet status
const KNOWN_NETWORKS: Record<string, { name: string; testnet: boolean }> = {
  "eip155:84532": { name: "Base Sepolia", testnet: true },
  "eip155:8453": { name: "Base", testnet: false },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Individual gated path constants — add new paths here, then include in X402_GATED_PATHS. */
const PREMIUM_SIM_PATH = "/premium/sim";
const RISK_ASSESS_PATH = "/premium/risk-assess";

/** Paths that require x402 payment. Single source of truth for production + stub. */
const X402_GATED_PATHS = [PREMIUM_SIM_PATH, RISK_ASSESS_PATH];

// ── Config getters (all defined before initialization) ───────────────────

function getX402Recipient(): string {
  const raw = process.env.X402_RECIPIENT_WALLET;
  if (!raw) return ZERO_ADDRESS;
  if (!isAddress(raw, { strict: false })) {
    throw new Error(`[x402] Invalid X402_RECIPIENT_WALLET "${raw}" — must be a valid Ethereum address`);
  }
  return raw.toLowerCase();
}

function getX402FacilitatorUrl(): string {
  const raw = process.env.X402_FACILITATOR_URL || "https://facilitator.x402.org";
  let url: URL;
  try {
    url = new URL(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`[x402] Invalid X402_FACILITATOR_URL "${raw}" — failed to parse: ${detail}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`[x402] Invalid X402_FACILITATOR_URL "${raw}" — unsupported protocol "${url.protocol}"`);
  }
  return raw;
}

function getX402Network(): { network: Network; testnet: boolean } {
  const raw = process.env.X402_NETWORK || "eip155:84532";
  const info = KNOWN_NETWORKS[raw];
  if (!info) {
    throw new Error(
      `[x402] Unsupported X402_NETWORK "${raw}". Supported: ${Object.keys(KNOWN_NETWORKS).join(", ")}`,
    );
  }
  return { network: raw as Network, testnet: info.testnet };
}

// ── Resolved config (lazily initialized inside createX402Middleware) ─────

interface X402Config {
  recipient: string;
  facilitatorUrl: string;
  price: string;
  network: Network;
  testnet: boolean;
}

function resolveConfig(): X402Config {
  return {
    recipient: getX402Recipient(),
    facilitatorUrl: getX402FacilitatorUrl(),
    price: process.env.X402_PRICE || "$0.01",
    ...getX402Network(),
  };
}

function resolveConfigSafe(): X402Config {
  let recipient: string;
  try { recipient = getX402Recipient(); } catch { recipient = ZERO_ADDRESS; }

  let facilitatorUrl: string;
  try { facilitatorUrl = getX402FacilitatorUrl(); } catch { facilitatorUrl = "https://facilitator.x402.org"; }

  let network: Network = "eip155:84532" as Network;
  let testnet = true;
  try { ({ network, testnet } = getX402Network()); } catch { /* keep defaults */ }

  return { recipient, facilitatorUrl, price: process.env.X402_PRICE || "$0.01", network, testnet };
}

// ── Utilities ────────────────────────────────────────────────────────────

/**
 * Wraps an Express middleware with path normalization so that case-variant
 * or trailing-slash URLs still match the gated route config.
 * Normalizes req.url for matching POST requests, restores original after.
 */
export function wrapWithPathNormalization(
  inner: (req: Request, res: Response, next: NextFunction) => void,
  gatedPaths: string[],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const normalizedPath = req.path.toLowerCase().replace(/\/+$/, "");
    if (req.method === "POST" && gatedPaths.includes(normalizedPath)) {
      const originalUrl = req.url;
      const queryIndex = originalUrl.indexOf("?");
      const query = queryIndex === -1 ? "" : originalUrl.slice(queryIndex);
      req.url = `${normalizedPath}${query}`;
      return inner(req, res, (err?: unknown) => {
        req.url = originalUrl;
        next(err);
      });
    }
    return inner(req, res, next);
  };
}

// Exported for unit testing
export const _testExports = {
  getX402Recipient,
  getX402Network,
  getX402FacilitatorUrl,
  KNOWN_NETWORKS,
  ZERO_ADDRESS,
  PREMIUM_SIM_PATH,
  RISK_ASSESS_PATH,
  X402_GATED_PATHS,
};

// ── Middleware factory ───────────────────────────────────────────────────

/**
 * Create the x402 payment middleware for all premium endpoints (sim + risk-assess).
 * Gated paths are defined in X402_GATED_PATHS.
 * In production (NODE_ENV=production): verifies real USDC payment on Base via x402 facilitator.
 * Otherwise (dev, test, staging, or X402_STUB=true): falls back to stub that accepts any non-empty header.
 */
export function createX402Middleware() {
  // Non-production mode or explicit stub override: use safe defaults (never crash on import)
  if (process.env.NODE_ENV !== "production" || process.env.X402_STUB === "true") {
    const cfg = resolveConfigSafe();
    if (process.env.NODE_ENV === "production" && process.env.X402_STUB === "true") {
      console.warn("[x402] WARNING: X402_STUB=true in production — payment verification is DISABLED");
    }
    if (cfg.recipient === ZERO_ADDRESS) {
      console.warn("[x402] X402_RECIPIENT_WALLET not set — stub 402 responses will omit payTo");
    }
    return wrapWithPathNormalization(createStub(cfg), X402_GATED_PATHS);
  }

  // Production: fail fast on bad config
  const cfg = resolveConfig();

  if (cfg.recipient === ZERO_ADDRESS) {
    throw new Error("X402_RECIPIENT_WALLET must be set to a valid non-zero Ethereum address in production");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: cfg.facilitatorUrl,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(cfg.network, new ExactEvmScheme());

  const x402Middleware = paymentMiddleware(
    {
      [`POST ${PREMIUM_SIM_PATH}`]: {
        accepts: [
          {
            scheme: "exact",
            price: cfg.price,
            network: cfg.network,
            payTo: cfg.recipient,
            maxTimeoutSeconds: 120,
          },
        ],
        description: "ParlayCity premium analytics: win probability, expected value, Kelly criterion",
      },
      [`POST ${RISK_ASSESS_PATH}`]: {
        accepts: [
          {
            scheme: "exact",
            price: cfg.price,
            network: cfg.network,
            payTo: cfg.recipient,
            maxTimeoutSeconds: 120,
          },
        ],
        description: "ParlayCity risk advisor: Kelly criterion, correlation detection, position sizing",
      },
    },
    resourceServer,
    {
      appName: "ParlayCity",
      testnet: cfg.testnet,
    },
    undefined,
    false, // don't sync facilitator on startup (avoids blocking)
  );
  return wrapWithPathNormalization(x402Middleware, X402_GATED_PATHS);
}

/**
 * Create a stub middleware closure for development/testing.
 * Accepts any non-empty X-402-Payment header. Path normalization
 * is handled by the wrapWithPathNormalization wrapper.
 */
function createStub(cfg: X402Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    // wrapWithPathNormalization already normalized req.path for matching POST
    // requests. Non-matching requests pass through unchanged.
    if (req.method !== "POST" || !X402_GATED_PATHS.includes(req.path)) {
      return next();
    }

    const paymentHeader = req.headers["x-402-payment"];
    if (
      !paymentHeader ||
      Array.isArray(paymentHeader) ||
      !paymentHeader.trim()
    ) {
      const acceptOption: Record<string, string> = {
        scheme: "exact",
        network: cfg.network,
        asset: "USDC",
        price: cfg.price,
      };
      if (cfg.recipient !== ZERO_ADDRESS) {
        acceptOption.payTo = cfg.recipient;
      }
      const accepts = [acceptOption];
      return res.status(402).json({
        error: "Payment Required",
        message: "This endpoint requires x402 payment (USDC on Base)",
        protocol: "x402",
        accepts,
        facilitator: cfg.facilitatorUrl,
        mode: "stub",
      });
    }
    next();
  };
}
