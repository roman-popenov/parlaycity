import { CONTRACT_ADDRESSES } from "./config";

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const HOUSE_VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalReserved",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxUtilizationBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "freeLiquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxPayout",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const PARLAY_ENGINE_ABI = [
  {
    name: "buyTicket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "legIds", type: "uint256[]" },
      { name: "outcomes", type: "bytes32[]" },
      { name: "stake", type: "uint256" },
    ],
    outputs: [{ name: "ticketId", type: "uint256" }],
  },
  {
    name: "settleTicket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimPayout",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getTicket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "stake", type: "uint256" },
          { name: "legIds", type: "uint256[]" },
          { name: "outcomes", type: "bytes32[]" },
          { name: "multiplierX1e6", type: "uint256" },
          { name: "potentialPayout", type: "uint256" },
          { name: "feePaid", type: "uint256" },
          { name: "mode", type: "uint8" },          // SettlementMode: 0=FAST, 1=OPTIMISTIC
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "payoutMode", type: "uint8" },      // PayoutMode: 0=CLASSIC, 1=PROGRESSIVE, 2=EARLY_CASHOUT
          { name: "claimedAmount", type: "uint256" },
          { name: "cashoutPenaltyBps", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "ticketCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "baseFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "perLegFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "minStake",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxLegs",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "buyTicketWithMode",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "legIds", type: "uint256[]" },
      { name: "outcomes", type: "bytes32[]" },
      { name: "stake", type: "uint256" },
      { name: "payoutMode", type: "uint8" },
    ],
    outputs: [{ name: "ticketId", type: "uint256" }],
  },
  {
    name: "claimProgressive",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ticketId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cashoutEarly",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ticketId", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "TicketPurchased",
    type: "event",
    inputs: [
      { name: "ticketId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "legIds", type: "uint256[]", indexed: false },
      { name: "outcomes", type: "bytes32[]", indexed: false },
      { name: "stake", type: "uint256", indexed: false },
      { name: "multiplierX1e6", type: "uint256", indexed: false },
      { name: "potentialPayout", type: "uint256", indexed: false },
      { name: "mode", type: "uint8", indexed: false },
      { name: "payoutMode", type: "uint8", indexed: false },
    ],
  },
] as const;

export const LEG_REGISTRY_ABI = [
  {
    name: "getLeg",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "legId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "question", type: "string" },
          { name: "sourceRef", type: "string" },
          { name: "cutoffTime", type: "uint256" },
          { name: "earliestResolve", type: "uint256" },
          { name: "oracleAdapter", type: "address" },
          { name: "probabilityPPM", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "legCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const LOCK_VAULT_ABI = [
  {
    name: "lock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
  },
  {
    name: "unlock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "earlyWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimFees",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "shares", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "lockedAt", type: "uint256" },
      { name: "unlockAt", type: "uint256" },
      { name: "feeMultiplierBps", type: "uint256" },
      { name: "rewardDebt", type: "uint256" },
    ],
  },
  {
    name: "nextPositionId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalLockedShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pendingRewards",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pendingReward",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const ORACLE_ADAPTER_ABI = [
  {
    name: "getStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "legId", type: "uint256" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "outcome", type: "bytes32" },
    ],
  },
  {
    name: "canResolve",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "legId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const contractAddresses = {
  usdc: CONTRACT_ADDRESSES.usdc as `0x${string}`,
  houseVault: CONTRACT_ADDRESSES.houseVault as `0x${string}`,
  parlayEngine: CONTRACT_ADDRESSES.parlayEngine as `0x${string}`,
  legRegistry: CONTRACT_ADDRESSES.legRegistry as `0x${string}`,
  lockVault: CONTRACT_ADDRESSES.lockVault as `0x${string}`,
};
