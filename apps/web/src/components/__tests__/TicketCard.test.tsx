import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketCard, type TicketData, type TicketStatus } from "../TicketCard";
import { useCashoutEarly } from "@/lib/hooks";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: true, address: "0x1234" })),
}));

vi.mock("@/lib/hooks", () => ({
  useSettleTicket: vi.fn(() => ({ settle: vi.fn(), isPending: false })),
  useClaimPayout: vi.fn(() => ({ claim: vi.fn(), isPending: false })),
  useClaimProgressive: vi.fn(() => ({ claimProgressive: vi.fn(), hash: undefined, isPending: false })),
  useCashoutEarly: vi.fn(() => ({ cashoutEarly: vi.fn(), hash: undefined, isPending: false })),
}));

function makeTicket(overrides: Partial<TicketData> = {}): TicketData {
  return {
    id: 1n,
    stake: 10_000_000n,
    feePaid: 300_000n,
    payout: 39_200_000n,
    legs: [
      { description: "Will ETH hit $5000?", odds: 2.86, outcomeChoice: 1, resolved: false, result: 0 },
      { description: "Will BTC hit $150k?", odds: 4.0, outcomeChoice: 1, resolved: false, result: 0 },
    ],
    status: "Active",
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("TicketCard", () => {
  it("renders without crashing", () => {
    render(<TicketCard ticket={makeTicket()} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("displays correct stake and payout", () => {
    render(<TicketCard ticket={makeTicket()} />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$39.20")).toBeInTheDocument();
  });

  it("displays leg descriptions", () => {
    render(<TicketCard ticket={makeTicket()} />);
    expect(screen.getByText("Will ETH hit $5000?")).toBeInTheDocument();
    expect(screen.getByText("Will BTC hit $150k?")).toBeInTheDocument();
  });

  it("shows combined multiplier", () => {
    render(<TicketCard ticket={makeTicket()} />);
    expect(screen.getByText("11.44x")).toBeInTheDocument();
  });

  const statusCases: TicketStatus[] = ["Active", "Won", "Lost", "Voided", "Claimed"];
  statusCases.forEach((status) => {
    it("renders status badge for " + status, () => {
      render(<TicketCard ticket={makeTicket({ status })} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    });
  });

  it("shows Settle button when Active and all legs resolved", () => {
    const ticket = makeTicket({
      status: "Active",
      legs: [
        { description: "Leg A", odds: 2.0, outcomeChoice: 1, resolved: true, result: 1 },
        { description: "Leg B", odds: 3.0, outcomeChoice: 1, resolved: true, result: 1 },
      ],
    });
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText("Settle")).toBeInTheDocument();
  });

  it("shows Claim Payout button when Won", () => {
    render(<TicketCard ticket={makeTicket({ status: "Won" })} />);
    expect(screen.getByText("Claim Payout")).toBeInTheDocument();
  });

  it("does not show action buttons for Lost tickets", () => {
    render(<TicketCard ticket={makeTicket({ status: "Lost" })} />);
    expect(screen.queryByText("Settle")).not.toBeInTheDocument();
    expect(screen.queryByText("Claim Payout")).not.toBeInTheDocument();
  });

  it("shows cashout value on button when cashoutValue is provided", () => {
    const ticket = makeTicket({
      status: "Active",
      payoutMode: 2,
      cashoutValue: 15_500_000n,
      legs: [
        { description: "Leg A", odds: 2.0, outcomeChoice: 1, resolved: true, result: 1 },
        { description: "Leg B", odds: 3.0, outcomeChoice: 1, resolved: false, result: 0 },
      ],
    });
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByText("Cash Out ~$15.50")).toBeInTheDocument();
  });

  it("passes slippage-protected minOut to cashoutEarly", () => {
    const mockCashout = vi.fn();
    (useCashoutEarly as ReturnType<typeof vi.fn>).mockReturnValue({
      cashoutEarly: mockCashout, hash: undefined, isPending: false,
    });
    const ticket = makeTicket({
      status: "Active",
      payoutMode: 2,
      cashoutValue: 10_000_000n,
      legs: [
        { description: "Leg A", odds: 2.0, outcomeChoice: 1, resolved: true, result: 1 },
        { description: "Leg B", odds: 3.0, outcomeChoice: 1, resolved: false, result: 0 },
      ],
    });
    render(<TicketCard ticket={ticket} />);
    fireEvent.click(screen.getByText("Cash Out ~$10.00"));
    expect(mockCashout).toHaveBeenCalledWith(1n, 9_800_000n);
  });

  it("handles voided legs correctly in status display", () => {
    const ticket = makeTicket({
      status: "Active",
      legs: [
        { description: "Voided leg", odds: 2.0, outcomeChoice: 1, resolved: true, result: 3 },
        { description: "Pending leg", odds: 3.0, outcomeChoice: 1, resolved: false, result: 0 },
      ],
    });
    render(<TicketCard ticket={ticket} />);
    expect(screen.getByTitle("Voided")).toBeInTheDocument();
    expect(screen.getByTitle("Pending")).toBeInTheDocument();
  });
});
