// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParlayMath} from "../../src/libraries/ParlayMath.sol";

/// @dev Wrapper contract so vm.expectRevert can catch reverts from library calls
contract ParlayMathWrapper {
    function computeMultiplier(uint256[] memory probs) external pure returns (uint256) {
        return ParlayMath.computeMultiplier(probs);
    }

    function applyEdge(uint256 fairMultiplierX1e6, uint256 edgeBps) external pure returns (uint256) {
        return ParlayMath.applyEdge(fairMultiplierX1e6, edgeBps);
    }

    function computePayout(uint256 stake, uint256 netMultiplierX1e6) external pure returns (uint256) {
        return ParlayMath.computePayout(stake, netMultiplierX1e6);
    }

    function computeEdge(uint256 numLegs, uint256 baseBps, uint256 perLegBps) external pure returns (uint256) {
        return ParlayMath.computeEdge(numLegs, baseBps, perLegBps);
    }
}

contract ParlayMathTest is Test {
    ParlayMathWrapper wrapper;

    function setUp() public {
        wrapper = new ParlayMathWrapper();
    }

    // ── computeMultiplier ────────────────────────────────────────────────

    function test_computeMultiplier_singleLeg50Percent() public pure {
        uint256[] memory probs = new uint256[](1);
        probs[0] = 500_000; // 50%
        uint256 mult = ParlayMath.computeMultiplier(probs);
        // 1e6 / 0.5 = 2x = 2_000_000
        assertEq(mult, 2_000_000);
    }

    function test_computeMultiplier_twoLegs50Percent() public pure {
        uint256[] memory probs = new uint256[](2);
        probs[0] = 500_000;
        probs[1] = 500_000;
        uint256 mult = ParlayMath.computeMultiplier(probs);
        // 2x * 2x = 4x = 4_000_000
        assertEq(mult, 4_000_000);
    }

    function test_computeMultiplier_threeLegsVaryingProbs() public pure {
        uint256[] memory probs = new uint256[](3);
        probs[0] = 500_000; // 2x
        probs[1] = 250_000; // 4x
        probs[2] = 1_000_000; // 1x (certainty)
        uint256 mult = ParlayMath.computeMultiplier(probs);
        // 2 * 4 * 1 = 8x = 8_000_000
        assertEq(mult, 8_000_000);
    }

    function test_computeMultiplier_certainty() public pure {
        uint256[] memory probs = new uint256[](2);
        probs[0] = 1_000_000; // 100%
        probs[1] = 1_000_000; // 100%
        uint256 mult = ParlayMath.computeMultiplier(probs);
        assertEq(mult, 1_000_000); // 1x
    }

    function test_computeMultiplier_revertsOnZeroProb() public {
        uint256[] memory probs = new uint256[](1);
        probs[0] = 0;
        vm.expectRevert("ParlayMath: prob out of range");
        wrapper.computeMultiplier(probs);
    }

    function test_computeMultiplier_revertsOnProbAbove1e6() public {
        uint256[] memory probs = new uint256[](1);
        probs[0] = 1_000_001;
        vm.expectRevert("ParlayMath: prob out of range");
        wrapper.computeMultiplier(probs);
    }

    function test_computeMultiplier_revertsOnEmpty() public {
        uint256[] memory probs = new uint256[](0);
        vm.expectRevert("ParlayMath: empty probs");
        wrapper.computeMultiplier(probs);
    }

    // ── computeMultiplier parity (non-round inputs) ─────────────────────
    // These values serve as reference for the TS mirror. Any change here
    // must be reflected in packages/services/test/quote.test.ts.

    function test_computeMultiplier_nonRound_threeLegs() public pure {
        // 60% / 40% / 50% — intermediate truncation matters
        uint256[] memory probs = new uint256[](3);
        probs[0] = 600_000;
        probs[1] = 400_000;
        probs[2] = 500_000;
        // m = 1e6 -> 1e12/600000=1666666 -> 1666666e6/400000=4166665 -> 4166665e6/500000=8333330
        assertEq(ParlayMath.computeMultiplier(probs), 8_333_330);
    }

    function test_computeMultiplier_nonRound_twoLegs() public pure {
        // 333_333 (~33.3%) / 666_667 (~66.7%)
        uint256[] memory probs = new uint256[](2);
        probs[0] = 333_333;
        probs[1] = 666_667;
        assertEq(ParlayMath.computeMultiplier(probs), 4_500_002);
    }

    function test_computeMultiplier_nonRound_fourLegs() public pure {
        // 700_000 / 300_000 / 800_000 / 450_000
        uint256[] memory probs = new uint256[](4);
        probs[0] = 700_000;
        probs[1] = 300_000;
        probs[2] = 800_000;
        probs[3] = 450_000;
        uint256 mult = ParlayMath.computeMultiplier(probs);
        // m = 1e6 -> 1428571 -> 4761903 -> 5952378 -> 13227506
        assertEq(mult, 13_227_506);
    }

    function test_computeMultiplier_nonRound_fiveLegs() public pure {
        // 550_000 / 350_000 / 650_000 / 420_000 / 780_000
        uint256[] memory probs = new uint256[](5);
        probs[0] = 550_000;
        probs[1] = 350_000;
        probs[2] = 650_000;
        probs[3] = 420_000;
        probs[4] = 780_000;
        uint256 mult = ParlayMath.computeMultiplier(probs);
        assertEq(mult, 24_395_612);
    }

    function test_computeCashoutValue_nonRound_penalty() public pure {
        // penaltyBps = basePenaltyBps * unresolvedCount / totalLegs
        // 1500 * 2 / 7 = 428 (truncated from 428.57...)
        uint256[] memory wonProbs = new uint256[](1);
        wonProbs[0] = 500_000;
        (, uint256 penaltyBps) = ParlayMath.computeCashoutValue(
            10e6, wonProbs, 2, 1500, 7, type(uint128).max
        );
        assertEq(penaltyBps, 428);
    }

    // ── applyEdge ────────────────────────────────────────────────────────

    function test_applyEdge_200bps() public pure {
        // 4x multiplier, 2% edge => 4 * 0.98 = 3.92x
        uint256 net = ParlayMath.applyEdge(4_000_000, 200);
        assertEq(net, 3_920_000);
    }

    function test_applyEdge_zeroEdge() public pure {
        uint256 net = ParlayMath.applyEdge(4_000_000, 0);
        assertEq(net, 4_000_000);
    }

    function test_applyEdge_revertsOn100Percent() public {
        vm.expectRevert("ParlayMath: edge >= 100%");
        wrapper.applyEdge(4_000_000, 10_000);
    }

    // ── computePayout ────────────────────────────────────────────────────

    function test_computePayout_basic() public pure {
        // 10 USDC stake, 4x multiplier => 40 USDC
        uint256 payout = ParlayMath.computePayout(10e6, 4_000_000);
        assertEq(payout, 40e6);
    }

    function test_computePayout_zeroStake() public pure {
        uint256 payout = ParlayMath.computePayout(0, 4_000_000);
        assertEq(payout, 0);
    }

    function test_computePayout_1xMultiplier() public pure {
        uint256 payout = ParlayMath.computePayout(100e6, 1_000_000);
        assertEq(payout, 100e6);
    }

    // ── computeEdge ──────────────────────────────────────────────────────

    function test_computeEdge_twoLegs() public pure {
        // base=100, perLeg=50, 2 legs => 100 + 100 = 200 bps
        uint256 edge = ParlayMath.computeEdge(2, 100, 50);
        assertEq(edge, 200);
    }

    function test_computeEdge_fiveLegs() public pure {
        // base=100, perLeg=50, 5 legs => 100 + 250 = 350 bps
        uint256 edge = ParlayMath.computeEdge(5, 100, 50);
        assertEq(edge, 350);
    }

    function test_computeEdge_zeroLegs() public pure {
        uint256 edge = ParlayMath.computeEdge(0, 100, 50);
        assertEq(edge, 100);
    }
}
