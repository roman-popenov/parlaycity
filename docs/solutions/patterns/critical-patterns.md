# Critical Patterns -- Required Reading

Every agent and developer MUST follow these patterns before writing code. Each pattern was discovered through repeated bugs across multiple modules.

---

## 1. Clamp After Rounding for Schema-Bounded Integers (ALWAYS REQUIRED)

### WRONG (Will cause API 400 rejection)
```typescript
const prob = 1 / effectiveOdds(leg, outcomeChoice);
return Math.round(prob * 1_000_000);
// Produces 0 for tiny probabilities, 1_000_000 for near-1 probabilities
// Both rejected by z.number().int().min(1).max(999_999)
```

### CORRECT
```typescript
const prob = 1 / effectiveOdds(leg, outcomeChoice);
const scaled = Math.round(prob * 1_000_000);
return Math.min(999_999, Math.max(1, scaled));
```

**Why:** `Math.round()` can land exactly on boundary values (0 or 1,000,000) for extreme inputs. Zod schemas enforce strict `[min, max]` ranges. Without clamping, edge-case values silently fail API validation.

**Placement/Context:** Every float-to-integer conversion sent to an API with a bounded schema. Always clamp AFTER rounding, never before.

**Documented in:** `docs/solutions/logic-errors/probability-rounding-boundary-ParlayBuilder-20260220.md`

---

## 2. Three-Case BigInt Guard at API Boundaries (ALWAYS REQUIRED)

### WRONG (Will send "0" to APIs that reject <= 0)
```typescript
// Attempt 1: truthiness -- treats 0n as missing
bankroll: usdcBalance ? formatUnits(usdcBalance, 6) : "100",

// Attempt 2: existence -- passes for 0n, but formatUnits(0n, 6) = "0" which API rejects
bankroll: usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : "100",
```

### CORRECT
```typescript
bankroll:
  usdcBalance !== undefined && usdcBalance > 0n
    ? formatUnits(usdcBalance, 6)
    : "100",
```

**Why:** BigInt `0n` is falsy in JavaScript AND produces `"0"` when formatted, which APIs with `> 0` constraints reject. There are THREE states to distinguish: `undefined` (not loaded), `0n` (valid zero), and positive (convert and send). This bug appeared 4+ times across PRs #10, #12, #14 (lessons #8, #12, #17, #21).

**Placement/Context:** Every API call that derives values from BigInt state. Test with `undefined`, `0n`, and a positive value.

**Documented in:** `docs/solutions/logic-errors/zero-bigint-api-boundary-ParlayBuilder-20260219.md`

---
