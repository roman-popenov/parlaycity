import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VaultDashboard } from "../VaultDashboard";

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({ isConnected: false, address: undefined })),
  useReadContract: vi.fn(() => ({ data: undefined })),
}));

// Mock hooks
vi.mock("@/lib/hooks", () => ({
  useVaultStats: vi.fn(() => ({
    totalAssets: 500_000_000_000n,
    totalReserved: 125_000_000_000n,
    utilization: 25,
  })),
  useDepositVault: vi.fn(() => ({
    deposit: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
  useWithdrawVault: vi.fn(() => ({
    withdraw: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
  useUSDCBalance: vi.fn(() => ({ balance: 1_000_000_000n })),
  useLockVault: vi.fn(() => ({
    lock: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
  useUnlockVault: vi.fn(() => ({
    unlock: vi.fn(),
    isPending: false,
  })),
  useEarlyWithdraw: vi.fn(() => ({
    earlyWithdraw: vi.fn(),
    isPending: false,
  })),
  useLockPositions: vi.fn(() => ({
    positions: [],
    refetch: vi.fn(),
  })),
  useLockStats: vi.fn(() => ({
    totalLocked: 0n,
    pendingRewards: 0n,
  })),
}));

// Mock contracts
vi.mock("@/lib/contracts", () => ({
  HOUSE_VAULT_ABI: [],
  contractAddresses: {
    houseVault: "0x1234",
    lockVault: "0x5678",
  },
}));

describe("VaultDashboard", () => {
  it("renders without crashing", () => {
    render(<VaultDashboard />);
    expect(screen.getByText("Total TVL")).toBeInTheDocument();
  });

  it("shows stat cards", () => {
    render(<VaultDashboard />);
    expect(screen.getByText("Total TVL")).toBeInTheDocument();
    expect(screen.getByText("Utilization")).toBeInTheDocument();
    expect(screen.getByText("Free Liquidity")).toBeInTheDocument();
    expect(screen.getByText("Your Position")).toBeInTheDocument();
  });

  it("shows TVL value from vault stats", () => {
    render(<VaultDashboard />);
    expect(screen.getByText("$500,000.00")).toBeInTheDocument();
  });

  it("shows utilization percentage", () => {
    render(<VaultDashboard />);
    // Utilization shown in stat card and utilization bar
    const utilTexts = screen.getAllByText("25.0%");
    expect(utilTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Deposit/Withdraw/Lock tab buttons", () => {
    render(<VaultDashboard />);
    // "Deposit" appears as tab, heading, and button -- check at least one exists
    expect(screen.getAllByText("Deposit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Withdraw")).toBeInTheDocument();
    expect(screen.getByText("Lock")).toBeInTheDocument();
  });

  it("shows deposit tab content by default", () => {
    render(<VaultDashboard />);
    expect(screen.getByPlaceholderText("Amount (USDC)")).toBeInTheDocument();
  });

  it("switches to withdraw tab", () => {
    render(<VaultDashboard />);
    fireEvent.click(screen.getByText("Withdraw"));
    expect(screen.getByText("You have no vault shares to withdraw.")).toBeInTheDocument();
  });

  it("switches to lock tab and shows tier selector", () => {
    render(<VaultDashboard />);
    fireEvent.click(screen.getByText("Lock"));
    expect(screen.getByText("Lock vUSDC Shares")).toBeInTheDocument();
    expect(screen.getByText("1.1x")).toBeInTheDocument();
    expect(screen.getByText("1.25x")).toBeInTheDocument();
    expect(screen.getByText("1.5x")).toBeInTheDocument();
  });

  it("deposit input accepts numeric value", () => {
    render(<VaultDashboard />);
    const input = screen.getByPlaceholderText("Amount (USDC)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100" } });
    expect(input.value).toBe("100");
  });
});
