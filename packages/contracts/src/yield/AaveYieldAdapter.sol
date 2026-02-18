// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IYieldAdapter} from "../interfaces/IYieldAdapter.sol";

/// @notice Minimal Aave V3 Pool interface for supply/withdraw.
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// @title AaveYieldAdapter
/// @notice Routes idle USDC from HouseVault to Aave V3 on Base for yield.
///         Only the vault (owner) can call deploy/withdraw.
contract AaveYieldAdapter is IYieldAdapter, Ownable {
    using SafeERC20 for IERC20;

    IAavePool public immutable aavePool;
    IERC20 public immutable usdc;
    IERC20 public immutable aUsdc;
    address public immutable vault;

    constructor(IAavePool _aavePool, IERC20 _usdc, IERC20 _aUsdc, address _vault) Ownable(msg.sender) {
        aavePool = _aavePool;
        usdc = _usdc;
        aUsdc = _aUsdc;
        vault = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "AaveYieldAdapter: only vault");
        _;
    }

    /// @notice Deploy USDC to Aave V3 pool. USDC must already be in this contract.
    function deploy(uint256 amount) external override onlyVault {
        require(amount > 0, "AaveYieldAdapter: zero amount");
        usdc.safeTransferFrom(vault, address(this), amount);
        usdc.approve(address(aavePool), amount);
        aavePool.supply(address(usdc), amount, address(this), 0);
    }

    /// @notice Withdraw USDC from Aave V3 back to the vault.
    function withdraw(uint256 amount) external override onlyVault {
        require(amount > 0, "AaveYieldAdapter: zero amount");
        aavePool.withdraw(address(usdc), amount, vault);
    }

    /// @notice Total USDC balance deployed in Aave (principal + accrued).
    function balance() external view override returns (uint256) {
        return aUsdc.balanceOf(address(this));
    }

    /// @notice Emergency: withdraw everything back to vault.
    function emergencyWithdraw() external override onlyVault {
        uint256 bal = aUsdc.balanceOf(address(this));
        if (bal > 0) {
            aavePool.withdraw(address(usdc), bal, vault);
        }
    }
}
