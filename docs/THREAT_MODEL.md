# ParlayCity Threat Model

## Assets at Risk

| Asset | Location | Value |
|-------|----------|-------|
| LP deposits (USDC) | HouseVault | High |
| Ticket payouts | HouseVault (reserved) | High |
| Oracle integrity | OracleAdapters | High |
| Proposer/challenger bonds | OptimisticOracle | Medium |
| Admin keys | Deployer EOA | Critical |

## Threat Categories

### T1: Vault Insolvency
**Risk**: Payouts exceed vault assets.
**Mitigations**:
- `maxPayoutBps` caps single ticket payout at 5% TVL
- `maxUtilizationBps` caps total reserved at 80% of assets
- Utilization check at ticket purchase time
- Reserved amount tracked and enforced

### T2: Oracle Manipulation (FAST mode)
**Risk**: Admin resolves legs dishonestly.
**Mitigations**:
- FAST mode is bootstrap-only (time-limited)
- Admin key is disclosed as centralized trust assumption
- Upgrade path to OPTIMISTIC mode documented

### T3: Oracle Manipulation (OPTIMISTIC mode)
**Risk**: Proposer submits false outcome, no one challenges.
**Mitigations**:
- Bond required to propose (10 USDC)
- Challenge window (30 min) before finalization
- Challenger bond required (prevents spam challenges)
- Loser gets slashed, winner gets rewarded
- Arbiter (admin in MVP) resolves disputes

### T4: Reentrancy
**Risk**: Callback during token transfer drains funds.
**Mitigations**:
- ReentrancyGuard on all state-changing externals
- Checks-effects-interactions pattern
- SafeERC20 (no callback tokens in USDC, but defense in depth)

### T5: Integer Overflow / Precision Loss
**Risk**: Multiplier computation overflows or loses precision.
**Mitigations**:
- Solidity 0.8+ built-in overflow checks
- PPM (1e6) for probabilities, consistent scaling
- Fuzz tests covering edge cases

### T6: Front-running
**Risk**: Attacker sees ticket purchase, manipulates probability.
**Mitigations**:
- Probability is admin-set, not market-derived in MVP
- Future: EIP-712 signed quotes with expiry
- Base L2 has 2s blocks and sequencer ordering (less MEV surface)

### T7: Admin Key Compromise
**Risk**: Deployer key stolen, contracts drained/paused maliciously.
**Mitigations**:
- Hackathon accepts single-admin trust model
- Production path: multisig (Safe), timelock, governance
- Pausable as emergency brake
- No self-destruct, no proxy upgrades in MVP

### T8: Denial of Service
**Risk**: Attacker buys many small tickets to exhaust vault capacity.
**Mitigations**:
- `minStake` enforced (1 USDC)
- Gas cost on Base discourages spam
- Admin can pause if needed

## Known Limitations (Hackathon Scope)

1. Single admin key (not multisig)
2. Arbiter in optimistic mode is admin (not truly decentralized)
3. No timelock on admin actions
4. No formal verification
5. Probability feeds are manual (not from live oracles)
6. No MEV protection beyond L2 ordering
