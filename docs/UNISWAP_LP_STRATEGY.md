# Uniswap V3 LP Yield Strategy

**Status: PLANNED.** This document specifies how ParlayCity deploys idle vault capital and rehab-mode locked funds into Uniswap V3 concentrated liquidity positions on Base.

## Motivation

ParlayCity has two pools of idle USDC that earn nothing today:

1. **HouseVault idle capital** -- USDC sitting in the vault above the `yieldBufferBps` (25%) threshold and `totalReserved` floor. Currently routable to `AaveYieldAdapter` but the default deploy uses `MockYieldAdapter`.
2. **Rehab-mode locked capital** (planned) -- 10% of every losing stake force-locked as vUSDC for 120 days. See `docs/REHAB_MODE.md`.

Deploying this capital into Uniswap V3 stable-stable LP positions generates swap fee yield while preserving capital stability. The yield income flows back to the vault (increasing share price) and to the SafetyModule (insurance buffer).

This also fulfills the economics spec in `docs/ECONOMICS.md`:

> "$10 (10%) -> AMM liquidity pools (swap fees fund SafetyModule)"

## Pair Selection on Base

### Why Not USDC-BOLD?

BOLD (Liquity V2's stablecoin) is currently deployed on Ethereum mainnet only. There is no canonical BOLD deployment on Base as of February 2026. Bridged BOLD would introduce bridge risk and thin liquidity. We reject this option.

### Recommended: USDC/USDS (formerly DAI)

| Pair | Fee Tier | IL Risk | Liquidity on Base | Verdict |
|------|----------|---------|-------------------|---------|
| USDC/USDS | 0.05% (5 bps) | Minimal (~0.03%) | Deep (MakerDAO/Sky ecosystem) | **Primary** |
| USDC/USDbC | 0.01% (1 bp) | Near-zero | Declining (legacy) | Backup only |
| USDC/USDT | 0.05% (5 bps) | Minimal | Moderate on Base | Alternative |

**USDC/USDS rationale:**
- Both assets are dollar-pegged stablecoins with strong backing (Circle + Sky/MakerDAO)
- USDS is over-collateralized (>150% collateral ratio) -- lower depeg risk than algorithmic stables
- 0.05% fee tier is the standard for stable-stable on Uniswap V3
- Concentrated range of [0.998, 1.002] captures >99% of trading volume
- Capital efficiency: ~2000x vs V2 for a 40-pip range on stables
- Deep liquidity on Base via Spark Liquidity Layer ($500M+ USDC deployed on Base)

### Impermanent Loss Analysis

For a USDC/USDS pair in the [0.998, 1.002] range:

```
Price stays in range (>99% of time):
  IL = 0.00% to 0.03%
  Fee income at 0.05% tier with $1M TVL and $50M daily volume:
    Daily fees = $50M * 0.05% * (our_liquidity / total_liquidity)
    Annualized: 5-15% APR depending on our share of liquidity

Price exits range (rare depeg event):
  Position becomes 100% one-sided (all USDC or all USDS)
  Capital is safe but stops earning fees
  Re-range when price returns (or if depeg is permanent, withdraw)
```

For context, Aave V3 on Base yields 2-5% APR on USDC deposits. The Uniswap LP strategy targets 5-15% APR with marginally higher complexity but still minimal capital risk.

### Depeg Scenario

If USDS depegs to $0.95 (a severe but temporary event like March 2023 USDC depeg):
- Our position becomes 100% USDS, 0% USDC
- Paper loss: ~2.5% on deployed capital
- Action: hold and collect fees as arbitrageurs trade the pair back to peg
- Emergency: call `emergencyWithdraw()` to pull all capital back to vault

Historical stablecoin depegs have been short-lived (hours to days) for major stables. The `emergencyWithdraw` path ensures the vault can always recall capital.

## Architecture

### Contract: `UniswapYieldAdapter`

Implements the existing `IYieldAdapter` interface (no changes to `HouseVault` needed).

```
                                 Uniswap V3
                                 USDC/USDS Pool
                                     |
HouseVault --deploy()--> UniswapYieldAdapter --mint/increaseLiquidity()--> NonfungiblePositionManager
HouseVault <-withdraw()- UniswapYieldAdapter <-decreaseLiquidity()+collect()--'
```

```solidity
contract UniswapYieldAdapter is IYieldAdapter, Ownable {
    // Immutables
    INonfungiblePositionManager public immutable nfpm;
    ISwapRouter public immutable router;
    IERC20 public immutable usdc;
    IERC20 public immutable usds;
    address public immutable vault;

    // State
    uint256 public positionTokenId;    // NFT ID of our LP position (0 = no position)
    int24 public tickLower;            // Lower bound of concentrated range
    int24 public tickUpper;            // Upper bound of concentrated range
    uint24 public constant POOL_FEE = 500;  // 0.05% fee tier (500 = 5 bps)

    // Accounting
    uint256 public totalDeployed;      // USDC principal deployed (not including yield)
}
```

### Key Design Decisions

**1. Single position, not multiple.**
We maintain one LP position (one NFT). When `deploy()` is called, we `increaseLiquidity()` on the existing position. This simplifies accounting and gas costs.

**2. 50/50 swap on deploy.**
Uniswap V3 requires both tokens. When the vault sends USDC, we swap half to USDS via the same Uniswap router, then provide both tokens as liquidity. The swap cost (0.05% on half the amount = 0.025% total) is acceptable for yield that targets 5-15% APR.

**3. Fixed range with manual re-ranging.**
The range [0.998, 1.002] is set at construction. If the pair trades outside this range persistently (depeg scenario), the owner can call `reRange()` to burn the position and mint a new one with an updated range. This is a manual, infrequent operation.

**4. Fees compound on collect.**
Uniswap V3 does not auto-compound fees. We collect fees on every `withdraw()` call and on a periodic `harvestFees()` call. Collected fees are sent back to the vault as USDC (swapping any USDS fees back to USDC via the router).

### Interface Implementation

```solidity
function deploy(uint256 amount) external onlyVault {
    // 1. Transfer USDC from vault
    usdc.safeTransferFrom(vault, address(this), amount);

    // 2. Swap half to USDS
    uint256 half = amount / 2;
    usdc.approve(address(router), half);
    uint256 usdsAmount = router.exactInputSingle(ISwapRouter.ExactInputSingleParams({
        tokenIn: address(usdc),
        tokenOut: address(usds),
        fee: POOL_FEE,
        recipient: address(this),
        amountIn: half,
        amountOutMinimum: half * 995 / 1000,  // 0.5% slippage max
        sqrtPriceLimitX96: 0
    }));

    // 3. Add liquidity
    uint256 usdcForLP = amount - half;
    usdc.approve(address(nfpm), usdcForLP);
    usds.approve(address(nfpm), usdsAmount);

    if (positionTokenId == 0) {
        // First deploy: mint new position
        (uint256 tokenId, , , ) = nfpm.mint(INonfungiblePositionManager.MintParams({
            token0: address(usdc) < address(usds) ? address(usdc) : address(usds),
            token1: address(usdc) < address(usds) ? address(usds) : address(usdc),
            fee: POOL_FEE,
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: /* sorted */,
            amount1Desired: /* sorted */,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(this),
            deadline: block.timestamp
        }));
        positionTokenId = tokenId;
    } else {
        // Subsequent deploys: increase existing position
        nfpm.increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
            tokenId: positionTokenId,
            amount0Desired: /* sorted */,
            amount1Desired: /* sorted */,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
        }));
    }

    totalDeployed += amount;
}

function withdraw(uint256 amount) external onlyVault {
    require(positionTokenId != 0, "no position");

    // 1. Collect accrued fees first
    _collectFees();

    // 2. Decrease liquidity proportionally
    uint128 liquidity = _positionLiquidity();
    uint128 liquidityToRemove = uint128(uint256(liquidity) * amount / totalDeployed);

    (uint256 amount0, uint256 amount1) = nfpm.decreaseLiquidity(
        INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId: positionTokenId,
            liquidity: liquidityToRemove,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
        })
    );

    // 3. Collect the tokens
    nfpm.collect(INonfungiblePositionManager.CollectParams({
        tokenId: positionTokenId,
        recipient: address(this),
        amount0Max: type(uint128).max,
        amount1Max: type(uint128).max
    }));

    // 4. Swap USDS back to USDC
    uint256 usdsBalance = usds.balanceOf(address(this));
    if (usdsBalance > 0) {
        usds.approve(address(router), usdsBalance);
        router.exactInputSingle(ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usds),
            tokenOut: address(usdc),
            fee: POOL_FEE,
            recipient: address(this),
            amountIn: usdsBalance,
            amountOutMinimum: usdsBalance * 995 / 1000,
            sqrtPriceLimitX96: 0
        }));
    }

    // 5. Send all USDC back to vault
    uint256 usdcBalance = usdc.balanceOf(address(this));
    usdc.safeTransfer(vault, usdcBalance);
    totalDeployed = totalDeployed > amount ? totalDeployed - amount : 0;
}

function balance() external view returns (uint256) {
    if (positionTokenId == 0) return 0;
    // Return principal + uncollected fees (approximate)
    // Exact calculation requires on-chain position query
    return totalDeployed + _estimatedUnclaimedFees();
}

function emergencyWithdraw() external onlyVault {
    if (positionTokenId == 0) return;
    // Burn entire position, swap everything to USDC, send to vault
    uint128 liquidity = _positionLiquidity();
    nfpm.decreaseLiquidity(...);
    nfpm.collect(...);
    // Swap all USDS to USDC
    // Transfer all USDC to vault
    positionTokenId = 0;
    totalDeployed = 0;
}
```

### Integration with HouseVault

**Zero changes to HouseVault.** The vault already supports:

```solidity
// HouseVault.sol (existing code)
function setYieldAdapter(IYieldAdapter _adapter) external onlyOwner;
function deployIdle(uint256 amount) external onlyOwner;
function recallFromAdapter(uint256 amount) external onlyOwner;
function emergencyRecall() external onlyOwner;
function safeDeployable() public view returns (uint256);  // respects yieldBufferBps + totalReserved
```

To switch from Aave to Uniswap LP:
```solidity
vault.setYieldAdapter(uniswapAdapter);
vault.deployIdle(vault.safeDeployable());
```

### Multi-Adapter Strategy (Stretch)

The current `IYieldAdapter` is a single-adapter slot. For production, a `YieldRouter` contract could split capital across multiple adapters:

```
HouseVault -> YieldRouter (implements IYieldAdapter)
                 |-- 60% -> AaveYieldAdapter (low risk, ~3% APR)
                 |-- 30% -> UniswapYieldAdapter (medium risk, ~10% APR)
                 |-- 10% -> buffer (instant liquidity)
```

This is a post-hackathon enhancement. For MVP, single adapter is sufficient.

## Connection to Rehab Mode

The rehab mode (see `docs/REHAB_MODE.md`) force-locks 10% of losing stakes as vUSDC for 120 days. These locked shares represent idle capital in the vault that backs the vUSDC.

The connection is indirect but important:

```
Gambler loses $100 stake
  |-- $80 stays in vault (LP profit via share price)
  |-- $10 -> AMM liquidity (deployed via UniswapYieldAdapter)
  |-- $10 -> rehab lock (vUSDC in LockVault, backed by vault USDC)
```

The $10 sent to AMM liquidity is routed through the loss distribution mechanism in HouseVault. This USDC is deployed to the UniswapYieldAdapter. The swap fees generated fund the SafetyModule.

The $10 in rehab locks does not get separately deployed -- it remains as vault-backed vUSDC. The vault itself can deploy idle capital (including capital backing rehab locks) through the yield adapter, but this is managed at the vault level, not per-lock.

## Connection to x402 Bazaar

The x402 protocol (HTTP 402 Payment Required) enables AI agents to discover and pay for API services autonomously. Our existing `premium/sim` and `premium/agent-quote` endpoints are x402-gated.

**Synergy with Uniswap LP:**
- Swap fee income from the LP position partially funds the SafetyModule
- The SafetyModule backstop makes the protocol more robust, which is a selling point for the x402 Bazaar listing
- AI agents paying x402 fees for risk assessments generate volume -> fees -> lockers/safety
- The LP position itself could be listed as a transparent metric in the x402 Bazaar metadata (protocol health signal)

See the x402 Bazaar section in `docs/BOUNTY_MAP.md` for bounty alignment.

## Deployment Plan

### Base Mainnet Addresses (Uniswap V3)

```
NonfungiblePositionManager: 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
SwapRouter02:               0x2626664c2603336E57B271c5C0b26F421741e481
USDC (native):              0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
USDS:                       [verify current deployment on Base]
```

### Implementation Steps

1. **Write `UniswapYieldAdapter.sol`** implementing `IYieldAdapter`
   - Constructor: nfpm, router, usdc, usds, vault, tickLower, tickUpper
   - Core: deploy, withdraw, balance, emergencyWithdraw
   - Admin: reRange, harvestFees, setSlippageBps

2. **Write `MockUniswapAdapter.sol`** for local testing
   - Simulates LP position without real Uniswap contracts
   - Tracks deployed/yield like MockYieldAdapter

3. **Unit tests**
   - deploy/withdraw/balance round-trip
   - emergency withdraw recovers all capital
   - slippage protection on swaps
   - re-range updates tick bounds
   - fee collection and routing

4. **Integration with deploy script**
   - Add UniswapYieldAdapter to Deploy.s.sol (conditional: mainnet uses real, local uses mock)
   - Wire: `vault.setYieldAdapter(uniswapAdapter)`

5. **Frontend** (optional for hackathon)
   - Show "Yield source: Uniswap V3 USDC/USDS LP" on vault dashboard
   - Show estimated APR from LP fees

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| USDS depeg (>2%) | Low | Medium | emergencyWithdraw, re-range |
| Uniswap V3 smart contract bug | Very low | High | emergencyWithdraw, audited contracts |
| Out-of-range (no fee income) | Low | Low | Monitor, re-range if persistent |
| Swap slippage on deploy/withdraw | Low | Low | amountOutMinimum with 0.5% tolerance |
| totalReserved spike needs recall | Medium | Medium | safeDeployable check, emergencyRecall |
| Gas cost of LP operations | N/A on Base | N/A | Base L2 gas is negligible |

## Sources

- [Uniswap V3 Concentrated Liquidity Docs](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)
- [Uniswap V3 LP Position Management](https://docs.uniswap.org/sdk/v3/guides/liquidity/position-data)
- [Concentrated Liquidity Capital Efficiency (Cyfrin)](https://www.cyfrin.io/blog/uniswap-v3-concentrated-liquidity-capital-efficiency)
- [Uniswap V3 Concentrated Liquidity (RareSkills)](https://rareskills.io/post/uniswap-v3-concentrated-liquidity)
- [USDC on Base: Liquidity & Integration](https://stablecoinflows.com/2025/10/16/why-usdc-is-the-backbone-of-base-liquidity-integration-and-on-chain-utility-explained/)
- [x402 Protocol Adoption ($50M+ transactions)](https://www.mexc.com/news/337107)
- [x402 Bazaar: AI Agent Marketplace](https://www.mexc.com/en-GB/news/92906)
