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

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC:               ", address(usdc));

        // 2. Deploy HouseVault
        HouseVault vault = new HouseVault(IERC20(address(usdc)));
        console.log("HouseVault:             ", address(vault));

        // 3. Deploy LegRegistry
        LegRegistry registry = new LegRegistry();
        console.log("LegRegistry:            ", address(registry));

        // 4. Deploy AdminOracleAdapter
        AdminOracleAdapter adminOracle = new AdminOracleAdapter();
        console.log("AdminOracleAdapter:     ", address(adminOracle));

        // 5. Deploy OptimisticOracleAdapter (30 min liveness, 10 USDC bond)
        OptimisticOracleAdapter optimisticOracle = new OptimisticOracleAdapter(IERC20(address(usdc)), 1800, 10e6);
        console.log("OptimisticOracleAdapter:", address(optimisticOracle));

        // 6. Deploy ParlayEngine (bootstrap ends 7 days from now)
        uint256 bootstrapEndsAt = block.timestamp + 7 days;
        ParlayEngine engine = new ParlayEngine(vault, registry, IERC20(address(usdc)), bootstrapEndsAt);
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

        // 7c. Deploy MockYieldAdapter (for local testing)
        MockYieldAdapter yieldAdapter = new MockYieldAdapter(IERC20(address(usdc)), address(vault));
        vault.setYieldAdapter(IYieldAdapter(address(yieldAdapter)));
        console.log("MockYieldAdapter:       ", address(yieldAdapter));

        // 8. Create 3 sample legs
        uint256 cutoff = block.timestamp + 1 days;
        uint256 resolve = cutoff + 1 hours;

        registry.createLeg(
            "Will ETH hit $5000 by end of March?", "coingecko:eth", cutoff, resolve, address(adminOracle), 350_000
        );
        registry.createLeg(
            "Will BTC hit $150k by end of March?", "coingecko:btc", cutoff, resolve, address(adminOracle), 250_000
        );
        registry.createLeg(
            "Will SOL hit $300 by end of March?", "coingecko:sol", cutoff, resolve, address(adminOracle), 200_000
        );
        console.log("Created 3 sample legs");

        // 9. Mint USDC to deployer and second Anvil account
        usdc.mint(deployer, 10_000e6);
        console.log("Minted 10,000 USDC to deployer");

        address account1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        usdc.mint(account1, 10_000e6);
        console.log("Minted 10,000 USDC to account1");

        vm.stopBroadcast();
    }
}
