# Claim Ledger -- Verified Claims & Sources

Every statistical claim used in ParlayCity narrative materials, verified and sourced. Use this as the single source of truth for pitches, docs, and bounty applications.

---

## Claim Table

| # | Claim | Recommended Phrasing | Source | Confidence | Notes |
|---|-------|---------------------|--------|------------|-------|
| 1 | Aviator wager volume | "Aviator processes $14B+ in monthly wagers (Dec 2024)" | SBC News, Dec 2024 | HIGH | Originally cited as "$14B/yr" -- actually $14B/MONTH. Correct all references. |
| 2 | Aviator monthly active users | "Aviator has 42-77M monthly active users (2025)" | Industry reports, Spribe analytics | MED | Originally "12M MAU" -- outdated. Range reflects different measurement methodologies. |
| 3 | Crash game market growth | "Crash games grew from 5% to 58% content share in online casinos (Eilers & Krejcik 2024)" | Eilers & Krejcik Gaming report, 2024 | MED | Original "40% YoY" claim had NO verifiable source. Replaced with sourced figure. |
| 4 | Parlay share of US sportsbook revenue | "Parlays account for 56-72% of US sportsbook revenue" | Nevada Gaming Control Board + industry analysis (multiple reports) | HIGH | Range is defensible. Lower bound from NGCB data, upper bound from industry analysis. |
| 5 | Traditional sportsbook parlay vig | "DraftKings/FanDuel embed 17-35% vig into parlay odds" | Academic papers + standard parlay math | HIGH | Well-established. The vig compounds per leg: each leg has ~4.5% vig, 4-leg parlay = ~19% total. |
| 6 | GMX GLP returns | "GMX GLP has generated ~25% APR from trading fees" | GMX docs, DeFi Llama | HIGH | Historical average. Variable. Specify "peak" or "historical average" when citing. |
| 7 | Hyperliquid HLP returns | "Hyperliquid HLP: 42% CAGR lifetime, 450% cumulative return" | HLP dashboard (publicly verifiable on-chain) | HIGH | Verifiable on-chain. Strong comp for vault-as-counterparty model. |
| 8 | Overtime Markets Y1 returns | "Overtime Markets LPs earned 106% cumulative return in year one on Arbitrum" | Overtime blog + Thales protocol data | MED | Arbitrum-specific. Partly boosted by THALES token incentives. Add caveat when citing. |
| 9 | Gains Network gDAI returns | "Gains Network gDAI: 10-20% variable APR" | Gains Network docs | HIGH | Variable, well-documented. Conservative comp. |
| 10 | Azuro LP yield probability | "Azuro LPs have >95% probability of positive yield for positions held >1 month" | Azuro analytics dashboard | MED | Based on their published data. Needs independent verification for academic rigor. |
| 11 | Overtime bootstrapping | "Overtime Markets bootstrapped with 100K sUSD, generated $8.7M volume and +$230K profit" | Overtime launch blog post | HIGH | Documented in their announcement. Strong precedent for protocol-seeded vaults. |
| 12 | ParlayCity unique primitives | "No other protocol combines crash-parlay cashout + non-extractive fee routing + social impact + unified vault" | Our competitive research (verified Feb 2026) | HIGH | Verified against Kalshi, Azuro, Overtime, ParlayMarket, PredictShark, Polymarket. |
| 13 | Polymarket user base | "Polymarket has ~314K monthly active traders (30M registered accounts)" | Polymarket public data | MED | Distinguish between registered accounts (30M) and monthly active traders (~314K MAT). |
| 14 | Structural house edge on parlays | "Parlay house edge is structural: P(all legs win) compounds against the bettor" | Probability theory (mathematical fact) | HIGH | Not a claim -- a mathematical identity. 3-leg parlay at 40%/leg = 6.4% hit rate. |
| 15 | Permissionless settlement | "Anyone can call settleTicket() -- no keeper dependency, no access control" | ParlayEngine.sol source code | HIGH | Verified in code. `settleTicket()` has no `onlyOwner` or role-based modifier. |

---

## Claims That Need Correction

### Claim #1: Aviator Wager Volume
- **Wrong:** "$14B/yr in wagers"
- **Right:** "$14B+ in monthly wagers (Dec 2024)"
- **Impact:** The correct figure is even more impressive. Update everywhere.

### Claim #2: Aviator MAU
- **Wrong:** "12M MAU"
- **Right:** "42-77M MAU (2025 estimates)"
- **Impact:** Dramatically understated. Update everywhere.

### Claim #3: Crash Game Growth
- **Wrong:** "40% YoY crash game growth"
- **Right:** "Crash games grew from 5% to 58% content share (Eilers & Krejcik 2024)"
- **Impact:** Original had no source. New phrasing is sourced and defensible.

### Claim #8: Overtime Returns (Add Caveat)
- **Add:** "on Arbitrum, partly boosted by THALES token incentives"
- **Impact:** Minor. Still a strong comp, just needs honest framing.

### Claim #13: Polymarket Users (Clarify)
- **Clarify:** Distinguish "30M registered" from "~314K monthly active traders"
- **Impact:** Prevents judges from questioning our research rigor.

---

## How to Use This Ledger

1. Before using any number in a pitch, slides, or doc -- check it here first.
2. Use the "Recommended Phrasing" column for exact wording.
3. HIGH confidence claims can be stated as facts. MED claims should include hedging language ("approximately", "estimated", "according to X"). LOW claims should not be used without additional verification.
4. When judges ask "where did you get that number?" -- the Source column is your answer.
