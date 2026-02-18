import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParlayBuilder } from "../ParlayBuilder";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
}));

// Mock connectkit
vi.mock("connectkit", () => ({
  useModal: vi.fn(() => ({ setOpen: vi.fn() })),
}));

// Mock hooks
vi.mock("@/lib/hooks", () => ({
  useBuyTicket: vi.fn(() => ({
    buyTicket: vi.fn(),
    resetSuccess: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
  useUSDCBalance: vi.fn(() => ({
    balance: undefined,
    refetch: vi.fn(),
  })),
  useVaultStats: vi.fn(() => ({
    freeLiquidity: undefined,
    totalAssets: undefined,
    totalReserved: undefined,
    refetch: vi.fn(),
  })),
  useParlayConfig: vi.fn(() => ({
    baseFeeBps: undefined,
    perLegFeeBps: undefined,
    maxLegs: undefined,
    minStakeUSDC: undefined,
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

// Mock MultiplierClimb to avoid animation complexity
vi.mock("../MultiplierClimb", () => ({
  MultiplierClimb: ({ legMultipliers }: { legMultipliers: number[] }) => (
    <div data-testid="multiplier-climb">legs: {legMultipliers.length}</div>
  ),
}));

import { useAccount } from "wagmi";
import { useVaultStats } from "@/lib/hooks";

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

  describe("when vault is empty", () => {
    beforeEach(() => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0x1234",
      } as unknown as ReturnType<typeof useAccount>);
      vi.mocked(useVaultStats).mockReturnValue({
        freeLiquidity: 0n,
        totalAssets: 0n,
        totalReserved: 0n,
        maxPayout: 0n,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useVaultStats>);
    });

    it("shows 'No Vault Liquidity' on buy button", async () => {
      render(<ParlayBuilder />);
      await vi.waitFor(() => {
        expect(screen.getByText("No Vault Liquidity")).toBeInTheDocument();
      });
    });

    it("shows vault empty warning banner", async () => {
      render(<ParlayBuilder />);
      await vi.waitFor(() => {
        expect(screen.getByText(/No liquidity in the vault/)).toBeInTheDocument();
      });
    });

    it("disables Yes/No leg buttons", async () => {
      render(<ParlayBuilder />);
      await vi.waitFor(() => {
        const yesButtons = screen.getAllByText("Yes");
        yesButtons.forEach((btn) => {
          expect(btn.closest("button")).toBeDisabled();
        });
      });
    });

    it("does not allow leg selection", async () => {
      render(<ParlayBuilder />);
      // Wait for buttons to be disabled first
      await vi.waitFor(() => {
        const yesButtons = screen.getAllByText("Yes");
        expect(yesButtons[0].closest("button")).toBeDisabled();
      });
      // Then click outside waitFor to avoid retry side effects
      const yesButtons = screen.getAllByText("Yes");
      fireEvent.click(yesButtons[0]);
      expect(screen.getByText("(0/5)")).toBeInTheDocument();
    });
  });
});
