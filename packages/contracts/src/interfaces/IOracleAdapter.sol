// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum LegStatus {
    Unresolved,
    Won,
    Lost,
    Voided
}

interface IOracleAdapter {
    function getStatus(uint256 legId) external view returns (LegStatus status, bytes32 outcome);
    function canResolve(uint256 legId) external view returns (bool);
}
