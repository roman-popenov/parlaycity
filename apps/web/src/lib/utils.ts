import type { TicketStatus } from "@/components/TicketCard";

export function mapStatus(statusCode: number): TicketStatus {
  switch (statusCode) {
    case 0: return "Active";
    case 1: return "Won";
    case 2: return "Lost";
    case 3: return "Voided";
    case 4: return "Claimed";
    default: return "Active";
  }
}

export function parseOutcomeChoice(outcome: `0x${string}`): number {
  try {
    const value = Number(BigInt(outcome));
    return value === 1 || value === 2 ? value : 0;
  } catch {
    return 0;
  }
}
