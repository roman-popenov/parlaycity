import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParlayBuilder } from "../ParlayBuilder";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

// Mock hooks
vi.mock("@/lib/hooks", () => ({
  useBuyTicket: vi.fn(() => ({
    buyTicket: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
}));

// Mock MultiplierClimb to avoid animation complexity
vi.mock("../MultiplierClimb", () => ({
  MultiplierClimb: ({ legMultipliers }: { legMultipliers: number[] }) => (
    <div data-testid="multiplier-climb">legs: {legMultipliers.length}</div>
  ),
}));

import { useAccount } from "wagmi";

describe("ParlayBuilder", () => {
  beforeEach(() => {
    vi.mocked(useAccount).mockReturnValue({
      isConnected: false,
      address: undefined,
    } as ReturnType<typeof useAccount>);
  });

  it("renders without crashing", () => {
    render(<ParlayBuilder />);
    expect(screen.getByText("Pick Your Legs")).toBeInTheDocument();
  });

  it("shows Connect Wallet when not connected", async () => {
    render(<ParlayBuilder />);
    // Need to wait for mounted state
    await vi.waitFor(() => {
      expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    });
  });

  it("renders leg cards from MOCK_LEGS", () => {
    render(<ParlayBuilder />);
    expect(screen.getByText("Will ETH hit $5000 by end of March?")).toBeInTheDocument();
    expect(screen.getByText("Will BTC hit $150k by end of March?")).toBeInTheDocument();
    expect(screen.getByText("Will SOL hit $300 by end of March?")).toBeInTheDocument();
  });

  it("renders Yes/No buttons for each leg", () => {
    render(<ParlayBuilder />);
    const yesButtons = screen.getAllByText("Yes");
    const noButtons = screen.getAllByText("No");
    expect(yesButtons.length).toBe(3);
    expect(noButtons.length).toBe(3);
  });

  it("shows stake input with USDC label", () => {
    render(<ParlayBuilder />);
    expect(screen.getByText("Stake (USDC)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min 1 USDC")).toBeInTheDocument();
  });

  it("updates leg count when selecting legs", () => {
    render(<ParlayBuilder />);
    const yesButtons = screen.getAllByText("Yes");
    // Select first leg
    fireEvent.click(yesButtons[0]);
    expect(screen.getByText("(1/5)")).toBeInTheDocument();
    // Select second leg
    fireEvent.click(yesButtons[1]);
    expect(screen.getByText("(2/5)")).toBeInTheDocument();
  });

  it("shows prompt to select minimum legs when fewer than min selected", async () => {
    vi.mocked(useAccount).mockReturnValue({
      isConnected: true,
      address: "0x1234",
    } as unknown as ReturnType<typeof useAccount>);

    render(<ParlayBuilder />);

    await vi.waitFor(() => {
      expect(screen.getByText("Select at least 2 legs")).toBeInTheDocument();
    });
  });
});
