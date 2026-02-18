// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HouseVault} from "../../src/core/HouseVault.sol";
import {LockVault} from "../../src/core/LockVault.sol";

/// @notice Shared helper for test setUp: deploys LockVault, wires fee routing.
abstract contract FeeRouterSetup is Test {
    function _wireFeeRouter(HouseVault vault) internal returns (LockVault lockVault) {
        lockVault = new LockVault(vault);
        vault.setLockVault(lockVault);
        vault.setSafetyModule(makeAddr("safetyModule"));
        lockVault.setFeeDistributor(address(vault));
    }
}
