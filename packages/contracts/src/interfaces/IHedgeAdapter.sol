// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IHedgeAdapter {
    function hedge(uint256 ticketId, uint256 legId, uint256 amount) external;
    function unwind(uint256 ticketId, uint256 legId) external;
}
