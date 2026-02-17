// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IYieldAdapter} from "../interfaces/IYieldAdapter.sol";

/// @title HouseVault
/// @notice ERC4626-like vault that holds USDC liquidity for the ParlayCity house.
///         LPs deposit USDC and receive vUSDC shares. The ParlayEngine reserves
///         exposure against the vault when tickets are purchased.
contract HouseVault is ERC20, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ────────────────────────────────────────────────────────────

    IERC20 public immutable asset;

    /// @notice Total USDC reserved as exposure for active tickets.
    uint256 public totalReserved;

    /// @notice Max fraction of TVL that can be reserved (basis points). Default 80%.
    uint256 public maxUtilizationBps;

    /// @notice Max payout for a single ticket as fraction of TVL (bps). Default 5%.
    uint256 public maxPayoutBps;

    /// @notice Address of the ParlayEngine authorized to reserve/release/pay.
    address public engine;

    /// @notice Optional yield adapter for deploying idle capital.
    IYieldAdapter public yieldAdapter;

    /// @notice Minimum local buffer as fraction of totalAssets (bps). Default 25%.
    uint256 public yieldBufferBps = 2500;

    /// @notice Minimum deposit amount (1 USDC). Mitigates first-depositor inflation attack.
    uint256 public constant MIN_DEPOSIT = 1e6;

    // ── Events ───────────────────────────────────────────────────────────

    event Deposited(address indexed depositor, address indexed receiver, uint256 assets, uint256 shares);
    event Withdrawn(address indexed caller, address indexed receiver, uint256 assets, uint256 shares);
    event PayoutReserved(uint256 amount, uint256 newTotalReserved);
    event PayoutReleased(uint256 amount, uint256 newTotalReserved);
    event WinnerPaid(address indexed winner, uint256 amount);
    event VoidedRefund(address indexed user, uint256 amount);
    event EngineSet(address indexed engine);
    event MaxUtilizationBpsSet(uint256 bps);
    event MaxPayoutBpsSet(uint256 bps);
    event YieldAdapterSet(address indexed adapter);
    event YieldBufferBpsSet(uint256 bps);
    event IdleDeployed(uint256 amount);
    event RecalledFromAdapter(uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────

    modifier onlyEngine() {
        require(msg.sender == engine, "HouseVault: caller is not engine");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(IERC20 _asset) ERC20("ParlayCity Vault USDC", "vUSDC") Ownable(msg.sender) {
        asset = _asset;
        maxUtilizationBps = 8000;
        maxPayoutBps = 500;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "HouseVault: zero address");
        engine = _engine;
        emit EngineSet(_engine);
    }

    function setMaxUtilizationBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10_000, "HouseVault: invalid bps");
        maxUtilizationBps = _bps;
        emit MaxUtilizationBpsSet(_bps);
    }

    function setMaxPayoutBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10_000, "HouseVault: invalid bps");
        maxPayoutBps = _bps;
        emit MaxPayoutBpsSet(_bps);
    }

    function setYieldAdapter(IYieldAdapter _adapter) external onlyOwner {
        yieldAdapter = _adapter;
        emit YieldAdapterSet(address(_adapter));
    }

    function setYieldBufferBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10_000, "HouseVault: invalid buffer bps");
        yieldBufferBps = _bps;
        emit YieldBufferBpsSet(_bps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Views ────────────────────────────────────────────────────────────

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Total USDC managed by the vault (local + deployed to yield adapter).
    function totalAssets() public view returns (uint256) {
        uint256 local = asset.balanceOf(address(this));
        if (address(yieldAdapter) != address(0)) {
            return local + yieldAdapter.balance();
        }
        return local;
    }

    /// @notice USDC held locally (not deployed to adapter).
    function localBalance() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Free liquidity available for new reservations or withdrawals.
    ///         Only counts local balance (reserved funds need instant availability).
    function freeLiquidity() public view returns (uint256) {
        uint256 local = localBalance();
        return local > totalReserved ? local - totalReserved : 0;
    }

    /// @notice How much USDC can safely be deployed to the yield adapter.
    function safeDeployable() public view returns (uint256) {
        uint256 local = localBalance();
        uint256 minLocal = (totalAssets() * yieldBufferBps) / 10_000;
        if (totalReserved > minLocal) minLocal = totalReserved;
        return local > minLocal ? local - minLocal : 0;
    }

    /// @notice Maximum payout allowed for a single ticket.
    function maxPayout() public view returns (uint256) {
        return (totalAssets() * maxPayoutBps) / 10_000;
    }

    /// @notice Maximum total USDC that can be reserved.
    function maxReservable() public view returns (uint256) {
        return (totalAssets() * maxUtilizationBps) / 10_000;
    }

    /// @notice Convert assets to shares. Uses +1 virtual offset to mitigate inflation attack.
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 total = totalAssets();
        if (supply == 0 || total == 0) return assets; // 1:1
        return (assets * (supply + 1)) / (total + 1);
    }

    /// @notice Convert shares to assets. Uses +1 virtual offset to mitigate inflation attack.
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 total = totalAssets();
        if (supply == 0 || total == 0) return shares; // 1:1
        return (shares * (total + 1)) / (supply + 1);
    }

    // ── LP Functions ─────────────────────────────────────────────────────

    /// @notice Deposit USDC and receive vUSDC shares.
    function deposit(uint256 assets, address receiver) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(assets >= MIN_DEPOSIT, "HouseVault: deposit below minimum");
        require(receiver != address(0), "HouseVault: zero receiver");

        shares = convertToShares(assets);
        require(shares > 0, "HouseVault: zero shares");

        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(receiver, shares);

        emit Deposited(msg.sender, receiver, assets, shares);
    }

    /// @notice Burn vUSDC shares and withdraw USDC. Can only withdraw from free liquidity.
    function withdraw(uint256 shares, address receiver) external nonReentrant whenNotPaused returns (uint256 assets) {
        require(shares > 0, "HouseVault: zero shares");
        require(receiver != address(0), "HouseVault: zero receiver");

        assets = convertToAssets(shares);
        require(assets > 0, "HouseVault: zero assets");
        require(assets <= freeLiquidity(), "HouseVault: insufficient free liquidity");

        _burn(msg.sender, shares);
        asset.safeTransfer(receiver, assets);

        emit Withdrawn(msg.sender, receiver, assets, shares);
    }

    // ── Engine Functions ─────────────────────────────────────────────────

    /// @notice Reserve USDC for a ticket's potential payout. Only callable by ParlayEngine.
    function reservePayout(uint256 amount) external onlyEngine nonReentrant {
        require(totalReserved + amount <= maxReservable(), "HouseVault: utilization cap exceeded");
        require(amount <= maxPayout(), "HouseVault: exceeds max payout");
        totalReserved += amount;
        emit PayoutReserved(amount, totalReserved);
    }

    /// @notice Release reserved USDC (ticket lost or voided). Only callable by ParlayEngine.
    function releasePayout(uint256 amount) external onlyEngine nonReentrant {
        require(amount <= totalReserved, "HouseVault: release exceeds reserved");
        totalReserved -= amount;
        emit PayoutReleased(amount, totalReserved);
    }

    /// @notice Pay a winning ticket holder. Only callable by ParlayEngine.
    function payWinner(address winner, uint256 amount) external onlyEngine nonReentrant {
        require(amount <= totalReserved, "HouseVault: pay exceeds reserved");
        totalReserved -= amount;
        asset.safeTransfer(winner, amount);
        emit WinnerPaid(winner, amount);
    }

    /// @notice Refund stake for a voided ticket (no reservation needed). Only callable by ParlayEngine.
    function refundVoided(address user, uint256 amount) external onlyEngine nonReentrant {
        asset.safeTransfer(user, amount);
        emit VoidedRefund(user, amount);
    }

    // ── Yield Functions ───────────────────────────────────────────────────

    /// @notice Deploy idle USDC to yield adapter. Only owner.
    function deployIdle(uint256 amount) external onlyOwner nonReentrant {
        require(address(yieldAdapter) != address(0), "HouseVault: no adapter");
        require(amount > 0, "HouseVault: zero amount");
        require(amount <= safeDeployable(), "HouseVault: exceeds safe deployable");

        asset.forceApprove(address(yieldAdapter), amount);
        yieldAdapter.deploy(amount);
        emit IdleDeployed(amount);
    }

    /// @notice Recall USDC from yield adapter back to vault. Only owner.
    function recallFromAdapter(uint256 amount) external onlyOwner nonReentrant {
        require(address(yieldAdapter) != address(0), "HouseVault: no adapter");
        require(amount > 0, "HouseVault: zero amount");
        yieldAdapter.withdraw(amount);
        emit RecalledFromAdapter(amount);
    }

    /// @notice Emergency: recall all funds from yield adapter.
    function emergencyRecall() external onlyOwner nonReentrant {
        require(address(yieldAdapter) != address(0), "HouseVault: no adapter");
        yieldAdapter.emergencyWithdraw();
    }
}
