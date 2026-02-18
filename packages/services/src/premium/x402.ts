import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { isAddress } from "viem";
import type { Request, Response, NextFunction } from "express";

// Known x402-supported networks and their testnet status
const KNOWN_NETWORKS: Record<string, { name: string; testnet: boolean }> = {
  "eip155:84532": { name: "Base Sepolia", testnet: true },
  "eip155:8453": { name: "Base", testnet: false },
};

// x402 configuration from environment
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Individual gated path constants — add new paths here, then include in X402_GATED_PATHS. */
const PREMIUM_SIM_PATH = "/premium/sim";

/** Paths that require x402 payment. Single source of truth for production + stub. */
const X402_GATED_PATHS = [PREMIUM_SIM_PATH];

function getX402Recipient(): string {
  const raw = process.env.X402_RECIPIENT_WALLET;
  if (!raw) return ZERO_ADDRESS;
  if (!isAddress(raw, { strict: false })) {
    throw new Error(`[x402] Invalid X402_RECIPIENT_WALLET "${raw}" — must be a valid Ethereum address`);
  }
  return raw.toLowerCase();
}

const X402_RECIPIENT = getX402Recipient();
function getX402FacilitatorUrl(): string {
  const raw = process.env.X402_FACILITATOR_URL || "https://facilitator.x402.org";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new Error(`[x402] Invalid X402_FACILITATOR_URL "${raw}" — must be a valid HTTP(S) URL`);
  }
  return raw;
}

const X402_FACILITATOR_URL = getX402FacilitatorUrl();
const X402_PRICE = process.env.X402_PRICE || "$0.01";

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
  X402_GATED_PATHS,
};

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

const { network: X402_NETWORK, testnet: X402_IS_TESTNET } = getX402Network();

/**
 * Create the x402 payment middleware for the premium sim endpoint.
 * In production (NODE_ENV=production): verifies real USDC payment on Base via x402 facilitator.
 * Otherwise (dev, test, staging, or X402_STUB=true): falls back to stub that accepts any non-empty header.
 */
export function createX402Middleware() {
  // Non-production mode or explicit stub override: use stub for local/CI testing
  if (process.env.NODE_ENV !== "production" || process.env.X402_STUB === "true") {
    if (process.env.NODE_ENV === "production" && process.env.X402_STUB === "true") {
      console.warn("[x402] WARNING: X402_STUB=true in production — payment verification is DISABLED");
    }
    if (X402_RECIPIENT === ZERO_ADDRESS) {
      console.warn("[x402] X402_RECIPIENT_WALLET not set — stub 402 responses will omit payTo");
    }
    return x402GuardStub;
  }

  if (X402_RECIPIENT === ZERO_ADDRESS) {
    throw new Error("X402_RECIPIENT_WALLET must be set to a valid non-zero Ethereum address in production");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme());

  const x402Middleware = paymentMiddleware(
    {
      [`POST ${PREMIUM_SIM_PATH}`]: {
        accepts: [
          {
            scheme: "exact",
            price: X402_PRICE,
            network: X402_NETWORK,
            payTo: X402_RECIPIENT,
            maxTimeoutSeconds: 120,
          },
        ],
        description: "ParlayCity premium analytics: win probability, expected value, Kelly criterion",
      },
    },
    resourceServer,
    {
      appName: "ParlayCity",
      testnet: X402_IS_TESTNET,
    },
    undefined,
    false, // don't sync facilitator on startup (avoids blocking)
  );
  return wrapWithPathNormalization(x402Middleware, X402_GATED_PATHS);
}

/**
 * Stub middleware for development/testing.
 * Only intercepts POST /premium/sim. Accepts any non-empty X-402-Payment header.
 */
function x402GuardStub(req: Request, res: Response, next: NextFunction) {
  // Only gate the premium sim endpoint (normalize to prevent trailing-slash / case bypass)
  const normalizedPath = req.path.toLowerCase().replace(/\/+$/, "");
  if (req.method !== "POST" || !X402_GATED_PATHS.includes(normalizedPath)) {
    return next();
  }

  const paymentHeader = req.headers["x-402-payment"];
  if (!paymentHeader || (typeof paymentHeader === "string" && !paymentHeader.trim())) {
    const acceptOption: Record<string, string> = {
      scheme: "exact",
      network: X402_NETWORK,
      asset: "USDC",
      price: X402_PRICE,
    };
    if (X402_RECIPIENT !== ZERO_ADDRESS) {
      acceptOption.payTo = X402_RECIPIENT;
    }
    const accepts = [acceptOption];
    return res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment (USDC on Base)",
      protocol: "x402",
      accepts,
      facilitator: X402_FACILITATOR_URL,
      mode: "stub",
    });
  }
  next();
}

