// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOracleAdapter, LegStatus} from "../interfaces/IOracleAdapter.sol";

/// @title OptimisticOracleAdapter
/// @notice Optimistic oracle with propose-challenge-finalize pattern.
///         Anyone can propose a resolution with a bond. If no challenge within
///         the liveness window, the proposal finalizes. If challenged, the owner
///         arbitrates. Loser's bond is slashed.
contract OptimisticOracleAdapter is IOracleAdapter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────

    enum ProposalState {
        None,
        Proposed,
        Challenged,
        Finalized
    }

    struct Proposal {
        address proposer;
        LegStatus proposedStatus;
        bytes32 proposedOutcome;
        uint256 proposedAt;
        ProposalState state;
        address challenger;
        uint256 bondPosted;
        uint256 challengerBond;
        uint256 livenessPosted;
    }

    // ── State ────────────────────────────────────────────────────────────

    IERC20 public immutable bondToken;
    uint256 public livenessWindow;
    uint256 public bondAmount;

    mapping(uint256 => Proposal) public proposals;

    // Final resolutions (after finalize or dispute resolution)
    mapping(uint256 => LegStatus) private _finalStatus;
    mapping(uint256 => bytes32) private _finalOutcome;
    mapping(uint256 => bool) private _isFinalized;

    // ── Events ───────────────────────────────────────────────────────────

    event Proposed(uint256 indexed legId, address indexed proposer, LegStatus status, bytes32 outcome);
    event Challenged(uint256 indexed legId, address indexed challenger);
    event Finalized(uint256 indexed legId, LegStatus status, bytes32 outcome);
    event DisputeResolved(uint256 indexed legId, LegStatus status, bytes32 outcome, address winner, address loser);

    // ── Constructor ──────────────────────────────────────────────────────

    constructor(IERC20 _bondToken, uint256 _livenessWindow, uint256 _bondAmount) Ownable(msg.sender) {
        bondToken = _bondToken;
        livenessWindow = _livenessWindow;
        bondAmount = _bondAmount;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setLivenessWindow(uint256 _window) external onlyOwner {
        livenessWindow = _window;
    }

    function setBondAmount(uint256 _amount) external onlyOwner {
        bondAmount = _amount;
    }

    // ── Propose ──────────────────────────────────────────────────────────

    /// @notice Propose a resolution for a leg. Requires posting a bond.
    function propose(uint256 legId, LegStatus status, bytes32 outcome) external nonReentrant {
        require(!_isFinalized[legId], "OptimisticOracle: already finalized");
        require(proposals[legId].state == ProposalState.None, "OptimisticOracle: proposal exists");
        require(status != LegStatus.Unresolved, "OptimisticOracle: cannot propose Unresolved");

        bondToken.safeTransferFrom(msg.sender, address(this), bondAmount);

        proposals[legId] = Proposal({
            proposer: msg.sender,
            proposedStatus: status,
            proposedOutcome: outcome,
            proposedAt: block.timestamp,
            state: ProposalState.Proposed,
            challenger: address(0),
            bondPosted: bondAmount,
            challengerBond: 0,
            livenessPosted: livenessWindow
        });

        emit Proposed(legId, msg.sender, status, outcome);
    }

    // ── Challenge ────────────────────────────────────────────────────────

    /// @notice Challenge an active proposal. Requires posting a bond.
    function challenge(uint256 legId) external nonReentrant {
        Proposal storage p = proposals[legId];
        require(p.state == ProposalState.Proposed, "OptimisticOracle: not proposed");
        require(block.timestamp < p.proposedAt + p.livenessPosted, "OptimisticOracle: liveness expired");
        require(msg.sender != p.proposer, "OptimisticOracle: cannot self-challenge");

        uint256 requiredBond = p.bondPosted;
        bondToken.safeTransferFrom(msg.sender, address(this), requiredBond);
        p.state = ProposalState.Challenged;
        p.challenger = msg.sender;
        p.challengerBond = requiredBond;

        emit Challenged(legId, msg.sender);
    }

    // ── Finalize ─────────────────────────────────────────────────────────

    /// @notice Finalize an unchallenged proposal after the liveness window.
    function finalize(uint256 legId) external nonReentrant {
        Proposal storage p = proposals[legId];
        require(p.state == ProposalState.Proposed, "OptimisticOracle: not proposed");
        require(block.timestamp >= p.proposedAt + p.livenessPosted, "OptimisticOracle: liveness not expired");

        p.state = ProposalState.Finalized;
        _finalStatus[legId] = p.proposedStatus;
        _finalOutcome[legId] = p.proposedOutcome;
        _isFinalized[legId] = true;

        // Return bond to proposer
        bondToken.safeTransfer(p.proposer, p.bondPosted);

        emit Finalized(legId, p.proposedStatus, p.proposedOutcome);
    }

    // ── Dispute Resolution ───────────────────────────────────────────────

    /// @notice Owner resolves a dispute after a challenge.
    ///         If the proposer was correct, challenger's bond is slashed.
    ///         If the challenger was correct, proposer's bond is slashed.
    /// @param legId The disputed leg.
    /// @param status The correct resolution status.
    /// @param outcome The correct outcome hash.
    /// @param proposerCorrect True if the original proposer was correct.
    function resolveDispute(uint256 legId, LegStatus status, bytes32 outcome, bool proposerCorrect)
        external
        onlyOwner
        nonReentrant
    {
        Proposal storage p = proposals[legId];
        require(p.state == ProposalState.Challenged, "OptimisticOracle: not challenged");
        require(status != LegStatus.Unresolved, "OptimisticOracle: cannot resolve as Unresolved");

        p.state = ProposalState.Finalized;
        _finalStatus[legId] = status;
        _finalOutcome[legId] = outcome;
        _isFinalized[legId] = true;

        address winner;
        address loser;

        if (proposerCorrect) {
            winner = p.proposer;
            loser = p.challenger;
        } else {
            winner = p.challenger;
            loser = p.proposer;
        }

        // Winner gets both bonds (their own + loser's)
        // In a real system you'd take a protocol fee; keeping it simple for the hackathon.
        bondToken.safeTransfer(winner, p.bondPosted + p.challengerBond);

        emit DisputeResolved(legId, status, outcome, winner, loser);
    }

    // ── IOracleAdapter ───────────────────────────────────────────────────

    /// @inheritdoc IOracleAdapter
    function getStatus(uint256 legId) external view override returns (LegStatus status, bytes32 outcome) {
        if (!_isFinalized[legId]) {
            return (LegStatus.Unresolved, bytes32(0));
        }
        return (_finalStatus[legId], _finalOutcome[legId]);
    }

    /// @inheritdoc IOracleAdapter
    function canResolve(uint256 legId) external view override returns (bool) {
        return _isFinalized[legId];
    }
}
