import { z } from "zod";
import { MAX_LEGS, MIN_LEGS, MIN_STAKE_USDC, USDC_DECIMALS } from "./constants.js";

export const QuoteRequestSchema = z.object({
  legIds: z
    .array(z.number().int().positive())
    .min(MIN_LEGS, `Minimum ${MIN_LEGS} legs required`)
    .max(MAX_LEGS, `Maximum ${MAX_LEGS} legs allowed`),
  outcomes: z
    .array(z.string().min(1))
    .min(MIN_LEGS)
    .max(MAX_LEGS),
  stake: z.string().refine(
    (val) => {
      const n = Number(val);
      return !isNaN(n) && n >= MIN_STAKE_USDC;
    },
    { message: `Stake must be at least ${MIN_STAKE_USDC} USDC` }
  ),
}).refine(
  (data) => data.legIds.length === data.outcomes.length,
  { message: "legIds and outcomes must have the same length" }
);

export const QuoteResponseSchema = z.object({
  legIds: z.array(z.number()),
  outcomes: z.array(z.string()),
  stake: z.string(),
  multiplierX1e6: z.string(),
  potentialPayout: z.string(),
  feePaid: z.string(),
  edgeBps: z.number(),
  probabilities: z.array(z.number()),
  valid: z.boolean(),
  reason: z.string().optional(),
});

export const SimRequestSchema = z.object({
  legIds: z
    .array(z.number().int().positive())
    .min(MIN_LEGS)
    .max(MAX_LEGS),
  outcomes: z.array(z.string().min(1)).min(MIN_LEGS).max(MAX_LEGS),
  stake: z.string().refine(
    (val) => {
      const n = Number(val);
      return !isNaN(n) && n >= MIN_STAKE_USDC;
    },
    { message: `Stake must be at least ${MIN_STAKE_USDC} USDC` }
  ),
  probabilities: z
    .array(z.number().min(0).max(1_000_000))
    .min(MIN_LEGS)
    .max(MAX_LEGS),
}).refine(
  (data) => data.legIds.length === data.outcomes.length && data.legIds.length === data.probabilities.length,
  { message: "legIds, outcomes, and probabilities must have the same length" }
);

export const RiskAssessRequestSchema = z.object({
  legIds: z
    .array(z.number().int().positive())
    .min(MIN_LEGS)
    .max(MAX_LEGS),
  outcomes: z.array(z.string().min(1)).min(MIN_LEGS).max(MAX_LEGS),
  stake: z.string().refine(
    (val) => {
      const n = Number(val);
      return !isNaN(n) && n >= MIN_STAKE_USDC;
    },
    { message: `Stake must be at least ${MIN_STAKE_USDC} USDC` }
  ),
  probabilities: z
    .array(z.number().min(0).max(1_000_000))
    .min(MIN_LEGS)
    .max(MAX_LEGS),
  bankroll: z.string().refine(
    (val) => {
      const n = Number(val);
      return !isNaN(n) && n > 0;
    },
    { message: "Bankroll must be positive" }
  ),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  categories: z.array(z.string()).optional(),
}).refine(
  (data) => data.legIds.length === data.outcomes.length && data.legIds.length === data.probabilities.length,
  { message: "legIds, outcomes, and probabilities must have the same length" }
);

export function parseQuoteRequest(data: unknown) {
  return QuoteRequestSchema.safeParse(data);
}

export function parseSimRequest(data: unknown) {
  return SimRequestSchema.safeParse(data);
}

export function parseRiskAssessRequest(data: unknown) {
  return RiskAssessRequestSchema.safeParse(data);
}

// Re-export USDC parse helper
export function parseUSDC(amount: string): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0] ?? "0") * BigInt(10 ** USDC_DECIMALS);
  if (parts.length === 1) return whole;
  const fracStr = (parts[1] ?? "").padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return whole + BigInt(fracStr);
}

export function formatUSDC(raw: bigint): string {
  const divisor = BigInt(10 ** USDC_DECIMALS);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
