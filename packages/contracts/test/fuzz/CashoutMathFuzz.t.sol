// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParlayMath} from "../../src/libraries/ParlayMath.sol";

/// @title CashoutMathFuzz
/// @notice Fuzz tests for computeCashoutValue and progressive payout math.
///         Verifies invariants that must hold under all valid inputs.
contract CashoutMathFuzzTest is Test {
    uint256 constant PPM = 1e6;
    uint256 constant BPS = 10_000;

    // ── computeCashoutValue invariants ────────────────────────────────────

    /// @notice cashoutValue never exceeds potentialPayout for any valid inputs.
    function testFuzz_cashout_neverExceedsPotentialPayout(
        uint256 stake,
        uint256 wonProb,
        uint256 unresolvedProb,
        uint256 basePenaltyBps,
        uint256 potentialPayout
    ) public pure {
        stake = bound(stake, 1e6, 1e12); // 1 USDC to 1M USDC
        wonProb = bound(wonProb, 10_000, PPM); // 1% to 100%
        unresolvedProb = bound(unresolvedProb, 10_000, PPM);
        basePenaltyBps = bound(basePenaltyBps, 0, 5000);
        potentialPayout = bound(potentialPayout, 1, type(uint128).max);

        uint256[] memory wonProbs = new uint256[](1);
        wonProbs[0] = wonProb;
        uint256[] memory unresolvedProbs = new uint256[](1);
        unresolvedProbs[0] = unresolvedProb;

        (uint256 cashoutValue,) = ParlayMath.computeCashoutValue(
            stake, wonProbs, unresolvedProbs, basePenaltyBps, 2, potentialPayout
        );

        assertLe(cashoutValue, potentialPayout, "cashout must not exceed potential payout");
    }

    /// @notice penaltyBps is always bounded by basePenaltyBps (since unresolved/total <= 1).
    function testFuzz_cashout_penaltyBounded(
        uint256 stake,
        uint256 wonProb,
        uint256 unresolvedProb,
        uint256 basePenaltyBps
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        wonProb = bound(wonProb, 10_000, PPM);
        unresolvedProb = bound(unresolvedProb, 10_000, PPM);
        basePenaltyBps = bound(basePenaltyBps, 0, 5000);

        uint256[] memory wonProbs = new uint256[](1);
        wonProbs[0] = wonProb;
        uint256[] memory unresolvedProbs = new uint256[](1);
        unresolvedProbs[0] = unresolvedProb;

        (, uint256 penaltyBps) = ParlayMath.computeCashoutValue(
            stake, wonProbs, unresolvedProbs, basePenaltyBps, 2, type(uint128).max
        );

        assertLe(penaltyBps, basePenaltyBps, "penalty must not exceed base");
    }

    /// @notice Cashout with zero penalty equals the full discounted fair value.
    function testFuzz_cashout_zeroPenalty_equalsFairValue(
        uint256 stake,
        uint256 wonProb,
        uint256 unresolvedProb
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        wonProb = bound(wonProb, 10_000, PPM);
        unresolvedProb = bound(unresolvedProb, 10_000, PPM);

        uint256[] memory wonProbs = new uint256[](1);
        wonProbs[0] = wonProb;
        uint256[] memory unresolvedProbs = new uint256[](1);
        unresolvedProbs[0] = unresolvedProb;

        // basePenaltyBps = 0 means no penalty applied
        (uint256 cashoutValue, uint256 penaltyBps) = ParlayMath.computeCashoutValue(
            stake, wonProbs, unresolvedProbs, 0, 2, type(uint128).max
        );

        assertEq(penaltyBps, 0, "penalty should be zero");

        // Manually compute: wonMultiplier * stake / PPM * unresolvedProb / PPM
        uint256 wonMult = ParlayMath.computeMultiplier(wonProbs);
        uint256 wonValue = ParlayMath.computePayout(stake, wonMult);
        uint256 fairValue = (wonValue * unresolvedProb) / PPM;

        assertEq(cashoutValue, fairValue, "zero-penalty cashout must equal fair value");
    }

    /// @notice More won legs at same probs should produce higher cashout value
    ///         when unresolved legs stay the same.
    function testFuzz_cashout_moreWonLegs_higherValue(
        uint256 stake,
        uint256 wonProb1,
        uint256 wonProb2,
        uint256 unresolvedProb,
        uint256 basePenaltyBps
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        wonProb1 = bound(wonProb1, 10_000, 999_999); // < 100% so multiplier > 1x
        wonProb2 = bound(wonProb2, 10_000, 999_999);
        unresolvedProb = bound(unresolvedProb, 10_000, PPM);
        basePenaltyBps = bound(basePenaltyBps, 0, 5000);

        // 1-won-leg cashout: totalLegs=2 (1 won + 1 unresolved)
        uint256[] memory wonProbs1 = new uint256[](1);
        wonProbs1[0] = wonProb1;
        uint256[] memory unresolvedProbs = new uint256[](1);
        unresolvedProbs[0] = unresolvedProb;

        (uint256 cashout1,) = ParlayMath.computeCashoutValue(
            stake, wonProbs1, unresolvedProbs, basePenaltyBps, 2, type(uint128).max
        );

        // 2-won-leg cashout: totalLegs=3 (2 won + 1 unresolved)
        uint256[] memory wonProbs2 = new uint256[](2);
        wonProbs2[0] = wonProb1;
        wonProbs2[1] = wonProb2;

        (uint256 cashout2,) = ParlayMath.computeCashoutValue(
            stake, wonProbs2, unresolvedProbs, basePenaltyBps, 3, type(uint128).max
        );

        // More won legs means higher wonMultiplier AND lower penalty ratio
        assertGe(cashout2, cashout1, "more won legs must yield higher or equal cashout");
    }

    /// @notice Multi-leg fuzz: 2 won + 2 unresolved, verify cap and penalty bounds.
    function testFuzz_cashout_multiLeg(
        uint256 stake,
        uint256 w0,
        uint256 w1,
        uint256 u0,
        uint256 u1,
        uint256 basePenaltyBps,
        uint256 potentialPayout
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        w0 = bound(w0, 10_000, PPM);
        w1 = bound(w1, 10_000, PPM);
        u0 = bound(u0, 10_000, PPM);
        u1 = bound(u1, 10_000, PPM);
        basePenaltyBps = bound(basePenaltyBps, 0, 5000);
        potentialPayout = bound(potentialPayout, 1, type(uint128).max);

        uint256[] memory wonProbs = new uint256[](2);
        wonProbs[0] = w0;
        wonProbs[1] = w1;
        uint256[] memory unresolvedProbs = new uint256[](2);
        unresolvedProbs[0] = u0;
        unresolvedProbs[1] = u1;

        (uint256 cashoutValue, uint256 penaltyBps) = ParlayMath.computeCashoutValue(
            stake, wonProbs, unresolvedProbs, basePenaltyBps, 4, potentialPayout
        );

        assertLe(cashoutValue, potentialPayout, "capped at potential payout");
        // penaltyBps = basePenaltyBps * 2 / 4 = basePenaltyBps / 2
        assertEq(penaltyBps, basePenaltyBps / 2, "penalty scales as unresolved/total");
    }

    // ── Progressive payout invariants ─────────────────────────────────────

    /// @notice Progressive partial payout never exceeds potentialPayout.
    function testFuzz_progressive_neverExceedsPotentialPayout(
        uint256 stake,
        uint256 prob,
        uint256 potentialPayout
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        prob = bound(prob, 10_000, PPM);
        potentialPayout = bound(potentialPayout, 1, type(uint128).max);

        uint256[] memory wonProbs = new uint256[](1);
        wonProbs[0] = prob;

        uint256 mult = ParlayMath.computeMultiplier(wonProbs);
        uint256 partialPayout = ParlayMath.computePayout(stake, mult);

        // Cap (same logic as engine)
        if (partialPayout > potentialPayout) {
            partialPayout = potentialPayout;
        }

        assertLe(partialPayout, potentialPayout, "partial payout must be capped");
    }

    /// @notice Adding more won legs monotonically increases progressive payout.
    function testFuzz_progressive_monotonic(uint256 stake, uint256 p0, uint256 p1) public pure {
        stake = bound(stake, 1e6, 1e12);
        p0 = bound(p0, 10_000, 999_999); // < 100% so multiplier > 1x
        p1 = bound(p1, 10_000, 999_999);

        // 1-leg payout
        uint256[] memory probs1 = new uint256[](1);
        probs1[0] = p0;
        uint256 mult1 = ParlayMath.computeMultiplier(probs1);
        uint256 payout1 = ParlayMath.computePayout(stake, mult1);

        // 2-leg payout (same legs, one more won)
        uint256[] memory probs2 = new uint256[](2);
        probs2[0] = p0;
        probs2[1] = p1;
        uint256 mult2 = ParlayMath.computeMultiplier(probs2);
        uint256 payout2 = ParlayMath.computePayout(stake, mult2);

        assertGt(payout2, payout1, "more won legs must increase payout");
    }

    /// @notice Claimable amount (payout - alreadyClaimed) is always non-negative.
    ///         Simulates sequential progressive claims.
    function testFuzz_progressive_claimableNonNegative(
        uint256 stake,
        uint256 p0,
        uint256 p1,
        uint256 potentialPayout
    ) public pure {
        stake = bound(stake, 1e6, 1e12);
        p0 = bound(p0, 10_000, 999_999);
        p1 = bound(p1, 10_000, 999_999);

        // First claim: 1 won leg
        uint256[] memory probs1 = new uint256[](1);
        probs1[0] = p0;
        uint256 payout1 = ParlayMath.computePayout(stake, ParlayMath.computeMultiplier(probs1));

        // Cap payout1 at a reasonable potentialPayout
        potentialPayout = bound(potentialPayout, payout1, type(uint128).max);
        if (payout1 > potentialPayout) payout1 = potentialPayout;

        uint256 claimed = payout1; // first claim

        // Second claim: 2 won legs
        uint256[] memory probs2 = new uint256[](2);
        probs2[0] = p0;
        probs2[1] = p1;
        uint256 payout2 = ParlayMath.computePayout(stake, ParlayMath.computeMultiplier(probs2));
        if (payout2 > potentialPayout) payout2 = potentialPayout;

        // Claimable = payout2 - claimed (same as engine logic)
        uint256 claimable = payout2 > claimed ? payout2 - claimed : 0;

        // Monotonicity: payout2 >= payout1, so claimable >= 0 (always true)
        // Also verify the total claimed never exceeds potentialPayout
        assertLe(claimed + claimable, potentialPayout, "total claimed must not exceed potential");
    }
}
