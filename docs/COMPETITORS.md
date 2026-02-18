# Competitive Positioning

## Competitor Comparison Table

| Competitor | Architecture | Parlay Support | Live Cashout | Unified Vault | Fee Model | Status |
|------------|-------------|---------------|-------------|---------------|-----------|--------|
| **Kalshi Combos** | Per-combo orderbook + RFQ | Yes (combos) | Limited (sell order) | No (fragmented) | Hidden spread | Live |
| **ParlayMarket** | Centralized engine | Yes | No | No | Not live | Paper trading |
| **Polymarket** | Per-market CLOB | No parlay product | N/A | No | 2% spread | Live |
| **Azuro** | Singleton LP pool | Yes | No live cashout | Yes (closest) | ~5% spread | Live |
| **Overtime Markets** | AMM vault | Yes | No crash mechanic | Yes | ~5% spread | Live |
| **PredictShark** | Unknown (new) | Claims parlays | Claims "live cashout" | Unknown | Unknown | Early |
| **ParlayCity** | Unified vault AMM | Yes (2-5 legs) | Crash-parlay mechanic | Yes | 2-3.5% explicit | Building |

---

## vs Kalshi Combos

**Architecture:** Per-combo orderbook. Each combination of outcomes gets its own order book + RFQ system. This fragments liquidity -- a 3-event combo has 8 possible outcome combinations, each needing its own book.

**Cashout:** Limited. Users can sell combo positions back to the orderbook, but this depends on counterparty liquidity. No guaranteed exit, no crash mechanic.

**Our advantage:** Unified vault = zero fragmentation. All bets draw from one USDC pool. Cashout is guaranteed (vault always has liquidity up to reserved amount). Crash mechanic creates engagement that static combos don't have.

**Their advantage:** Regulated US exchange. Real money, real event resolution infrastructure. Established user base.

---

## vs ParlayMarket

**Architecture:** Centralized engine with "progressive decentralization" roadmap. Currently paper trading only -- no real funds, no deployed contracts.

**Status:** Not live. Provides infrastructure/tooling for parlay markets but the actual trading engine is centralized.

**Our advantage:** Full on-chain protocol with deployed, tested smart contracts. Incentive layer (LockVault, fee routing). Game mechanic (crash-parlay). Not vaporware -- the protocol is functional.

**Their advantage:** If they execute on decentralization, they may have a more mature trading infrastructure.

---

## vs Polymarket

**Architecture:** Per-market CLOB (central limit order book) on Polygon. Each market is independent with its own liquidity pool.

**Parlay support:** None. Polymarket has no parlay product. Users can manually combine positions but there's no integrated parlay builder, multiplier calculation, or combined settlement.

**Scale:** ~314K monthly active traders (30M registered accounts). $1B+ in monthly volume on major events.

**Our advantage:** Parlay product (they have none). Unified vault (they fragment per-market). Crash mechanic (they have nothing comparable). Lower fees (2-3.5% vs 2% spread + slippage).

**Their advantage:** Massive user base, deep liquidity on popular markets, regulatory clarity (sort of), established brand.

---

## vs Azuro

**Architecture:** Singleton LP pool -- closest to our model. LPs deposit into a shared pool that underwrites all bets across all markets.

**Parlay support:** Yes, but no live cashout. Parlays are static buy-and-wait instruments.

**Returns:** >95% probability of positive yield for LP positions held >1 month (per their analytics).

**Our advantage:** Crash-parlay cashout (they have none). Non-extractive fee routing (90/5/5). Social impact layer. More transparent fee structure.

**Their advantage:** Live protocol with real volume. Proven LP model. Broader market coverage.

---

## vs Overtime Markets

**Architecture:** AMM vault on Arbitrum/Optimism. LPs deposit sUSD into a shared pool. Similar vault-as-counterparty model.

**Performance:** 106% cumulative LP return in year one on Arbitrum (partly boosted by THALES token incentives). Bootstrapped with 100K sUSD seed deposit.

**Our advantage:** Crash-parlay cashout (they have straight parlays, no crash mechanic). 90% fee share to lockers (more generous). No governance token dependency.

**Their advantage:** Live protocol with proven track record. Token incentives boost early adoption. Established oracle infrastructure.

---

## vs "Deep Liquidity" Paper (gwrx2005 on Medium)

**Architecture proposal:** HLP-style vault + RFQ + batch auction for prediction markets. Proposes separating retail (instant AMM) from institutional (RFQ/batch) execution.

**Relationship to ParlayCity:** Compatible architecture. We implement the unified vault + instant AMM lane. The RFQ/batch auction lane is in our roadmap (dual execution lanes in `docs/CASHOUT.md`). The paper provides theoretical validation for our approach.

**Our addition:** The paper focuses on institutional liquidity optimization. We add the consumer layer: crash game mechanic, non-extractive economics, social impact, and gambler-to-LP conversion. We are the consumer-facing product on institutional-grade primitives.

---

## vs PredictShark (Emerging)

**Status:** Early-stage. Claims to offer "live cashout" on parlays but details are scarce.

**What we know:** Appears to be building a parlay platform with some form of early exit. No crash mechanic visible. Architecture unknown (likely centralized given early stage).

**Our advantage:** Full on-chain protocol (verifiable). Crash-parlay mechanic (not just "cashout" but a game loop). Unified vault with LockVault incentive layer. Open source.

**Risk:** If they execute well and get to market first, they could capture mindshare on "live cashout parlays." Monitor.

---

## Our Four Primitives (The Moat)

No competitor has all four:

1. **Crash-parlay game loop** -- Aviator's engagement mechanic ($14B/month in wagers, 42-77M MAU) applied to the highest-margin bet type (56-72% of US sportsbook revenue). This is the hook.

2. **Non-extractive fee routing** -- 90/5/5 split enforced by smart contract. Zero owner take. 90% of fees go to the people providing liquidity. Compare: GMX gives 70%, Hyperliquid gives ~1%.

3. **Social impact layer** -- 10% of every loss funds gambling harm reduction via Gitcoin-style routing. No other betting protocol has a built-in social good mechanism.

4. **Loser-to-LP conversion** -- "Become the house" CTA triggered at the crash moment, when the gambler is most emotionally receptive to switching sides. This is a growth flywheel: every loss is a potential LP conversion.

**Key narrative point:** We are not competing on "better parlays." We are competing on a new category: skill-augmented crash-parlay instruments with non-extractive economics. The crash mechanic creates engagement. The vault creates yield. The fee routing creates fairness. The social layer creates purpose.
