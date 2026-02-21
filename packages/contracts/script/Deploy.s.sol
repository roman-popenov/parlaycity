// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {HouseVault} from "../src/core/HouseVault.sol";
import {LegRegistry} from "../src/core/LegRegistry.sol";
import {ParlayEngine} from "../src/core/ParlayEngine.sol";
import {LockVault} from "../src/core/LockVault.sol";
import {MockYieldAdapter} from "../src/yield/MockYieldAdapter.sol";
import {AdminOracleAdapter} from "../src/oracle/AdminOracleAdapter.sol";
import {OptimisticOracleAdapter} from "../src/oracle/OptimisticOracleAdapter.sol";
import {IYieldAdapter} from "../src/interfaces/IYieldAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey =
            vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. USDC: use external address if provided, otherwise deploy MockUSDC
        address usdcEnv = vm.envOr("USDC_ADDRESS", address(0));
        IERC20 usdc;
        bool deployedMock = false;

        if (usdcEnv != address(0)) {
            usdc = IERC20(usdcEnv);
            console.log("Using external USDC:    ", usdcEnv);
        } else {
            MockUSDC mockUsdc = new MockUSDC();
            usdc = IERC20(address(mockUsdc));
            deployedMock = true;
            console.log("Deployed MockUSDC:      ", address(usdc));
        }

        // 2. Deploy HouseVault
        HouseVault vault = new HouseVault(usdc);
        console.log("HouseVault:             ", address(vault));

        // 3. Deploy LegRegistry
        LegRegistry registry = new LegRegistry();
        console.log("LegRegistry:            ", address(registry));

        // 4. Deploy AdminOracleAdapter
        AdminOracleAdapter adminOracle = new AdminOracleAdapter();
        console.log("AdminOracleAdapter:     ", address(adminOracle));

        // 5. Deploy OptimisticOracleAdapter (30 min liveness, 10 USDC bond)
        OptimisticOracleAdapter optimisticOracle = new OptimisticOracleAdapter(usdc, 1800, 10e6);
        console.log("OptimisticOracleAdapter:", address(optimisticOracle));

        // 6. Deploy ParlayEngine (bootstrap period configurable via env)
        uint256 bootstrapDays = vm.envOr("BOOTSTRAP_DAYS", uint256(7));
        uint256 bootstrapEndsAt = block.timestamp + bootstrapDays * 1 days;
        ParlayEngine engine = new ParlayEngine(vault, registry, usdc, bootstrapEndsAt);
        console.log("Bootstrap days:         ", bootstrapDays);
        console.log("ParlayEngine:           ", address(engine));

        // 7. Authorize ParlayEngine on HouseVault
        vault.setEngine(address(engine));
        console.log("Engine authorized on vault");

        // 7b. Deploy LockVault and wire fee routing
        LockVault lockVault = new LockVault(vault);
        console.log("LockVault:              ", address(lockVault));

        // Wire fee routing: vault -> lockVault (90%), vault -> safetyModule (5%), 5% stays in vault
        vault.setLockVault(lockVault);
        // SafetyModule doesn't exist yet -- use deployer as placeholder for now
        // TODO: Replace with real SafetyModule address in PR2
        vault.setSafetyModule(deployer);
        lockVault.setFeeDistributor(address(vault));
        console.log("Fee routing wired (90/5/5)");

        // 7c. Deploy MockYieldAdapter (fine for testnet too)
        MockYieldAdapter yieldAdapter = new MockYieldAdapter(usdc, address(vault));
        vault.setYieldAdapter(IYieldAdapter(address(yieldAdapter)));
        console.log("MockYieldAdapter:       ", address(yieldAdapter));

        // 8. Mint MockUSDC only when we deployed it (not using external USDC)
        if (deployedMock) {
            MockUSDC mockRef = MockUSDC(address(usdc));
            mockRef.mint(deployer, 10_000e6);
            console.log("Minted 10,000 USDC to deployer");

            // Only mint to hardcoded Anvil account on local chain
            if (block.chainid == 31337) {
                address account1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
                mockRef.mint(account1, 10_000e6);
                console.log("Minted 10,000 USDC to account1 (Anvil)");
            }
        }

        vm.stopBroadcast();
    }
}
