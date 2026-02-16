import type { Request, Response, NextFunction } from "express";

/**
 * x402 payment-required middleware stub.
 * In production: verify onchain payment via x402 protocol.
 * In demo: accept any non-empty X-402-Payment header.
 */
export function x402Guard(req: Request, res: Response, next: NextFunction) {
  const paymentHeader = req.headers["x-402-payment"];
  if (!paymentHeader) {
    return res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment",
      accepts: "USDC on Base",
    });
  }
  // In production: verify payment onchain
  // In demo: accept any non-empty header
  next();
}
