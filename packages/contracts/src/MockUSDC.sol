// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice A simple ERC20 with a public mint for testing/demo purposes.
///         6 decimals to match real USDC. Anyone can mint up to 10,000 USDC per call.
contract MockUSDC is ERC20 {
    uint256 public constant MAX_MINT = 10_000e6;

    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to `to`. Capped at 10,000 USDC per call.
    function mint(address to, uint256 amount) external {
        require(amount <= MAX_MINT, "MockUSDC: exceeds max mint");
        _mint(to, amount);
    }
}
