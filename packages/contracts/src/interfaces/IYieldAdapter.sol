// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IYieldAdapter
/// @notice Interface for routing idle vault capital to external yield sources.
interface IYieldAdapter {
    /// @notice Deploy USDC to the yield source.
    function deploy(uint256 amount) external;

    /// @notice Withdraw USDC from the yield source back to the vault.
    function withdraw(uint256 amount) external;

    /// @notice Total USDC balance deployed (principal + accrued yield).
    function balance() external view returns (uint256);

    /// @notice Emergency: withdraw all funds back to the vault.
    function emergencyWithdraw() external;
}
