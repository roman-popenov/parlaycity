export enum SettlementMode {
  FAST = "FAST",
  OPTIMISTIC = "OPTIMISTIC",
}

export enum PayoutMode {
  CLASSIC = "CLASSIC",
  PROGRESSIVE = "PROGRESSIVE",
  EARLY_CASHOUT = "EARLY_CASHOUT",
}

export enum TicketStatus {
  Active = "Active",
  Won = "Won",
  Lost = "Lost",
  Voided = "Voided",
  Claimed = "Claimed",
}

export enum LegStatus {
  Unresolved = "Unresolved",
  Won = "Won",
  Lost = "Lost",
  Voided = "Voided",
}

export interface Leg {
  id: number;
  question: string;
  sourceRef: string;
  cutoffTime: number;
  earliestResolve: number;
  probabilityPPM: number;
  active: boolean;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  legs: Leg[];
  category: string;
  imageUrl?: string;
}

export interface Ticket {
  id: number;
  owner: string;
  stake: bigint;
  legIds: number[];
  outcomes: string[];
  multiplierX1e6: bigint;
  potentialPayout: bigint;
  feePaid: bigint;
  mode: SettlementMode;
  payoutMode: PayoutMode;
  claimedAmount: bigint;
  status: TicketStatus;
  createdAt: number;
}

export interface QuoteRequest {
  legIds: number[];
  outcomes: string[];
  stake: string; // USDC amount as string (6 decimals)
}

export interface QuoteResponse {
  legIds: number[];
  outcomes: string[];
  stake: string;
  multiplierX1e6: string;
  potentialPayout: string;
  feePaid: string;
  edgeBps: number;
  probabilities: number[];
  valid: boolean;
  reason?: string;
}

export interface VaultStats {
  totalAssets: string;
  totalReserved: string;
  freeLiquidity: string;
  utilizationBps: number;
  totalShares: string;
}

export interface ExposureReport {
  totalExposure: string;
  ticketCount: number;
  byLeg: Record<number, string>;
  hedgeActions: HedgeAction[];
}

export interface HedgeAction {
  ticketId: number;
  legId: number;
  amount: string;
  action: "hedge" | "unwind";
  status: "simulated" | "executed";
  timestamp: number;
}

export type RiskProfile = "conservative" | "moderate" | "aggressive";

export interface RiskAssessRequest {
  legIds: number[];
  outcomes: string[];
  stake: string;
  probabilities: number[];
  bankroll: string;
  riskTolerance: RiskProfile;
  categories?: string[];
}

export interface RiskAssessResponse {
  action: "BUY" | "REDUCE_STAKE" | "AVOID";
  suggestedStake: string;
  kellyFraction: number;
  winProbability: number;
  expectedValue: number;
  confidence: number;
  reasoning: string;
  warnings: string[];
  riskTolerance: RiskProfile;
  fairMultiplier: number;
  edgeBps: number;
}
