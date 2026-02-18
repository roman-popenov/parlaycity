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
    enum PayoutMode {
        CLASSIC,
        PROGRESSIVE,
        EARLY_CASHOUT
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
        PayoutMode payoutMode;
        uint256 claimedAmount;
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
    uint256 public baseCashoutPenaltyBps = 1500; // 15% base penalty

    /// @notice Fee split constants (BPS of feePaid).
    uint256 public constant FEE_TO_LOCKERS_BPS = 9000; // 90%
    uint256 public constant FEE_TO_SAFETY_BPS = 500; // 5%
    // Remaining 5% stays in vault implicitly

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
    event FeesRouted(uint256 indexed ticketId, uint256 feeToLockers, uint256 feeToSafety, uint256 feeToVault);
    event ProgressiveClaimed(uint256 indexed ticketId, address indexed claimer, uint256 amount, uint256 totalClaimed);
    event EarlyCashout(uint256 indexed ticketId, address indexed owner, uint256 cashoutValue, uint256 penaltyBps);
    event BaseCashoutPenaltyUpdated(uint256 oldBps, uint256 newBps);
    event BaseFeeUpdated(uint256 oldFee, uint256 newFee);
    event PerLegFeeUpdated(uint256 oldFee, uint256 newFee);
    event MinStakeUpdated(uint256 oldStake, uint256 newStake);
    event MaxLegsUpdated(uint256 oldMaxLegs, uint256 newMaxLegs);

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(HouseVault _vault, LegRegistry _registry, IERC20 _usdc, uint256 _bootstrapEndsAt)
        ERC721("ParlayCity Ticket", "PCKT")
        Ownable(msg.sender)
    {
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

    function setBaseCashoutPenalty(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "ParlayEngine: penalty too high");
        emit BaseCashoutPenaltyUpdated(baseCashoutPenaltyBps, _bps);
        baseCashoutPenaltyBps = _bps;
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

    /// @notice Purchase a classic parlay ticket (backward-compatible).
    function buyTicket(
        uint256[] calldata legIds,
        bytes32[] calldata outcomes,
        uint256 stake
    ) external nonReentrant whenNotPaused returns (uint256 ticketId) {
        return _buyTicket(legIds, outcomes, stake, PayoutMode.CLASSIC);
    }

    /// @notice Purchase a parlay ticket with a chosen payout mode.
    function buyTicketWithMode(
        uint256[] calldata legIds,
        bytes32[] calldata outcomes,
        uint256 stake,
        PayoutMode payoutMode
    ) external nonReentrant whenNotPaused returns (uint256 ticketId) {
        return _buyTicket(legIds, outcomes, stake, payoutMode);
    }

    function _buyTicket(
        uint256[] calldata legIds,
        bytes32[] calldata outcomes,
        uint256 stake,
        PayoutMode payoutMode
    ) internal returns (uint256 ticketId) {
        // --- Validations ---
        require(legIds.length >= 2, "ParlayEngine: need >= 2 legs");
        require(legIds.length <= maxLegs, "ParlayEngine: too many legs");
        require(legIds.length == outcomes.length, "ParlayEngine: length mismatch");
        require(stake >= minStake, "ParlayEngine: stake too low");

        uint256 multiplierX1e6;
        uint256 feePaid;
        uint256 potentialPayout;

        {
            // Scoped to avoid stack-too-deep
            uint256[] memory probsPPM = new uint256[](legIds.length);
            for (uint256 i = 0; i < legIds.length; i++) {
                LegRegistry.Leg memory leg = registry.getLeg(legIds[i]);
                require(leg.active, "ParlayEngine: leg not active");
                require(block.timestamp < leg.cutoffTime, "ParlayEngine: cutoff passed");

                for (uint256 j = 0; j < i; j++) {
                    require(legIds[i] != legIds[j], "ParlayEngine: duplicate leg");
                }

                if (outcomes[i] == bytes32(uint256(2))) {
                    probsPPM[i] = 1_000_000 - leg.probabilityPPM;
                } else {
                    probsPPM[i] = leg.probabilityPPM;
                }
            }

            multiplierX1e6 = ParlayMath.computeMultiplier(probsPPM);
            uint256 totalEdgeBps = ParlayMath.computeEdge(legIds.length, baseFee, perLegFee);
            feePaid = (stake * totalEdgeBps) / 10_000;
            uint256 effectiveStake = stake - feePaid;
            potentialPayout = ParlayMath.computePayout(effectiveStake, multiplierX1e6);
        }

        // --- Vault capacity check ---
        require(potentialPayout <= vault.maxPayout(), "ParlayEngine: exceeds vault max payout");
        require(potentialPayout <= vault.freeLiquidity(), "ParlayEngine: insufficient vault liquidity");

        // --- Transfer USDC from buyer to vault ---
        usdc.safeTransferFrom(msg.sender, address(vault), stake);

        // --- Reserve the payout ---
        vault.reservePayout(potentialPayout);

        // --- Route fees (90/5/5 split) ---
        if (feePaid > 0) {
            uint256 feeToLockers = (feePaid * FEE_TO_LOCKERS_BPS) / 10_000;
            uint256 feeToSafety = (feePaid * FEE_TO_SAFETY_BPS) / 10_000;
            uint256 feeToVault = feePaid - feeToLockers - feeToSafety; // dust goes to vault
            vault.routeFees(feeToLockers, feeToSafety, feeToVault);
            emit FeesRouted(_nextTicketId, feeToLockers, feeToSafety, feeToVault);
        }

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
            createdAt: block.timestamp,
            payoutMode: payoutMode,
            claimedAmount: 0
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

            // Determine if the bettor's chosen side won:
            // Yes bet (outcome != 0x02): wins when leg status is Won
            // No bet  (outcome == 0x02): wins when leg status is Lost
            bool isNoBet = ticket.outcomes[i] == bytes32(uint256(2));
            bool bettorWon;

            if (legStatus == LegStatus.Voided) {
                voidedCount++;
                allWon = false;
                continue;
            } else if (legStatus == LegStatus.Won) {
                bettorWon = !isNoBet; // Yes bettor wins, No bettor loses
            } else if (legStatus == LegStatus.Lost) {
                bettorWon = isNoBet; // No bettor wins, Yes bettor loses
            } else {
                revert("ParlayEngine: unexpected leg status");
            }

            if (!bettorWon) {
                anyLost = true;
                allWon = false;
                break;
            }
        }

        uint256 originalPayout = ticket.potentialPayout;

        if (anyLost) {
            ticket.status = TicketStatus.Lost;
            uint256 remainingReserve = originalPayout - ticket.claimedAmount;
            if (remainingReserve > 0) vault.releasePayout(remainingReserve);
        } else if (allWon) {
            ticket.status = TicketStatus.Won;
            // payout stays reserved until claim
        } else {
            // Some legs voided, rest won. Recalculate with remaining legs.
            uint256 remainingLegs = ticket.legIds.length - voidedCount;
            if (remainingLegs < 2) {
                // Not enough legs for a valid parlay, void the ticket
                ticket.status = TicketStatus.Voided;
                uint256 remainingReserve = originalPayout - ticket.claimedAmount;
                if (remainingReserve > 0) vault.releasePayout(remainingReserve);
                // Refund stake minus fee minus any progressive claims already paid out
                uint256 effectiveStake = ticket.stake - ticket.feePaid;
                uint256 refundAmount = effectiveStake > ticket.claimedAmount
                    ? effectiveStake - ticket.claimedAmount
                    : 0;
                if (refundAmount > 0) {
                    vault.refundVoided(ownerOf(ticketId), refundAmount);
                }
            } else {
                // Recalculate multiplier with only the non-voided legs
                uint256[] memory remainingProbs = new uint256[](remainingLegs);
                uint256 idx = 0;
                for (uint256 i = 0; i < ticket.legIds.length; i++) {
                    LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
                    IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);
                    (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);
                    if (legStatus != LegStatus.Voided) {
                        // Use complement for No bets, same as in buyTicket
                        if (ticket.outcomes[i] == bytes32(uint256(2))) {
                            remainingProbs[idx++] = 1_000_000 - leg.probabilityPPM;
                        } else {
                            remainingProbs[idx++] = leg.probabilityPPM;
                        }
                    }
                }

                uint256 newMultiplier = ParlayMath.computeMultiplier(remainingProbs);
                uint256 effectiveStake = ticket.stake - ticket.feePaid;
                uint256 newPayout = ParlayMath.computePayout(effectiveStake, newMultiplier);

                // Cap newPayout at originalPayout (vault only reserved that much)
                if (newPayout > originalPayout) {
                    newPayout = originalPayout;
                }

                // Account for progressive claims when releasing excess reserve
                if (newPayout > ticket.claimedAmount) {
                    // Some payout remains after claims; release the difference between original and new
                    if (originalPayout > newPayout) {
                        vault.releasePayout(originalPayout - newPayout);
                    }
                } else {
                    // Claims already exceed or match the recalculated payout
                    uint256 remainingReserve = originalPayout - ticket.claimedAmount;
                    if (remainingReserve > 0) vault.releasePayout(remainingReserve);
                    newPayout = ticket.claimedAmount;
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
        uint256 remaining = ticket.potentialPayout - ticket.claimedAmount;
        require(remaining > 0, "ParlayEngine: nothing to claim");
        vault.payWinner(msg.sender, remaining);

        emit PayoutClaimed(ticketId, msg.sender, remaining);
    }

    /// @notice Claim partial payout for a progressive ticket as legs resolve.
    function claimProgressive(uint256 ticketId) external nonReentrant whenNotPaused {
        require(ticketId < _nextTicketId, "ParlayEngine: invalid ticketId");
        Ticket storage ticket = _tickets[ticketId];
        require(ticket.payoutMode == PayoutMode.PROGRESSIVE, "ParlayEngine: not progressive");
        require(ticket.status == TicketStatus.Active, "ParlayEngine: not active");
        require(ownerOf(ticketId) == msg.sender, "ParlayEngine: not ticket owner");

        // Scan legs: count won, detect losses
        uint256 wonCount;
        bool anyLost;

        for (uint256 i = 0; i < ticket.legIds.length; i++) {
            LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
            IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);

            if (!oracle.canResolve(ticket.legIds[i])) continue; // unresolved, skip

            (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);

            if (legStatus == LegStatus.Voided) continue; // voided legs don't count

            bool isNoBet = ticket.outcomes[i] == bytes32(uint256(2));
            bool bettorWon;
            if (legStatus == LegStatus.Won) {
                bettorWon = !isNoBet;
            } else if (legStatus == LegStatus.Lost) {
                bettorWon = isNoBet;
            } else {
                continue;
            }

            if (!bettorWon) {
                anyLost = true;
                break;
            }
            wonCount++;
        }

        // If any leg lost -> mark ticket lost, release remaining reserve
        if (anyLost) {
            ticket.status = TicketStatus.Lost;
            uint256 remainingReserve = ticket.potentialPayout - ticket.claimedAmount;
            if (remainingReserve > 0) vault.releasePayout(remainingReserve);
            emit TicketSettled(ticketId, TicketStatus.Lost);
            return;
        }

        require(wonCount > 0, "ParlayEngine: no won legs to claim");

        // Collect won leg probabilities (second pass)
        uint256[] memory wonProbs = new uint256[](wonCount);
        uint256 idx;
        for (uint256 i = 0; i < ticket.legIds.length; i++) {
            LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
            IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);

            if (!oracle.canResolve(ticket.legIds[i])) continue;
            (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);
            if (legStatus == LegStatus.Voided) continue;

            // All non-voided resolved legs are won (we already checked for losses)
            if (ticket.outcomes[i] == bytes32(uint256(2))) {
                wonProbs[idx++] = 1_000_000 - leg.probabilityPPM;
            } else {
                wonProbs[idx++] = leg.probabilityPPM;
            }
        }

        // Compute partial payout from won legs
        uint256 partialMultiplier = ParlayMath.computeMultiplier(wonProbs);
        uint256 effectiveStake = ticket.stake - ticket.feePaid;
        uint256 partialPayout = ParlayMath.computePayout(effectiveStake, partialMultiplier);

        // Cap at potentialPayout
        if (partialPayout > ticket.potentialPayout) {
            partialPayout = ticket.potentialPayout;
        }

        uint256 claimable = partialPayout > ticket.claimedAmount ? partialPayout - ticket.claimedAmount : 0;
        require(claimable > 0, "ParlayEngine: nothing to claim");

        ticket.claimedAmount += claimable;
        vault.payWinner(msg.sender, claimable);

        emit ProgressiveClaimed(ticketId, msg.sender, claimable, ticket.claimedAmount);
    }

    /// @notice Cash out an EARLY_CASHOUT ticket before all legs resolve.
    /// @param ticketId The ticket to cash out.
    /// @param minOut Minimum cashout value (slippage protection).
    function cashoutEarly(uint256 ticketId, uint256 minOut) external nonReentrant whenNotPaused {
        require(ticketId < _nextTicketId, "ParlayEngine: invalid ticketId");
        Ticket storage ticket = _tickets[ticketId];
        require(ticket.payoutMode == PayoutMode.EARLY_CASHOUT, "ParlayEngine: not early cashout");
        require(ticket.status == TicketStatus.Active, "ParlayEngine: not active");
        require(ownerOf(ticketId) == msg.sender, "ParlayEngine: not ticket owner");

        uint256 wonCount;
        uint256 unresolvedCount;

        // First pass: categorize legs and check for losses
        {
            for (uint256 i = 0; i < ticket.legIds.length; i++) {
                LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
                IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);

                if (!oracle.canResolve(ticket.legIds[i])) {
                    unresolvedCount++;
                    continue;
                }

                (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);

                if (legStatus == LegStatus.Voided) {
                    unresolvedCount++;
                    continue;
                }

                bool isNoBet = ticket.outcomes[i] == bytes32(uint256(2));
                bool bettorWon;
                if (legStatus == LegStatus.Won) {
                    bettorWon = !isNoBet;
                } else if (legStatus == LegStatus.Lost) {
                    bettorWon = isNoBet;
                } else {
                    unresolvedCount++;
                    continue;
                }

                require(bettorWon, "ParlayEngine: leg already lost");
                wonCount++;
            }
        }

        require(wonCount > 0, "ParlayEngine: need at least 1 won leg");
        require(unresolvedCount > 0, "ParlayEngine: all resolved, use settleTicket");

        // Second pass: collect won and unresolved probabilities
        uint256[] memory wonProbs = new uint256[](wonCount);
        uint256[] memory unresolvedProbs = new uint256[](unresolvedCount);

        {
            uint256 wIdx;
            uint256 uIdx;

            for (uint256 i = 0; i < ticket.legIds.length; i++) {
                LegRegistry.Leg memory leg = registry.getLeg(ticket.legIds[i]);
                IOracleAdapter oracle = IOracleAdapter(leg.oracleAdapter);

                uint256 prob = ticket.outcomes[i] == bytes32(uint256(2))
                    ? 1_000_000 - leg.probabilityPPM
                    : leg.probabilityPPM;

                if (!oracle.canResolve(ticket.legIds[i])) {
                    unresolvedProbs[uIdx++] = prob;
                    continue;
                }

                (LegStatus legStatus,) = oracle.getStatus(ticket.legIds[i]);

                if (legStatus == LegStatus.Voided) {
                    unresolvedProbs[uIdx++] = prob;
                    continue;
                }

                // Must be a won leg (losses already reverted above)
                wonProbs[wIdx++] = prob;
            }
        }

        // Compute cashout value and pay
        {
            uint256 effectiveStake = ticket.stake - ticket.feePaid;
            (uint256 cashoutValue, uint256 penaltyBps) = ParlayMath.computeCashoutValue(
                effectiveStake,
                wonProbs,
                unresolvedProbs,
                baseCashoutPenaltyBps,
                ticket.legIds.length,
                ticket.potentialPayout
            );

            uint256 payout = cashoutValue > ticket.claimedAmount ? cashoutValue - ticket.claimedAmount : 0;
            require(payout >= minOut, "ParlayEngine: below min cashout");

            ticket.status = TicketStatus.Claimed;
            ticket.claimedAmount += payout;

            vault.payWinner(msg.sender, payout);
            uint256 remainingReserve = ticket.potentialPayout - ticket.claimedAmount;
            if (remainingReserve > 0) vault.releasePayout(remainingReserve);

            emit EarlyCashout(ticketId, msg.sender, payout, penaltyBps);
        }
    }
}
