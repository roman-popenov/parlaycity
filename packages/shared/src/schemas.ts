import { z } from "zod";
import { MAX_LEGS, MIN_LEGS, MIN_STAKE_USDC, USDC_DECIMALS } from "./constants.js";

// Strict plain-decimal matcher: digits with optional single dot.
// Rejects scientific notation (1e2), sign prefixes (+10), whitespace,
// hex/octal/binary — all of which Number() accepts but parseUSDC/BigInt cannot.
const DECIMAL_RE = /^\d+(?:\.\d*)?$/;

/** Parse a strict decimal string. Only plain "123" or "12.34" accepted. */
function parseDecimal(val: string): number {
  if (!DECIMAL_RE.test(val)) return NaN;
  return Number(val);
}

// Shared base: legIds + outcomes + stake (used by Quote, Sim, RiskAssess)
const QuoteBaseSchema = z.object({
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
      const n = parseDecimal(val);
      return Number.isFinite(n) && n >= MIN_STAKE_USDC;
    },
    { message: `Stake must be at least ${MIN_STAKE_USDC} USDC` }
  ),
});

export const QuoteRequestSchema = QuoteBaseSchema.refine(
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

// Extends shared base with probabilities for sim + risk-assess schemas
const LegProbBaseSchema = QuoteBaseSchema.extend({
  probabilities: z
    .array(z.number().int().min(1).max(999_999))
    .min(MIN_LEGS)
    .max(MAX_LEGS),
});

const legLengthsMatch = (data: z.infer<typeof LegProbBaseSchema>) =>
  data.legIds.length === data.outcomes.length && data.legIds.length === data.probabilities.length;

export const SimRequestSchema = LegProbBaseSchema.refine(legLengthsMatch, {
  message: "legIds, outcomes, and probabilities must have the same length",
});

export const RiskAssessRequestSchema = LegProbBaseSchema.extend({
  bankroll: z.string().refine(
    (val) => {
      const n = parseDecimal(val);
      return Number.isFinite(n) && n > 0;
    },
    { message: "Bankroll must be a finite positive number" }
  ),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  categories: z.array(z.string().regex(/^[\w\s\-./]+$/, "Category must contain only alphanumeric, underscore, space, hyphen, dot, or slash")).optional(),
}).refine(legLengthsMatch, {
  message: "legIds, outcomes, and probabilities must have the same length",
}).refine(
  (data) => !data.categories || data.categories.length === data.legIds.length,
  { message: "categories must have the same length as legIds when provided" },
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
