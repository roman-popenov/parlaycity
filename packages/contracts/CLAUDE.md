# ParlayCity Contracts (Foundry / Solidity 0.8.24)

## Protocol Invariants (always preserve)

- Engine holds 0 USDC at all times. All stake flows to HouseVault via `safeTransferFrom`.
- `HouseVault.totalReserved <= HouseVault.totalAssets()` always.
- Fee arithmetic in BPS (1e4), probability in PPM (1e6). Never mix.
- `ParlayMath.sol` must match `packages/shared/src/math.ts` exactly.

## Contract Details

Subdirectories: `core/` (HouseVault, ParlayEngine, LegRegistry, LockVault), `oracle/`, `yield/`, `libraries/`, `interfaces/`.

All contracts use Ownable + Pausable + ReentrancyGuard, SafeERC20 on all token ops.

- **HouseVault** -- ERC4626-like LP vault. Holds USDC, mints vUSDC shares. Tracks `totalReserved` exposure. Utilization cap 80% (`maxUtilizationBps=8000`), max single payout 5% TVL (`maxPayoutBps=500`). Yield buffer 25%. *Current: no fee routing -- fees stay as implicit vault profit.*
- **ParlayEngine** -- Core betting engine. Mints ERC721 tickets. Validates legs, computes multipliers via ParlayMath, reserves vault exposure, handles settlement. *Current fee: `feePaid = stake * (baseFee + perLegFee * nLegs) / 10_000`. baseFee=100bps, perLegFee=50bps. No routing.*
- **LegRegistry** -- Admin-managed registry of betting outcomes. Each leg: `probabilityPPM`, `cutoffTime`, `oracleAdapter`.
- **LockVault** -- Lock vUSDC for 30/60/90 days. Synthetix-style `accRewardPerWeightedShare` accumulator. Tier weights: 1.1x/1.25x/1.5x. 10% linear early-exit penalty. *Current: `distributeFees()` is owner-only push, `sweepPenaltyShares()` manual.*
- **ParlayMath** -- Pure library: multiplier (PPM), edge (BPS), payout math.
- **AdminOracleAdapter / OptimisticOracleAdapter** -- Bootstrap vs production oracles. `bootstrapEndsAt` determines mode per ticket at purchase (immutable).
- **AaveYieldAdapter / MockYieldAdapter** -- Route idle USDC to Aave V3. Default deploy uses MockYieldAdapter only.

Key interfaces: `IOracleAdapter`, `IYieldAdapter`, `IHedgeAdapter` (interface exists, no implementation).

Deployment order: MockUSDC -> HouseVault -> LegRegistry -> Oracles -> ParlayEngine -> vault.setEngine -> LockVault -> MockYieldAdapter -> sample legs.

## Formatting

`forge fmt` -- line_length=120, tab_width=4, bracket_spacing=false.

## Testing Expectations

- Unit tests for each new revert branch
- Fuzz tests for multiplier bounds and fee arithmetic
- Invariant tests for solvency and reserve release
- Run `forge test -vvv --match-test <TestName>` for single test
- Run `forge coverage --report summary` when touching core accounting

## When Modifying

### Vault accounting / reserves
- Add or update invariant tests
- Avoid flows where fees are temporarily unaccounted

### Parlay math
- Change ParlayMath -> change TS mirror -> add a parity test -> run `make test-all`

### Access control
- No discretionary "sweep user value" paths
- Prefer deterministic routing + permissionless distribution

### Cashout (future)
- Must pay <= fair value minus spread
- Must release reserved liability safely
- Must respect `minOut` slippage parameter
- Must never exceed what reserve accounting allows
