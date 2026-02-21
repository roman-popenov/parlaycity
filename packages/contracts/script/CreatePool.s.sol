// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

/// @title CreatePool -- Create USDC/WETH Uniswap V3 pool on Base Sepolia
/// @notice Wraps ETH, creates pool, and adds initial liquidity
/// @dev Run: forge script script/CreatePool.s.sol --rpc-url base-sepolia --broadcast
contract CreatePool is Script {
    struct Config {
        address usdc;
        address weth;
        address nfpm;
        uint256 wethAmount;
        address deployer;
    }

    // sqrtPriceX96 for ~$2800/ETH
    // token0=USDC(6dec), token1=WETH(18dec): price = 1e18/(2800*1e6), sqrt * 2^96
    uint160 constant SQRT_PRICE_USDC_WETH = 1497271534609666559526006520020992;
    // token0=WETH(18dec), token1=USDC(6dec): price = 2800*1e6/1e18, sqrt * 2^96
    uint160 constant SQRT_PRICE_WETH_USDC = 4192360296907066388250624;

    function run() external {
        Config memory c = _loadConfig();

        console.log("Deployer:  ", c.deployer);
        console.log("USDC:      ", c.usdc);
        console.log("WETH:      ", c.weth);
        console.log("NFPM:      ", c.nfpm);
        console.log("WETH amount:", c.wethAmount);

        bool usdcIsToken0 = c.usdc < c.weth;
        address token0 = usdcIsToken0 ? c.usdc : c.weth;
        address token1 = usdcIsToken0 ? c.weth : c.usdc;

        console.log("token0:    ", token0);
        console.log("token1:    ", token1);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Wrap ETH to WETH
        IWETH(c.weth).deposit{value: c.wethAmount}();
        console.log("WETH balance:", IWETH(c.weth).balanceOf(c.deployer));

        // 2. Approve tokens for NFPM
        IERC20Minimal(c.usdc).approve(c.nfpm, type(uint256).max);
        IERC20Minimal(c.weth).approve(c.nfpm, type(uint256).max);

        // 3. Create and initialize pool (fee=500 = 0.05%)
        uint160 sqrtPriceX96 = usdcIsToken0 ? SQRT_PRICE_USDC_WETH : SQRT_PRICE_WETH_USDC;
        uint24 fee = uint24(vm.envOr("POOL_FEE", uint256(500)));
        address pool = INonfungiblePositionManager(c.nfpm).createAndInitializePoolIfNecessary(
            token0, token1, fee, sqrtPriceX96
        );
        console.log("Pool created: ", pool);

        // 4. Add liquidity
        _addLiquidity(c, token0, token1, usdcIsToken0, fee);

        vm.stopBroadcast();
        console.log("Done! Pool seeded with initial liquidity.");
    }

    function _loadConfig() internal view returns (Config memory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        return Config({
            usdc: vm.envOr("USDC_ADDRESS", address(0x036CbD53842c5426634e7929541eC2318f3dCF7e)),
            weth: vm.envOr("WETH_ADDRESS", address(0x4200000000000000000000000000000000000006)),
            nfpm: vm.envOr("UNISWAP_NFPM", address(0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2)),
            wethAmount: vm.envOr("WETH_AMOUNT", uint256(0.01 ether)),
            deployer: vm.addr(deployerKey)
        });
    }

    function _addLiquidity(Config memory c, address token0, address token1, bool usdcIsToken0, uint24 fee) internal {
        // At $2800/ETH, 0.01 ETH needs ~28 USDC
        uint256 usdcBal = IERC20Minimal(c.usdc).balanceOf(c.deployer);
        uint256 usdcNeeded = (c.wethAmount * 2800) / 1e12; // 18-dec ETH -> 6-dec USDC
        uint256 usdcAmount = usdcNeeded < usdcBal ? usdcNeeded : usdcBal;
        console.log("USDC for LP:", usdcAmount);

        // tickSpacing: fee=500->10, fee=3000->60, fee=10000->200
        int24 tickSpacing = fee == 500 ? int24(10) : fee == 3000 ? int24(60) : int24(200);
        int24 maxTick = (int24(887272) / tickSpacing) * tickSpacing;

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: -maxTick,
            tickUpper: maxTick,
            amount0Desired: usdcIsToken0 ? usdcAmount : c.wethAmount,
            amount1Desired: usdcIsToken0 ? c.wethAmount : usdcAmount,
            amount0Min: 0,
            amount1Min: 0,
            recipient: c.deployer,
            deadline: block.timestamp + 300
        });

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) =
            INonfungiblePositionManager(c.nfpm).mint(params);

        console.log("LP NFT tokenId:", tokenId);
        console.log("Liquidity:     ", uint256(liquidity));
        console.log("amount0 used:  ", amount0);
        console.log("amount1 used:  ", amount1);
    }
}
