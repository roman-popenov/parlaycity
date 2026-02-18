import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import type { Request, Response, NextFunction } from "express";

// x402 configuration from environment
const X402_RECIPIENT = process.env.X402_PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000000";
const X402_NETWORK: Network = (process.env.X402_NETWORK || "eip155:84532") as Network; // Base Sepolia
const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://facilitator.x402.org";
const X402_PRICE = process.env.X402_PRICE || "$0.01"; // Price per request

/**
 * Create the x402 payment middleware for the premium sim endpoint.
 * In production: verifies real USDC payment on Base via x402 facilitator.
 * In development (NODE_ENV=development): falls back to stub that accepts any non-empty header.
 */
export function createX402Middleware() {
  // Development/test mode: use stub for local testing
  if (process.env.NODE_ENV !== "production" || process.env.X402_STUB === "true") {
    return x402GuardStub;
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme());

  return paymentMiddleware(
    {
      "POST /premium/sim": {
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
      testnet: X402_NETWORK === "eip155:84532",
    },
    undefined,
    false, // don't sync facilitator on startup (avoids blocking)
  );
}

/**
 * Stub middleware for development/testing.
 * Only intercepts POST /premium/sim. Accepts any non-empty X-402-Payment header.
 */
function x402GuardStub(req: Request, res: Response, next: NextFunction) {
  // Only gate the premium sim endpoint (normalize to prevent trailing-slash / case bypass)
  const normalizedPath = req.path.toLowerCase().replace(/\/+$/, "");
  if (req.method !== "POST" || normalizedPath !== "/premium/sim") {
    return next();
  }

  const paymentHeader = req.headers["x-402-payment"];
  if (!paymentHeader) {
    return res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment (USDC on Base)",
      protocol: "x402",
      accepts: {
        scheme: "exact",
        network: X402_NETWORK,
        asset: "USDC",
        price: X402_PRICE,
        payTo: X402_RECIPIENT,
      },
      facilitator: X402_FACILITATOR_URL,
      mode: "stub",
    });
  }
  next();
}

