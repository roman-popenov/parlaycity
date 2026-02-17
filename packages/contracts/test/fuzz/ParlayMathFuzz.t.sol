// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParlayMath} from "../../src/libraries/ParlayMath.sol";

contract ParlayMathFuzzTest is Test {
    /// @notice Multiplier never overflows for 1-5 legs with reasonable probabilities.
    ///         We bound each probability to [10_000, 1_000_000] (1% to 100%).
    function testFuzz_computeMultiplier_noOverflow(uint256 p0, uint256 p1, uint256 p2) public pure {
        p0 = bound(p0, 10_000, 1_000_000);
        p1 = bound(p1, 10_000, 1_000_000);
        p2 = bound(p2, 10_000, 1_000_000);

        uint256[] memory probs = new uint256[](3);
        probs[0] = p0;
        probs[1] = p1;
        probs[2] = p2;

        uint256 mult = ParlayMath.computeMultiplier(probs);
        // Multiplier should be >= 1x (probs <= 1e6)
        assertGe(mult, 1_000_000);
    }

    /// @notice Payout computation is consistent: payout = stake * multiplier / 1e6.
    function testFuzz_computePayout_consistency(uint256 stake, uint256 multiplier) public pure {
        // Keep values reasonable to avoid overflow in multiplication
        stake = bound(stake, 0, 1e12); // up to 1M USDC (1e12 with 6 decimals)
        multiplier = bound(multiplier, 1_000_000, 1_000_000_000); // 1x to 1000x

        uint256 payout = ParlayMath.computePayout(stake, multiplier);
        // Payout should equal stake * multiplier / 1e6
        assertEq(payout, (stake * multiplier) / 1e6);
    }

    /// @notice Edge computation is always additive and deterministic.
    function testFuzz_computeEdge_additive(uint256 numLegs, uint256 baseBps, uint256 perLegBps) public pure {
        numLegs = bound(numLegs, 0, 10);
        baseBps = bound(baseBps, 0, 5000);
        perLegBps = bound(perLegBps, 0, 1000);

        uint256 edge = ParlayMath.computeEdge(numLegs, baseBps, perLegBps);
        assertEq(edge, baseBps + numLegs * perLegBps);
    }

    /// @notice ApplyEdge always produces result <= input (edge reduces the multiplier).
    function testFuzz_applyEdge_reduces(uint256 multiplier, uint256 edgeBps) public pure {
        multiplier = bound(multiplier, 1_000_000, 1_000_000_000);
        edgeBps = bound(edgeBps, 0, 9999);

        uint256 net = ParlayMath.applyEdge(multiplier, edgeBps);
        assertLe(net, multiplier);
    }

    /// @notice Multiplier scales inversely with probability.
    function testFuzz_multiplier_inverseProp(uint256 p1, uint256 p2) public pure {
        p1 = bound(p1, 10_000, 500_000);
        p2 = bound(p2, p1 + 1, 1_000_000);

        uint256[] memory probs1 = new uint256[](1);
        probs1[0] = p1;
        uint256[] memory probs2 = new uint256[](1);
        probs2[0] = p2;

        uint256 mult1 = ParlayMath.computeMultiplier(probs1);
        uint256 mult2 = ParlayMath.computeMultiplier(probs2);

        // Lower probability => higher multiplier
        assertGt(mult1, mult2);
    }

    /// @notice 4-leg multiplier never overflows with reasonable probabilities.
    function testFuzz_computeMultiplier_4legs(uint256 p0, uint256 p1, uint256 p2, uint256 p3) public pure {
        p0 = bound(p0, 10_000, 1_000_000);
        p1 = bound(p1, 10_000, 1_000_000);
        p2 = bound(p2, 10_000, 1_000_000);
        p3 = bound(p3, 10_000, 1_000_000);

        uint256[] memory probs = new uint256[](4);
        probs[0] = p0;
        probs[1] = p1;
        probs[2] = p2;
        probs[3] = p3;

        uint256 mult = ParlayMath.computeMultiplier(probs);
        assertGe(mult, 1_000_000);
    }

    /// @notice 5-leg multiplier never overflows with reasonable probabilities.
    function testFuzz_computeMultiplier_5legs(uint256 p0, uint256 p1, uint256 p2, uint256 p3, uint256 p4) public pure {
        p0 = bound(p0, 10_000, 1_000_000);
        p1 = bound(p1, 10_000, 1_000_000);
        p2 = bound(p2, 10_000, 1_000_000);
        p3 = bound(p3, 10_000, 1_000_000);
        p4 = bound(p4, 10_000, 1_000_000);

        uint256[] memory probs = new uint256[](5);
        probs[0] = p0;
        probs[1] = p1;
        probs[2] = p2;
        probs[3] = p3;
        probs[4] = p4;

        uint256 mult = ParlayMath.computeMultiplier(probs);
        assertGe(mult, 1_000_000);
    }

    /// @notice Multiplier with very low probabilities (down to 1 PPM = 0.0001%).
    function testFuzz_computeMultiplier_lowBound(uint256 p0, uint256 p1) public pure {
        p0 = bound(p0, 1, 1_000_000);
        p1 = bound(p1, 1, 1_000_000);

        uint256[] memory probs = new uint256[](2);
        probs[0] = p0;
        probs[1] = p1;

        uint256 mult = ParlayMath.computeMultiplier(probs);
        assertGe(mult, 1_000_000);
    }

    /// @notice applyEdge with full range and precise verification.
    function testFuzz_applyEdge_fullRange(uint256 multiplier, uint256 edgeBps) public pure {
        multiplier = bound(multiplier, 1_000_000, 1_000_000_000);
        edgeBps = bound(edgeBps, 0, 9999);

        uint256 net = ParlayMath.applyEdge(multiplier, edgeBps);
        assertLe(net, multiplier);

        if (edgeBps == 0) {
            assertEq(net, multiplier);
        }
        if (edgeBps > 0) {
            assertLt(net, multiplier);
        }
    }

    /// @notice Adding more legs always increases the multiplier (probs < 100%).
    function testFuzz_moreLegsBiggerMultiplier(uint256 p0, uint256 p1, uint256 p2) public pure {
        p0 = bound(p0, 10_000, 999_999);
        p1 = bound(p1, 10_000, 999_999);
        p2 = bound(p2, 10_000, 999_999);

        uint256[] memory twoLegs = new uint256[](2);
        twoLegs[0] = p0;
        twoLegs[1] = p1;

        uint256[] memory threeLegs = new uint256[](3);
        threeLegs[0] = p0;
        threeLegs[1] = p1;
        threeLegs[2] = p2;

        uint256 mult2 = ParlayMath.computeMultiplier(twoLegs);
        uint256 mult3 = ParlayMath.computeMultiplier(threeLegs);

        assertGt(mult3, mult2);
    }
}
