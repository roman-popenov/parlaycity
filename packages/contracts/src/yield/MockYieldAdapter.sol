// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IYieldAdapter} from "../interfaces/IYieldAdapter.sol";

/// @title MockYieldAdapter
/// @notice For local Anvil testing. Stores USDC in internal balance with
///         simulated yield via `simulateYield()`.
contract MockYieldAdapter is IYieldAdapter, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public immutable vault;
    uint256 public deployed;
    uint256 public simulatedYield;

    constructor(IERC20 _usdc, address _vault) Ownable(msg.sender) {
        usdc = _usdc;
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "MockYieldAdapter: only vault");
        _;
    }

    function deploy(uint256 amount) external override onlyVault {
        require(amount > 0, "MockYieldAdapter: zero amount");
        usdc.safeTransferFrom(vault, address(this), amount);
        deployed += amount;
    }

    function withdraw(uint256 amount) external override onlyVault {
        require(amount > 0, "MockYieldAdapter: zero amount");
        require(amount <= balance(), "MockYieldAdapter: insufficient balance");
        if (amount <= simulatedYield) {
            simulatedYield -= amount;
        } else {
            deployed -= (amount - simulatedYield);
            simulatedYield = 0;
        }
        usdc.safeTransfer(vault, amount);
    }

    function balance() public view override returns (uint256) {
        return deployed + simulatedYield;
    }

    function emergencyWithdraw() external override onlyVault {
        uint256 bal = balance();
        if (bal > 0) {
            deployed = 0;
            simulatedYield = 0;
            usdc.safeTransfer(vault, bal);
        }
    }

    /// @notice Simulate yield accrual. Owner mints USDC and calls this.
    function simulateYield(uint256 amount) external onlyOwner {
        // Caller must transfer USDC to this contract before calling
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        simulatedYield += amount;
    }
}
