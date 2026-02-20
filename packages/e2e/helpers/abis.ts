import { parseAbi } from "viem";

export const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
  "function decimals() view returns (uint8)",
]);

export const VAULT_ABI = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function totalReserved() view returns (uint256)",
  "function freeLiquidity() view returns (uint256)",
  "function maxPayout() view returns (uint256)",
  "function engine() view returns (address)",
  "function lockVault() view returns (address)",
  "function safetyModule() view returns (address)",
  "function maxUtilizationBps() view returns (uint256)",
  "function maxPayoutBps() view returns (uint256)",
  "function paused() view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function deposit(uint256,address) returns (uint256)",
  "function withdraw(uint256,address) returns (uint256)",
  "function convertToShares(uint256) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

export const ENGINE_ABI = parseAbi([
  "function ticketCount() view returns (uint256)",
  "function getTicket(uint256) view returns ((address buyer, uint256 stake, uint256[] legIds, bytes32[] outcomes, uint256 multiplierX1e6, uint256 potentialPayout, uint256 feePaid, uint8 mode, uint8 status, uint256 createdAt, uint8 payoutMode, uint256 claimedAmount, uint256 cashoutPenaltyBps))",
  "function baseFee() view returns (uint256)",
  "function perLegFee() view returns (uint256)",
  "function minStake() view returns (uint256)",
  "function maxLegs() view returns (uint256)",
  "function bootstrapEndsAt() view returns (uint256)",
  "function vault() view returns (address)",
  "function registry() view returns (address)",
  "function usdc() view returns (address)",
  "function buyTicket(uint256[],bytes32[],uint256)",
  "function settleTicket(uint256)",
  "function claimPayout(uint256)",
]);

export const REGISTRY_ABI = parseAbi([
  "function legCount() view returns (uint256)",
  "function getLeg(uint256) view returns ((string question, string sourceRef, uint256 cutoffTime, uint256 earliestResolve, address oracleAdapter, uint256 probabilityPPM, bool active))",
  "function createLeg(string,string,uint256,uint256,address,uint256)",
]);

export const ORACLE_ABI = parseAbi([
  "function resolve(uint256,uint8,bytes32)",
  "function getStatus(uint256) view returns (uint8,bytes32)",
  "function canResolve(uint256) view returns (bool)",
]);

export const LOCK_VAULT_ABI = parseAbi([
  "function nextPositionId() view returns (uint256)",
  "function totalLockedShares() view returns (uint256)",
  "function feeDistributor() view returns (address)",
  "function basePenaltyBps() view returns (uint256)",
]);
