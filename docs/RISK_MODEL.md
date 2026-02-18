# ParlayCity Risk Model

## Level 0 (MVP -- partially implemented)

- Worst-case liability per ticket: `potentialPayout` reserved 1:1 in vault
- Global cap: `totalReserved <= maxUtilizationBps * totalAssets()` (currently 80%)
- Per-ticket cap: `potentialPayout <= maxPayoutBps * totalAssets()` (currently 5%)
- MISSING: per-market exposure caps, utilization-based pricing

## Level 1 (Hackathon stretch)

- Per-market caps: `perMarketExposure[marketId] <= perMarketCapBps * totalAssets()`
- Risk premium: `riskPremiumBps = f(utilization, perMarketExposure, size)` -- monotonic, bounded
- Utilization-based pricing replaces hard caps: `edgeBps = baseEdge + utilizationPremium(stake, exposures)`
- "Price impact" framing, NOT "cap" framing -- users see odds slide, not a rejection

## Level 2 (Post-hackathon)

- Correlation groups with `corrDiscount` for correlated legs
- Scenario VaR / Monte Carlo across binary claims

## RiskConfig Struct (future on-chain)

```
maxUtilizationBps   = 8000   // 80%
perMarketCapBps     = 2000   // 20%
perGroupCapBps      = 3000   // 30%
maxLegs             = 5
minEdgeBps          = 100
maxEdgeBps          = 2000
utilizationK        = TBD    // curve parameter
rfqThreshold        = TBD    // stake above which RFQ lane activates
```

## Utilization Curve Design

The pricing function should be convex: gentle premium at low utilization, steep at high. This creates natural backpressure without hard rejections.

```
premium(u) = minEdgeBps + (maxEdgeBps - minEdgeBps) * (u / utilizationK)^2
```

Where `u = totalReserved / totalAssets()` is current utilization. When `u` approaches `maxUtilizationBps`, the premium approaches `maxEdgeBps`, making tickets expensive enough to discourage further concentration.
