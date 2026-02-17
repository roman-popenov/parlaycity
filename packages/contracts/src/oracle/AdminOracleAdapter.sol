// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleAdapter, LegStatus} from "../interfaces/IOracleAdapter.sol";

/// @title AdminOracleAdapter
/// @notice FAST mode oracle: the contract owner manually resolves legs.
///         Used during the bootstrap phase when trusted admin resolution is acceptable.
contract AdminOracleAdapter is IOracleAdapter, Ownable {
    struct Resolution {
        LegStatus status;
        bytes32 outcome;
        bool resolved;
    }

    mapping(uint256 => Resolution) private _resolutions;

    event LegResolved(uint256 indexed legId, LegStatus status, bytes32 outcome);

    constructor() Ownable(msg.sender) {}

    /// @notice Resolve a leg. Only callable by the contract owner.
    function resolve(uint256 legId, LegStatus status, bytes32 outcome) external onlyOwner {
        require(status != LegStatus.Unresolved, "AdminOracle: cannot set Unresolved");
        require(!_resolutions[legId].resolved, "AdminOracle: already resolved");

        _resolutions[legId] = Resolution({status: status, outcome: outcome, resolved: true});

        emit LegResolved(legId, status, outcome);
    }

    /// @inheritdoc IOracleAdapter
    function getStatus(uint256 legId) external view override returns (LegStatus status, bytes32 outcome) {
        Resolution memory r = _resolutions[legId];
        if (!r.resolved) {
            return (LegStatus.Unresolved, bytes32(0));
        }
        return (r.status, r.outcome);
    }

    /// @inheritdoc IOracleAdapter
    function canResolve(uint256 legId) external view override returns (bool) {
        return _resolutions[legId].resolved;
    }
}
