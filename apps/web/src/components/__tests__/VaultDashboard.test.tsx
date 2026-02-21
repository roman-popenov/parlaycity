import { describe, it, expect, vi, beforeEach } from "vitest";
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
    freeLiquidity: 375_000_000_000n,
  })),
  useDepositVault: vi.fn(() => ({
    deposit: vi.fn(),
    resetSuccess: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  })),
  useWithdrawVault: vi.fn(() => ({
    withdraw: vi.fn(),
    resetSuccess: vi.fn(),
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
    userTotalLocked: 0n,
    refetch: vi.fn(),
  })),
  useLockStats: vi.fn(() => ({
    totalLocked: 0n,
    pendingRewards: 0n,
    refetch: vi.fn(),
  })),
  useMintTestUSDC: vi.fn(() => ({
    mint: vi.fn(),
    isPending: false,
    isConfirming: false,
    isSuccess: false,
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

import { useAccount, useReadContract } from "wagmi";
import {
  useUSDCBalance,
  useDepositVault,
  useWithdrawVault,
  useLockVault,
} from "@/lib/hooks";

function mockConnectedWithShares(shares = 100_000_000n) {
  vi.mocked(useAccount).mockReturnValue({
    isConnected: true,
    address: "0xAlice",
  } as unknown as ReturnType<typeof useAccount>);
  // balanceOf returns shares, convertToAssets returns same value (1:1)
  vi.mocked(useReadContract).mockImplementation((args: any) => {
    if (args?.functionName === "balanceOf") return { data: shares } as any;
    if (args?.functionName === "convertToAssets") return { data: shares } as any;
    return { data: undefined } as any;
  });
}

describe("VaultDashboard", () => {
  beforeEach(() => {
    vi.mocked(useAccount).mockReturnValue({
      isConnected: false,
      address: undefined,
    } as unknown as ReturnType<typeof useAccount>);
    vi.mocked(useReadContract).mockReturnValue({ data: undefined } as any);
  });

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
    const utilTexts = screen.getAllByText("25.0%");
    expect(utilTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Deposit/Withdraw/Lock tab buttons", () => {
    render(<VaultDashboard />);
    expect(screen.getAllByText("Deposit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Withdraw")).toBeInTheDocument();
    expect(screen.getByText("Lock")).toBeInTheDocument();
  });

  it("shows deposit tab content by default", () => {
    render(<VaultDashboard />);
    expect(screen.getByPlaceholderText("Min 1 USDC")).toBeInTheDocument();
  });

  it("switches to withdraw tab", () => {
    render(<VaultDashboard />);
    fireEvent.click(screen.getByText("Withdraw"));
    expect(screen.getByText("You have no vault shares to withdraw.")).toBeInTheDocument();
  });

  it("switches to lock tab and shows tier selector", () => {
    render(<VaultDashboard />);
    fireEvent.click(screen.getByText("Lock"));
    expect(screen.getByText(/Lock your vault shares/)).toBeInTheDocument();
    expect(screen.getByText("1.1x")).toBeInTheDocument();
    expect(screen.getByText("1.25x")).toBeInTheDocument();
    expect(screen.getByText("1.5x")).toBeInTheDocument();
  });

  it("deposit input accepts numeric value", () => {
    render(<VaultDashboard />);
    const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "100" } });
    expect(input.value).toBe("100");
  });

  // ── Deposit minimum enforcement ───────────────────────────────────────

  describe("deposit minimum guard", () => {
    beforeEach(() => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
    });

    it("shows 'Minimum deposit is 1 USDC' for 0.5 USDC", () => {
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.5" } });
      expect(screen.getByText("Minimum deposit is 1 USDC")).toBeInTheDocument();
    });

    it("shows 'Minimum 1 USDC' on button for sub-minimum deposit", () => {
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.99" } });
      expect(screen.getByText("Minimum 1 USDC")).toBeInTheDocument();
    });

    it("disables deposit button for sub-minimum amount", () => {
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.5" } });
      const btn = screen.getByText("Minimum 1 USDC").closest("button");
      expect(btn).toBeDisabled();
    });

    it("enables deposit button for exactly 1 USDC", () => {
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "1" } });
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Deposit");
      expect(btn).not.toBeDisabled();
    });

    it("shows 'Exceeds your USDC balance' for amount > balance", () => {
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 10_000_000n } as any); // 10 USDC
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "20" } });
      expect(screen.getByText("Exceeds your USDC balance")).toBeInTheDocument();
    });

    it("deposit input strips non-numeric characters", () => {
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "1e2" } });
      expect(input.value).toBe("12"); // sanitizeNumericInput strips 'e'
    });
  });

  // ── Withdraw minimum enforcement ──────────────────────────────────────

  describe("withdraw minimum guard", () => {
    beforeEach(() => {
      mockConnectedWithShares(100_000_000n); // 100 vUSDC
    });

    it("shows 'Amount Too Small' on button for dust withdraw", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.0000001" } });
        expect(screen.getByText("Amount Too Small")).toBeInTheDocument();
      });
    });

    it("disables withdraw button for dust amount", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.0000001" } });
        const btn = screen.getByText("Amount Too Small").closest("button");
        expect(btn).toBeDisabled();
      });
    });

    it("enables withdraw button for 1 vUSDC", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "1" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Withdraw");
        expect(btn).not.toBeDisabled();
      });
    });

    it("shows 'Insufficient Shares' for amount > shares", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "999" } });
        expect(screen.getByText("Insufficient Shares")).toBeInTheDocument();
      });
    });

    it("withdraw input strips non-numeric characters", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "+50" } });
        expect(input.value).toBe("50");
      });
    });
  });

  // ── Lock minimum enforcement ──────────────────────────────────────────

  describe("lock minimum guard", () => {
    beforeEach(() => {
      mockConnectedWithShares(100_000_000n); // 100 vUSDC
    });

    it("shows 'Minimum lock is 1 vUSDC' warning for 0.5 vUSDC", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.5" } });
        expect(screen.getByText("Minimum lock is 1 vUSDC")).toBeInTheDocument();
      });
    });

    it("shows 'Minimum 1 vUSDC' on button for sub-minimum lock", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.5" } });
        expect(screen.getByText("Minimum 1 vUSDC")).toBeInTheDocument();
      });
    });

    it("disables lock button for sub-minimum amount", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.1" } });
        const btn = screen.getByText("Minimum 1 vUSDC").closest("button");
        expect(btn).toBeDisabled();
      });
    });

    it("enables lock button for exactly 1 vUSDC", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "1" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Lock Shares");
        expect(btn).not.toBeDisabled();
      });
    });

    it("shows 'Exceeds your vault shares' for amount > shares", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "999" } });
        expect(screen.getByText("Exceeds your vault shares")).toBeInTheDocument();
      });
    });

    it("lock input strips non-numeric characters", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0x10" } });
        expect(input.value).toBe("010");
      });
    });

    it("lock button shows 'Minimum 1 vUSDC' for zero input", async () => {
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0" } });
        expect(screen.getByText("Minimum 1 vUSDC")).toBeInTheDocument();
      });
    });
  });

  // ── Button label priority: deposit ──────────────────────────────────

  describe("deposit button priority", () => {
    function mockDepositState(overrides: Partial<ReturnType<typeof useDepositVault>>) {
      vi.mocked(useDepositVault).mockReturnValue({
        deposit: vi.fn(),
        resetSuccess: vi.fn(),
        isPending: false,
        isConfirming: false,
        isSuccess: false,
        error: null,
        ...overrides,
      } as any);
    }

    beforeEach(() => {
      mockDepositState({});
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 1_000_000_000n } as any);
    });

    it("'Connect Wallet' takes priority over everything", () => {
      // Disconnected, even with pending tx state mocked
      mockDepositState({ isPending: true });
      render(<VaultDashboard />);
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Connect Wallet");
      expect(btn).toBeDefined();
    });

    it("'No USDC Balance' takes priority over validation errors", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 0n } as any);
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.5" } });
      // Should show "No USDC Balance" NOT "Minimum 1 USDC"
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "No USDC Balance");
      expect(btn).toBeDefined();
      expect(screen.queryByText("Minimum 1 USDC")).not.toBeInTheDocument();
    });

    it("'Signing...' takes priority over 'Minimum 1 USDC'", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      mockDepositState({ isPending: true });
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.5" } });
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Signing...");
      expect(btn).toBeDefined();
    });

    it("'Confirming...' takes priority over 'Insufficient Balance'", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 10_000_000n } as any);
      mockDepositState({ isConfirming: true });
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "20" } });
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Confirming...");
      expect(btn).toBeDefined();
    });

    it("'Deposited!' takes priority over validation", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      mockDepositState({ isSuccess: true });
      render(<VaultDashboard />);
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Deposited!");
      expect(btn).toBeDefined();
    });

    it("'Minimum 1 USDC' takes priority over 'Insufficient Balance'", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      // Balance < 1 USDC so both belowMin and exceedsBalance could trigger
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 500_000n } as any); // 0.5 USDC
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "0.7" } });
      // 0.7 USDC < 1 minimum, AND 0.7 > 0.5 balance -- minimum wins
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Minimum 1 USDC");
      expect(btn).toBeDefined();
    });

    it("shows 'Insufficient Balance' when above minimum but exceeds balance", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 5_000_000n } as any); // 5 USDC
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "10" } });
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Insufficient Balance");
      expect(btn).toBeDefined();
    });

    it("shows 'Deposit' when all conditions are valid", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "5" } });
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Deposit");
      expect(btn).toBeDefined();
      expect(btn).not.toBeDisabled();
    });
  });

  // ── Button label priority: withdraw ─────────────────────────────────

  describe("withdraw button priority", () => {
    function mockWithdrawState(overrides: Partial<ReturnType<typeof useWithdrawVault>>) {
      vi.mocked(useWithdrawVault).mockReturnValue({
        withdraw: vi.fn(),
        resetSuccess: vi.fn(),
        isPending: false,
        isConfirming: false,
        isSuccess: false,
        error: null,
        ...overrides,
      } as any);
    }

    beforeEach(() => {
      mockWithdrawState({});
    });

    it("'Connect Wallet' takes priority over everything", () => {
      mockWithdrawState({ isPending: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Connect Wallet");
      expect(btn).toBeDefined();
    });

    it("'No Shares' takes priority over validation and tx state", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      // No shares mocked (default: useReadContract returns undefined)
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "No Shares");
      expect(btn).toBeDefined();
    });

    it("'Signing...' takes priority over 'Insufficient Shares'", async () => {
      mockConnectedWithShares(100_000_000n);
      mockWithdrawState({ isPending: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "999" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Signing...");
        expect(btn).toBeDefined();
      });
    });

    it("'Withdrawn!' takes priority over validation", async () => {
      mockConnectedWithShares(100_000_000n);
      mockWithdrawState({ isSuccess: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Withdrawn!");
        expect(btn).toBeDefined();
      });
    });

    it("'Amount Too Small' takes priority over 'Insufficient Shares'", async () => {
      // With very small shares, dust amount could also exceed
      mockConnectedWithShares(100n); // 0.0001 vUSDC
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        // 0.0000001 is dust AND could exceed 0.0001 shares
        fireEvent.change(input, { target: { value: "0.0000001" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Amount Too Small");
        expect(btn).toBeDefined();
      });
    });

    it("shows 'Withdraw' when all conditions are valid", async () => {
      mockConnectedWithShares(100_000_000n);
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("Shares (vUSDC)") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "10" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Withdraw");
        expect(btn).toBeDefined();
        expect(btn).not.toBeDisabled();
      });
    });
  });

  // ── Button label priority: lock ─────────────────────────────────────

  describe("lock button priority", () => {
    function mockLockState(overrides: Partial<ReturnType<typeof useLockVault>>) {
      vi.mocked(useLockVault).mockReturnValue({
        lock: vi.fn(),
        isPending: false,
        isConfirming: false,
        isSuccess: false,
        error: null,
        ...overrides,
      } as any);
    }

    beforeEach(() => {
      mockLockState({});
    });

    it("'Connect Wallet' takes priority over everything", () => {
      mockLockState({ isPending: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Connect Wallet");
      expect(btn).toBeDefined();
    });

    it("'Deposit USDC First' takes priority over validation", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      // No shares (default)
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      const btn = screen.getAllByRole("button").find((b) => b.textContent === "Deposit USDC First");
      expect(btn).toBeDefined();
    });

    it("'Signing...' takes priority over 'Minimum 1 vUSDC'", async () => {
      mockConnectedWithShares(100_000_000n);
      mockLockState({ isPending: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.5" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Signing...");
        expect(btn).toBeDefined();
      });
    });

    it("'Confirming...' takes priority over 'Insufficient Shares'", async () => {
      mockConnectedWithShares(100_000_000n);
      mockLockState({ isConfirming: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "999" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Confirming...");
        expect(btn).toBeDefined();
      });
    });

    it("'Locked!' takes priority over validation", async () => {
      mockConnectedWithShares(100_000_000n);
      mockLockState({ isSuccess: true });
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Locked!");
        expect(btn).toBeDefined();
      });
    });

    it("'Minimum 1 vUSDC' takes priority over 'Insufficient Shares'", async () => {
      // Small shares: 0.5 vUSDC. Typing 0.5 is both below min AND equals shares.
      mockConnectedWithShares(500_000n); // 0.5 vUSDC
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "0.5" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Minimum 1 vUSDC");
        expect(btn).toBeDefined();
      });
    });

    it("shows 'Insufficient Shares' when above min but exceeds shares", async () => {
      mockConnectedWithShares(5_000_000n); // 5 vUSDC
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "10" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Insufficient Shares");
        expect(btn).toBeDefined();
      });
    });

    it("shows 'Lock Shares' when all conditions are valid", async () => {
      mockConnectedWithShares(100_000_000n);
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      await vi.waitFor(() => {
        const input = screen.getByPlaceholderText("vUSDC shares to lock") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "10" } });
        const btn = screen.getAllByRole("button").find((b) => b.textContent === "Lock Shares");
        expect(btn).toBeDefined();
        expect(btn).not.toBeDisabled();
      });
    });
  });

  describe("NaN guard: dot-only and non-numeric input disables buttons", () => {
    // Action buttons have w-full class; tab buttons do not
    const findActionButton = (text: string) =>
      screen.getAllByRole("button").find(
        (b) => b.textContent === text && b.className.includes("w-full"),
      );

    it("disables deposit action button when input is '.'", () => {
      vi.mocked(useAccount).mockReturnValue({
        isConnected: true,
        address: "0xAlice",
      } as unknown as ReturnType<typeof useAccount>);
      vi.mocked(useUSDCBalance).mockReturnValue({ balance: 1_000_000_000n } as any);
      render(<VaultDashboard />);
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "." } });
      const btn = findActionButton("Deposit");
      expect(btn).toBeDefined();
      expect(btn).toBeDisabled();
    });

    it("disables withdraw action button when input is '.'", async () => {
      mockConnectedWithShares(100_000_000n);
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Withdraw"));
      const input = await screen.findByPlaceholderText("Shares (vUSDC)");
      fireEvent.change(input, { target: { value: "." } });
      const btn = findActionButton("Withdraw");
      expect(btn).toBeDefined();
      expect(btn).toBeDisabled();
    });

    it("disables lock action button when input is '.'", async () => {
      mockConnectedWithShares(100_000_000n);
      render(<VaultDashboard />);
      fireEvent.click(screen.getByText("Lock"));
      const input = await screen.findByPlaceholderText("vUSDC shares to lock");
      fireEvent.change(input, { target: { value: "." } });
      const btn = findActionButton("Lock Shares");
      expect(btn).toBeDefined();
      expect(btn).toBeDisabled();
    });
  });
});
