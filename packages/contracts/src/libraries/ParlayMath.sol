// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ParlayMath
/// @notice Pure math library for parlay odds and payout calculations.
///         All probabilities are expressed in PPM (parts per million), so 500_000 = 50%.
///         Multipliers are expressed as X * 1e6 (e.g. 2x = 2_000_000).
library ParlayMath {
    uint256 internal constant PPM = 1e6;
    uint256 internal constant BPS = 10_000;

    /// @notice Compute the fair multiplier by chaining implied odds for each leg.
    ///         multiplier = product(1e6 / prob_i) across all legs, scaled to 1e6.
    /// @param probsPPM Array of leg probabilities in PPM (each must be > 0 and <= 1e6).
    /// @return multiplierX1e6 The combined fair multiplier scaled by 1e6.
    function computeMultiplier(uint256[] memory probsPPM) internal pure returns (uint256 multiplierX1e6) {
        require(probsPPM.length > 0, "ParlayMath: empty probs");
        multiplierX1e6 = PPM; // start at 1x (1_000_000)
        for (uint256 i = 0; i < probsPPM.length; i++) {
            require(probsPPM[i] > 0 && probsPPM[i] <= PPM, "ParlayMath: prob out of range");
            // multiplier = multiplier * (1e6 / prob_i)
            // To avoid precision loss: multiplier = multiplier * 1e6 / prob_i
            multiplierX1e6 = (multiplierX1e6 * PPM) / probsPPM[i];
        }
    }

    /// @notice Subtract the house edge from the fair multiplier.
    /// @param fairMultiplierX1e6 The fair multiplier (scaled by 1e6).
    /// @param edgeBps The house edge in basis points (e.g. 200 = 2%).
    /// @return netMultiplierX1e6 The net multiplier after edge deduction.
    function applyEdge(uint256 fairMultiplierX1e6, uint256 edgeBps) internal pure returns (uint256 netMultiplierX1e6) {
        require(edgeBps < BPS, "ParlayMath: edge >= 100%");
        netMultiplierX1e6 = (fairMultiplierX1e6 * (BPS - edgeBps)) / BPS;
    }

    /// @notice Compute the payout from a given stake and net multiplier.
    /// @param stake The wager amount (in token units, e.g. USDC with 6 decimals).
    /// @param netMultiplierX1e6 The net multiplier (scaled by 1e6).
    /// @return payout The total payout amount.
    function computePayout(uint256 stake, uint256 netMultiplierX1e6) internal pure returns (uint256 payout) {
        payout = (stake * netMultiplierX1e6) / PPM;
    }

    /// @notice Compute the total house edge for a parlay with `numLegs` legs.
    /// @param numLegs Number of legs in the parlay.
    /// @param baseBps Base edge in basis points.
    /// @param perLegBps Additional edge per leg in basis points.
    /// @return totalBps The total edge in basis points.
    function computeEdge(uint256 numLegs, uint256 baseBps, uint256 perLegBps)
        internal
        pure
        returns (uint256 totalBps)
    {
        totalBps = baseBps + (numLegs * perLegBps);
    }

    /// @notice Compute the cashout value for an early exit.
    /// @param effectiveStake The wager amount after fees.
    /// @param wonProbsPPM Probabilities of already-won legs (each in PPM).
    /// @param unresolvedCount Number of unresolved legs.
    /// @param basePenaltyBps Base penalty in bps (scaled by unresolved/total legs).
    /// @param totalLegs Total number of legs in the ticket.
    /// @param potentialPayout Maximum payout (cap).
    /// @return cashoutValue The amount the user receives.
    /// @return penaltyBps The applied penalty in bps.
    function computeCashoutValue(
        uint256 effectiveStake,
        uint256[] memory wonProbsPPM,
        uint256 unresolvedCount,
        uint256 basePenaltyBps,
        uint256 totalLegs,
        uint256 potentialPayout
    ) internal pure returns (uint256 cashoutValue, uint256 penaltyBps) {
        require(wonProbsPPM.length > 0, "ParlayMath: no won legs");
        require(unresolvedCount > 0, "ParlayMath: no unresolved legs");

        // Fair value = expected payout given won legs.
        // wonMultiplier = 1/product(wonProbs) in PPM; wonValue = stake / product(wonProbs).
        // This already equals Prob(unresolved win) × fullPayout because the unresolved
        // probabilities cancel out when deriving EV from won legs alone.
        // The penalty (below) prices in the risk of unresolved legs.
        uint256 wonMultiplier = computeMultiplier(wonProbsPPM);
        uint256 fairValue = computePayout(effectiveStake, wonMultiplier);

        // Apply scaled penalty: more unresolved legs = higher penalty
        penaltyBps = (basePenaltyBps * unresolvedCount) / totalLegs;
        cashoutValue = (fairValue * (BPS - penaltyBps)) / BPS;

        // Cap at potential payout
        if (cashoutValue > potentialPayout) {
            cashoutValue = potentialPayout;
        }
    }
}
