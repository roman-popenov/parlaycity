// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LegRegistry
/// @notice Owner-managed registry of betting legs (individual outcomes that
///         can be combined into parlays). Each leg references an oracle adapter
///         and carries its own probability estimate.
contract LegRegistry is Ownable {
    // ── Types ────────────────────────────────────────────────────────────

    struct Leg {
        string question;
        string sourceRef;
        uint256 cutoffTime;
        uint256 earliestResolve;
        address oracleAdapter;
        uint256 probabilityPPM; // probability * 1e6
        bool active;
    }

    // ── State ────────────────────────────────────────────────────────────

    mapping(uint256 => Leg) private _legs;
    uint256 private _legCount;

    // ── Events ───────────────────────────────────────────────────────────

    event LegCreated(uint256 indexed legId, string question, uint256 cutoffTime, uint256 probabilityPPM);
    event ProbabilityUpdated(uint256 indexed legId, uint256 oldPPM, uint256 newPPM);
    event LegDeactivated(uint256 indexed legId);

    // ── Constructor ──────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Admin ────────────────────────────────────────────────────────────

    /// @notice Create a new betting leg.
    function createLeg(
        string calldata question,
        string calldata sourceRef,
        uint256 cutoffTime,
        uint256 earliestResolve,
        address oracleAdapter,
        uint256 probabilityPPM
    ) external onlyOwner returns (uint256 legId) {
        require(oracleAdapter != address(0), "LegRegistry: zero oracle");
        require(probabilityPPM > 0 && probabilityPPM <= 1e6, "LegRegistry: invalid probability");
        require(cutoffTime > block.timestamp, "LegRegistry: cutoff in past");
        require(earliestResolve >= cutoffTime, "LegRegistry: resolve before cutoff");

        legId = _legCount++;
        _legs[legId] = Leg({
            question: question,
            sourceRef: sourceRef,
            cutoffTime: cutoffTime,
            earliestResolve: earliestResolve,
            oracleAdapter: oracleAdapter,
            probabilityPPM: probabilityPPM,
            active: true
        });

        emit LegCreated(legId, question, cutoffTime, probabilityPPM);
    }

    /// @notice Update the implied probability of a leg.
    function updateProbability(uint256 legId, uint256 newPPM) external onlyOwner {
        require(legId < _legCount, "LegRegistry: invalid legId");
        require(newPPM > 0 && newPPM <= 1e6, "LegRegistry: invalid probability");
        uint256 oldPPM = _legs[legId].probabilityPPM;
        _legs[legId].probabilityPPM = newPPM;
        emit ProbabilityUpdated(legId, oldPPM, newPPM);
    }

    /// @notice Deactivate a leg so it can no longer be included in new parlays.
    function deactivateLeg(uint256 legId) external onlyOwner {
        require(legId < _legCount, "LegRegistry: invalid legId");
        _legs[legId].active = false;
        emit LegDeactivated(legId);
    }

    // ── Views ────────────────────────────────────────────────────────────

    function getLeg(uint256 legId) external view returns (Leg memory) {
        require(legId < _legCount, "LegRegistry: invalid legId");
        return _legs[legId];
    }

    function legCount() external view returns (uint256) {
        return _legCount;
    }
}
