// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AdminOracleAdapter} from "../../src/oracle/AdminOracleAdapter.sol";
import {LegStatus} from "../../src/interfaces/IOracleAdapter.sol";

contract AdminOracleTest is Test {
    AdminOracleAdapter oracle;
    address owner = address(this);
    address alice = makeAddr("alice");

    function setUp() public {
        oracle = new AdminOracleAdapter();
    }

    function test_resolve_won() public {
        bytes32 outcome = keccak256("yes");
        oracle.resolve(1, LegStatus.Won, outcome);

        (LegStatus status, bytes32 returnedOutcome) = oracle.getStatus(1);
        assertEq(uint8(status), uint8(LegStatus.Won));
        assertEq(returnedOutcome, outcome);
        assertTrue(oracle.canResolve(1));
    }

    function test_resolve_lost() public {
        bytes32 outcome = keccak256("no");
        oracle.resolve(2, LegStatus.Lost, outcome);

        (LegStatus status,) = oracle.getStatus(2);
        assertEq(uint8(status), uint8(LegStatus.Lost));
    }

    function test_resolve_voided() public {
        oracle.resolve(3, LegStatus.Voided, bytes32(0));

        (LegStatus status,) = oracle.getStatus(3);
        assertEq(uint8(status), uint8(LegStatus.Voided));
    }

    function test_unresolved_byDefault() public view {
        (LegStatus status, bytes32 outcome) = oracle.getStatus(99);
        assertEq(uint8(status), uint8(LegStatus.Unresolved));
        assertEq(outcome, bytes32(0));
        assertFalse(oracle.canResolve(99));
    }

    function test_resolve_revertsOnUnresolved() public {
        vm.expectRevert("AdminOracle: cannot set Unresolved");
        oracle.resolve(1, LegStatus.Unresolved, bytes32(0));
    }

    function test_resolve_revertsIfAlreadyResolved() public {
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
        vm.expectRevert("AdminOracle: already resolved");
        oracle.resolve(1, LegStatus.Lost, keccak256("no"));
    }

    function test_resolve_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        oracle.resolve(1, LegStatus.Won, keccak256("yes"));
    }
}
