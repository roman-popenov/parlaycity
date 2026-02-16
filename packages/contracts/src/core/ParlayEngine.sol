// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HouseVault} from "./HouseVault.sol";
import {LegRegistry} from "./LegRegistry.sol";
import {ParlayMath} from "../libraries/ParlayMath.sol";
import {IOracleAdapter, LegStatus} from "../interfaces/IOracleAdapter.sol";

/// @title ParlayEngine
/// @notice Core betting engine for ParlayCity. Users purchase parlay tickets
///         (minted as ERC721 NFTs) by combining 2-5 legs. Tickets are settled
///         via oracle adapters and payouts are disbursed from the HouseVault.
contract ParlayEngine is ERC721, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Enums ────────────────────────────────────────────────────────────

    enum SettlementMode {
        FAST,
        OPTIMISTIC
    }
    enum TicketStatus {
        Active,
        Won,
        Lost,
        Voided,
        Claimed
    }

    // ── Structs ──────────────────────────────────────────────────────────

    struct Ticket {
        address buyer;
        uint256 stake;
        uint256[] legIds;
        bytes32[] outcomes;
        uint256 multiplierX1e6;
        uint256 potentialPayout;
        uint256 feePaid;
        SettlementMode mode;
        TicketStatus status;
        uint256 createdAt;
    }

    // ── State ────────────────────────────────────────────────────────────

    HouseVault public vault;
    LegRegistry public registry;
    IERC20 public usdc;

    uint256 public bootstrapEndsAt;
    uint256 public baseFee = 100; // bps
    uint256 public perLegFee = 50; // bps
    uint256 public minStake = 1e6; // 1 USDC
    uint256 public maxLegs = 5;

    uint256 private _nextTicketId;
    mapping(uint256 => Ticket) private _tickets;

    // ── Events ───────────────────────────────────────────────────────────

    event TicketPurchased(
        uint256 indexed ticketId,
        address indexed buyer,
        uint256[] legIds,
        bytes32[] outcomes,
        uint256 stake,
        uint256 multiplierX1e6,
        uint256 potentialPayout,
        SettlementMode mode
    );
    event TicketSettled(uint256 indexed ticketId, TicketStatus status);
    event PayoutClaimed(uint256 indexed ticketId, address indexed winner, uint256 amount);
    event BaseFeeUpdated(uint256 oldFee, uint256 newFee);
    event PerLegFeeUpdated(uint256 oldFee, uint256 newFee);
    event MinStakeUpdated(uint256 oldStake, uint256 newStake);
    event MaxLegsUpdated(uint256 oldMaxLegs, uint256 newMaxLegs);

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(
        HouseVault _vault,
        LegRegistry _registry,
        IERC20 _usdc,
        uint256 _bootstrapEndsAt
    ) ERC721("ParlayCity Ticket", "PCKT") Ownable(msg.sender) {
        vault = _vault;
        registry = _registry;
        usdc = _usdc;
        bootstrapEndsAt = _bootstrapEndsAt;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setBaseFee(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "ParlayEngine: baseFee too high");
        emit BaseFeeUpdated(baseFee, _bps);
        baseFee = _bps;
    }

    function setPerLegFee(uint256 _bps) external onlyOwner {
        require(_bps <= 500, "ParlayEngine: perLegFee too high");
        emit PerLegFeeUpdated(perLegFee, _bps);
        perLegFee = _bps;
    }

    function setMinStake(uint256 _minStake) external onlyOwner {
        require(_minStake >= 1e6, "ParlayEngine: minStake too low");
        emit MinStakeUpdated(minStake, _minStake);
        minStake = _minStake;
    }

    function setMaxLegs(uint256 _maxLegs) external onlyOwner {
        require(_maxLegs >= 2 && _maxLegs <= 10, "ParlayEngine: invalid maxLegs");
        emit MaxLegsUpdated(maxLegs, _maxLegs);
        maxLegs = _maxLegs;
    }

    // ── Views ────────────────────────────────────────────────────────────

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        require(ticketId < _nextTicketId, "ParlayEngine: invalid ticketId");
        return _tickets[ticketId];
    }

    function ticketCount() external view returns (uint256) {
        return _nextTicketId;
    }

    // ── Core Logic ───────────────────────────────────────────────────────

    /// @notice Purchase a parlay ticket by combining multiple legs.
    function buyTicket(
        uint256[] calldata legIds,
        bytes32[] calldata outcomes,
        uint256 stake
    ) external nonReentrant whenNotPaused returns (uint256 ticketId) {
        // --- Validations ---
        require(legIds.length >= 2, "ParlayEngine: need >= 2 legs");
        require(legIds.length <= maxLegs, "ParlayEngine: too many legs");
        require(legIds.length == outcomes.length, "ParlayEngine: length mismatch");
        require(stake >= minStake, "ParlayEngine: stake too low");

        // Check legs are valid, active, not past cutoff, and no duplicates
        uint256[] memory probsPPM = new uint256[](legIds.length);
        for (uint256 i = 0; i < legIds.length; i++) {
            LegRegistry.Leg memory leg = registry.getLeg(legIds[i]);
            require(leg.active, "ParlayEngine: leg not active");
            require(block.timestamp < leg.cutoffTime, "ParlayEngine: cutoff passed");

            // Duplicate check (O(n^2) but n <= 5 so fine)
            for (uint256 j = 0; j < i; j++) {
                require(legIds[i] != legIds[j], "ParlayEngine: duplicate leg");
            }

            probsPPM[i] = leg.probabilityPPM;
        }

        // --- Compute pricing ---
        uint256 multiplierX1e6 = ParlayMath.computeMultiplier(probsPPM);
        uint256 totalEdgeBps = ParlayMath.computeEdge(legIds.length, baseFee, perLegFee);
        uint256 feePaid = (stake * totalEdgeBps) / 10_000;
        uint256 effectiveStake = stake - feePaid;
        uint256 potentialPayout = ParlayMath.computePayout(effectiveStake, multiplierX1e6);

        // --- Vault capacity check ---
        require(potentialPayout <= vault.maxPayout(), "ParlayEngine: exceeds vault max payout");
        require(potentialPayout <= vault.freeLiquidity(), "ParlayEngine: insufficient vault liquidity");

        // --- Transfer USDC from buyer to vault ---
        usdc.safeTransferFrom(msg.sender, address(vault), stake);

        // --- Reserve the payout ---
        vault.reservePayout(potentialPayout);

        // --- Mint NFT ticket ---
        ticketId = _nextTicketId++;
        _mint(msg.sender, ticketId);

        SettlementMode mode = block.timestamp < bootstrapEndsAt ? SettlementMode.FAST : SettlementMode.OPTIMISTIC;

        // Clone legIds and outcomes into storage
        _tickets[ticketId] = Ticket({
            buyer: msg.sender,
            stake: stake,
            legIds: legIds,
            outcomes: outcomes,
            multiplierX1e6: multiplierX1e6,
            potentialPayout: potentialPayout,
            feePaid: feePaid,
            mode: mode,
            status: TicketStatus.Active,
            createdAt: block.timestamp
        });

        emit TicketPurchased(ticketId, msg.sender, legIds, outcomes, stake, multiplierX1e6, potentialPayout, mode);
    }

    /// @notice Settle a ticket by checking oracle results for every leg.
    ///         Anyone can call this (permissionless settlement).
    function settleTicket(uint256 ticketId) external nonReentrant whenNotPaused {
        require(ticketId < _nextTicketId, "ParlayEngine: invalid ticketId");
        Ticket storage ticket = _tickets[ticketId];
        require(ticket.status == TicketStatus.Active, "ParlayEngine: not active");

        bool allWon = true;
        bool anyLost = false;
        uint256 voidedCount = 0;

        for (uint256 i = 0; i < ticket.legIds.length; i++) {
            LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
            IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);
            require(oracle.canResolve(ticket.legIds[i]), "ParlayEngine: leg not resolvable");

            (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);

            if (legStatus == LegStatus.Lost) {
                anyLost = true;
                allWon = false;
                break;
            } else if (legStatus == LegStatus.Voided) {
                voidedCount++;
                allWon = false;
            } else if (legStatus == LegStatus.Won) {
                // continue checking
            } else {
                revert("ParlayEngine: unexpected leg status");
            }
        }

        uint256 originalPayout = ticket.potentialPayout;

        if (anyLost) {
            ticket.status = TicketStatus.Lost;
            vault.releasePayout(originalPayout);
        } else if (allWon) {
            ticket.status = TicketStatus.Won;
            // payout stays reserved until claim
        } else {
            // Some legs voided, rest won. Recalculate with remaining legs.
            uint256 remainingLegs = ticket.legIds.length - voidedCount;
            if (remainingLegs < 2) {
                // Not enough legs for a valid parlay, void the ticket
                ticket.status = TicketStatus.Voided;
                vault.releasePayout(originalPayout);
            } else {
                // Recalculate multiplier with only the non-voided legs
                uint256[] memory remainingProbs = new uint256[](remainingLegs);
                uint256 idx = 0;
                for (uint256 i = 0; i < ticket.legIds.length; i++) {
                    LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
                    IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);
                    (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);
                    if (legStatus != LegStatus.Voided) {
                        remainingProbs[idx++] = leg.probabilityPPM;
                    }
                }

                uint256 newMultiplier = ParlayMath.computeMultiplier(remainingProbs);
                uint256 totalEdgeBps = ParlayMath.computeEdge(remainingLegs, baseFee, perLegFee);
                uint256 effectiveStake = ticket.stake - ticket.feePaid;
                uint256 newPayout = ParlayMath.computePayout(effectiveStake, newMultiplier);

                // Apply edge
                newPayout = (newPayout * (10_000 - totalEdgeBps)) / 10_000;

                if (newPayout < originalPayout) {
                    vault.releasePayout(originalPayout - newPayout);
                }
                // If newPayout > originalPayout we cap at original (vault already reserved that much)
                if (newPayout > originalPayout) {
                    newPayout = originalPayout;
                }

                ticket.potentialPayout = newPayout;
                ticket.multiplierX1e6 = newMultiplier;
                ticket.status = TicketStatus.Won;
            }
        }

        emit TicketSettled(ticketId, ticket.status);
    }

    /// @notice Claim the payout for a winning ticket.
    function claimPayout(uint256 ticketId) external nonReentrant whenNotPaused {
        require(ticketId < _nextTicketId, "ParlayEngine: invalid ticketId");
        Ticket storage ticket = _tickets[ticketId];
        require(ticket.status == TicketStatus.Won, "ParlayEngine: not won");
        require(ownerOf(ticketId) == msg.sender, "ParlayEngine: not ticket owner");

        ticket.status = TicketStatus.Claimed;
        vault.payWinner(msg.sender, ticket.potentialPayout);

        emit PayoutClaimed(ticketId, msg.sender, ticket.potentialPayout);
    }
}
