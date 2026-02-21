import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ParlayBuilder } from "../ParlayBuilder";

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock wagmi
const mockUseAccount = vi.fn(() => ({
  isConnected: false as boolean,
  address: undefined as string | undefined,
}));
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

// Mock connectkit
const mockSetOpen = vi.fn();
vi.mock("connectkit", () => ({
  useModal: vi.fn(() => ({ setOpen: mockSetOpen })),
}));

// Mock hooks
const mockBuyTicket = vi.fn(() => Promise.resolve(true));
const mockResetSuccess = vi.fn();
const mockUseBuyTicket = vi.fn(() => ({
  buyTicket: mockBuyTicket,
  resetSuccess: mockResetSuccess,
  isPending: false,
  isConfirming: false,
  isSuccess: false,
  error: null as Error | null,
}));
const mockUseUSDCBalance = vi.fn(() => ({
  balance: undefined as bigint | undefined,
  refetch: vi.fn(),
}));
const mockUseVaultStats = vi.fn(() => ({
  freeLiquidity: undefined as bigint | undefined,
  totalAssets: undefined as bigint | undefined,
  totalReserved: undefined as bigint | undefined,
  maxPayout: undefined as bigint | undefined,
  refetch: vi.fn(),
}));
const mockUseParlayConfig = vi.fn(() => ({
  baseFeeBps: undefined as number | undefined,
  perLegFeeBps: undefined as number | undefined,
  maxLegs: undefined as number | undefined,
  minStakeUSDC: undefined as number | undefined,
  isLoading: false,
  refetch: vi.fn(),
}));

vi.mock("@/lib/hooks", () => ({
  useBuyTicket: () => mockUseBuyTicket(),
  useUSDCBalance: () => mockUseUSDCBalance(),
  useVaultStats: () => mockUseVaultStats(),
  useParlayConfig: () => mockUseParlayConfig(),
  useMintTestUSDC: () => ({ mint: vi.fn(), isPending: false, isConfirming: false, isSuccess: false }),
}));

// Mock MultiplierClimb
vi.mock("../MultiplierClimb", () => ({
  MultiplierClimb: ({ legMultipliers }: { legMultipliers: number[] }) => (
    <div data-testid="multiplier-climb">legs: {legMultipliers.length}</div>
  ),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/** Configure mocks for a connected user with vault liquidity and USDC balance. */
function setupConnectedUser(overrides: {
  balance?: bigint;
  freeLiquidity?: bigint;
  maxPayout?: bigint;
} = {}) {
  mockUseAccount.mockReturnValue({
    isConnected: true as boolean,
    address: "0x1234" as string | undefined,
  });
  mockUseUSDCBalance.mockReturnValue({
    balance: overrides.balance ?? 100_000_000n, // 100 USDC
    refetch: vi.fn(),
  });
  mockUseVaultStats.mockReturnValue({
    freeLiquidity: overrides.freeLiquidity ?? 500_000_000_000n, // 500k USDC
    totalAssets: 500_000_000_000n,
    totalReserved: 0n,
    maxPayout: overrides.maxPayout ?? 25_000_000_000n, // 25k USDC
    refetch: vi.fn(),
  });
}

/** Select N legs by clicking their Yes buttons. Returns the Yes buttons. */
function selectLegs(count: number): HTMLElement[] {
  const yesButtons = screen.getAllByText("Yes");
  for (let i = 0; i < count && i < yesButtons.length; i++) {
    fireEvent.click(yesButtons[i]);
  }
  return yesButtons;
}

/** Type a value into the stake input. */
function setStakeInput(value: string) {
  const input = screen.getByPlaceholderText("Min 1 USDC");
  fireEvent.change(input, { target: { value } });
}

// ── Session storage mock ──────────────────────────────────────────────────

let sessionStore: Record<string, string>;

beforeEach(() => {
  // Default fetch mock: reject immediately so ParlayBuilder falls back to MOCK_LEGS
  // without waiting for a network timeout. Tests that need specific fetch behavior
  // override this with their own vi.stubGlobal("fetch", ...).
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network in test"))));

  sessionStore = {};
  vi.stubGlobal("sessionStorage", {
    getItem: vi.fn((key: string) => sessionStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { sessionStore[key] = value; }),
    removeItem: vi.fn((key: string) => { delete sessionStore[key]; }),
    clear: vi.fn(() => { sessionStore = {}; }),
    length: 0,
    key: vi.fn(() => null),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  mockUseAccount.mockReturnValue({ isConnected: false as boolean, address: undefined as string | undefined });
  mockUseUSDCBalance.mockReturnValue({ balance: undefined as bigint | undefined, refetch: vi.fn() });
  mockUseVaultStats.mockReturnValue({
    freeLiquidity: undefined as bigint | undefined,
    totalAssets: undefined as bigint | undefined,
    totalReserved: undefined as bigint | undefined,
    maxPayout: undefined as bigint | undefined,
    refetch: vi.fn(),
  });
  mockUseParlayConfig.mockReturnValue({
    baseFeeBps: undefined as number | undefined,
    perLegFeeBps: undefined as number | undefined,
    maxLegs: undefined as number | undefined,
    minStakeUSDC: undefined as number | undefined,
    isLoading: false,
    refetch: vi.fn(),
  });
  mockUseBuyTicket.mockReturnValue({
    buyTicket: mockBuyTicket,
    resetSuccess: mockResetSuccess,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null as Error | null,
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ParlayBuilder", () => {
  // --- Core rendering ---

  it("renders without crashing", () => {
    render(<ParlayBuilder />);
    expect(screen.getByText("Pick Your Legs")).toBeInTheDocument();
  });

  it("shows Connect Wallet when not connected", async () => {
    render(<ParlayBuilder />);
    await waitFor(() => {
      expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    });
  });

  it("renders all mock legs", () => {
    render(<ParlayBuilder />);
    expect(screen.getByText("Will ETH hit $5000 by end of March?")).toBeInTheDocument();
    expect(screen.getByText("Will BTC hit $150k by end of March?")).toBeInTheDocument();
    expect(screen.getByText("Will SOL hit $300 by end of March?")).toBeInTheDocument();
  });

  it("renders Yes/No buttons for each leg", () => {
    render(<ParlayBuilder />);
    expect(screen.getAllByText("Yes").length).toBe(3);
    expect(screen.getAllByText("No").length).toBe(3);
  });

  it("updates leg count when selecting legs", () => {
    const { container } = render(<ParlayBuilder />);
    selectLegs(2);
    // Leg counter is now numbered squares (rounded-md + gradient-bg when filled)
    const filledDots = container.querySelectorAll(".rounded-md.gradient-bg");
    expect(filledDots.length).toBe(2);
  });

  // --- Vault empty state ---

  describe("when vault is empty", () => {
    beforeEach(() => {
      setupConnectedUser({ freeLiquidity: 0n });
    });

    it("shows 'No Vault Liquidity' on buy button", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("No Vault Liquidity")).toBeInTheDocument();
      });
    });

    it("shows vault empty warning banner", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText(/No liquidity in the vault/)).toBeInTheDocument();
      });
    });

    it("disables leg buttons", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        const yesButtons = screen.getAllByText("Yes");
        yesButtons.forEach((btn) => {
          expect(btn.closest("button")).toBeDisabled();
        });
      });
    });
  });

  // --- BigInt zero balance handling ---

  describe("BigInt zero balance", () => {
    it("shows balance of 0.00 when usdcBalance is 0n", async () => {
      setupConnectedUser({ balance: 0n });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Balance: 0.00")).toBeInTheDocument();
      });
    });

    it("does not show MAX button when balance is 0n", async () => {
      setupConnectedUser({ balance: 0n });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Balance: 0.00")).toBeInTheDocument();
      });
      expect(screen.queryByText("MAX")).not.toBeInTheDocument();
    });

    it("shows MAX button when balance > 0n", async () => {
      setupConnectedUser({ balance: 1_000_000n }); // 1 USDC
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("MAX")).toBeInTheDocument();
      });
    });

    it("MAX button sets stake via formatUnits (not Number division)", async () => {
      // 123.456789 USDC = 123_456_789n (6 decimals)
      setupConnectedUser({ balance: 123_456_789n });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("MAX")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("MAX"));
      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      // formatUnits(123_456_789n, 6) = "123.456789"
      expect(input.value).toBe("123.456789");
    });

    it("displays balance via formatUnits", async () => {
      // 50.123456 USDC
      setupConnectedUser({ balance: 50_123_456n });
      render(<ParlayBuilder />);
      await waitFor(() => {
        // parseFloat(formatUnits(50_123_456n, 6)).toFixed(2) = "50.12"
        expect(screen.getByText("Balance: 50.12")).toBeInTheDocument();
      });
    });

    it("shows 'Insufficient USDC Balance' when stake exceeds zero balance", async () => {
      setupConnectedUser({ balance: 0n });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Balance: 0.00")).toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");
      await waitFor(() => {
        expect(screen.getByText("Insufficient USDC Balance")).toBeInTheDocument();
      });
    });
  });

  // --- NaN protection on partial input ---

  describe("NaN protection", () => {
    it("disables buy when stake is '.' (parseFloat returns NaN)", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput(".");
      // stakeNum = parseFloat(".") || 0 = 0, which is < minStakeUSDC=1
      // so button should show "Select at least 2 legs" or min stake message
      // Actually with 2 legs selected it should show the min stake issue
      await waitFor(() => {
        const buyBtn = screen.getByText("Buy Ticket");
        expect(buyBtn.closest("button")).toBeDisabled();
      });
    });

    it("disables buy when stake is empty", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      // Empty stake = stakeNum 0, below minStake
      const buyBtn = screen.getByText(/Buy Ticket|Select at least/);
      expect(buyBtn.closest("button")).toBeDisabled();
    });
  });

  // --- Session storage persistence ---

  describe("session storage persistence", () => {
    it("persists stake to sessionStorage on change", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Min 1 USDC")).toBeInTheDocument();
      });
      setStakeInput("42");
      // useSessionState writes on value change after hydration
      await waitFor(() => {
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
          "parlay:stake",
          '"42"'
        );
      });
    });

    it("persists payoutMode to sessionStorage on change", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Progressive")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Progressive"));
      await waitFor(() => {
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
          "parlay:payoutMode",
          "1"
        );
      });
    });

    it("persists selectedLegs to sessionStorage on selection", async () => {
      render(<ParlayBuilder />);
      // Wait for mount effect so mounted=true before selecting
      await waitFor(() => {
        expect(sessionStorage.setItem).toHaveBeenCalled();
      });
      selectLegs(2);
      await waitFor(() => {
        // Find the LAST call with the legs key (first calls may be initial empty array)
        const calls = (sessionStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: unknown[]) => c[0] === "parlay:selectedLegs"
        );
        const lastCall = calls[calls.length - 1];
        expect(lastCall).toBeDefined();
        const parsed = JSON.parse(lastCall[1] as string);
        expect(parsed.length).toBeGreaterThanOrEqual(2);
        expect(parsed[0]).toHaveProperty("legId");
        expect(parsed[0]).toHaveProperty("outcomeChoice");
      });
    });

    it("restores stake from sessionStorage on mount", async () => {
      sessionStore["parlay:stake"] = '"25"';
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
        expect(input.value).toBe("25");
      });
    });

    it("restores selectedLegs from sessionStorage on mount", async () => {
      // Store serialized legs (legId 0 and 1 with Yes choices)
      sessionStore["parlay:selectedLegs"] = JSON.stringify([
        { legId: "0", outcomeChoice: 1 },
        { legId: "1", outcomeChoice: 1 },
      ]);
      const { container } = render(<ParlayBuilder />);
      await waitFor(() => {
        // Leg counter squares (rounded-md + gradient-bg) = filled slots
        const filledDots = container.querySelectorAll(".rounded-md.gradient-bg");
        expect(filledDots.length).toBe(2);
      });
    });

    it("clears sessionStorage on successful buy", async () => {
      setupConnectedUser();
      mockBuyTicket.mockResolvedValueOnce(true);
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await waitFor(() => {
        const buyBtn = screen.getByText("Buy Ticket");
        expect(buyBtn.closest("button")).not.toBeDisabled();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Buy Ticket"));
      });

      // After buy, state resets to defaults. Persist effects write defaults
      // to sessionStorage (no explicit clearSessionState needed).
      await waitFor(() => {
        expect(sessionStore["parlay:stake"]).toBe('""');
        expect(sessionStore["parlay:payoutMode"]).toBe("0");
      });
    });

    it("ignores invalid sessionStorage data gracefully", async () => {
      sessionStore["parlay:selectedLegs"] = "not-json{{{";
      // Should not crash
      render(<ParlayBuilder />);
      expect(screen.getByText("Pick Your Legs")).toBeInTheDocument();
    });
  });

  // --- Risk advisor fetch behavior ---

  describe("risk advisor", () => {
    beforeEach(() => {
      setupConnectedUser();
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      // Re-stub sessionStorage since unstubAllGlobals removes it
      vi.stubGlobal("sessionStorage", {
        getItem: vi.fn((key: string) => sessionStore[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { sessionStore[key] = value; }),
        removeItem: vi.fn((key: string) => { delete sessionStore[key]; }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      });
    });

    it("shows risk button when 2+ legs selected and stake > 0", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");
      expect(screen.getByText("AI Risk Analysis (x402)")).toBeInTheDocument();
    });

    it("does not show risk button when fewer than 2 legs selected", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(1);
      setStakeInput("10");
      expect(screen.queryByText("AI Risk Analysis (x402)")).not.toBeInTheDocument();
    });

    it("does not show risk button when stake is 0", async () => {
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      // No stake entered
      expect(screen.queryByText("AI Risk Analysis (x402)")).not.toBeInTheDocument();
    });

    it("shows error UI when fetch fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Failed to connect to risk advisor")).toBeInTheDocument();
      });
    });

    it("shows error UI when response is not ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Risk analysis unavailable (500)")).toBeInTheDocument();
      });
    });

    it("shows error UI when response has invalid shape", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: "data" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid response from risk advisor")).toBeInTheDocument();
      });
    });

    it("rejects response missing suggestedStake or winProbability", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          action: "BUY",
          kellyFraction: 0.05,
          reasoning: "Favorable",
          warnings: [],
          // missing suggestedStake and winProbability
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid response from risk advisor")).toBeInTheDocument();
      });
    });

    it("displays valid risk advice", async () => {
      const riskData = {
        action: "BUY",
        suggestedStake: "10",
        kellyFraction: 0.05,
        winProbability: 0.12,
        reasoning: "Favorable odds",
        warnings: ["High variance"],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(riskData),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("BUY")).toBeInTheDocument();
        expect(screen.getByText("Favorable odds")).toBeInTheDocument();
        expect(screen.getByText("! High variance")).toBeInTheDocument();
        expect(screen.getByText("Kelly: 5.0%")).toBeInTheDocument();
      });
    });

    it("sends Number(legId) not string legIds in request body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          action: "BUY",
          suggestedStake: "10",
          kellyFraction: 0.05,
          winProbability: 0.12,
          reasoning: "ok",
          warnings: [],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        // Find the risk-assess call (not the markets fetch)
        const riskCall = mockFetch.mock.calls.find(
          (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("risk-assess")
        );
        expect(riskCall).toBeDefined();

        const body = JSON.parse(riskCall![1].body);
        // legIds must be numbers (Number(BigInt)), not strings
        expect(body.legIds).toEqual([0, 1]);
        expect(typeof body.legIds[0]).toBe("number");
      });
    });

    it("rejects suggestedStake with scientific notation via type guard", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          action: "BUY",
          suggestedStake: "1e18", // scientific notation -- regex rejects
          kellyFraction: 0.05,
          winProbability: 0.12,
          reasoning: "ok",
          warnings: [],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid response from risk advisor")).toBeInTheDocument();
      });
    });

    it("rejects suggestedStake with negative value via type guard", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          action: "BUY",
          suggestedStake: "-100",
          kellyFraction: 0.05,
          winProbability: 0.12,
          reasoning: "ok",
          warnings: [],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid response from risk advisor")).toBeInTheDocument();
      });
    });

    it("applies sanitizeNumericInput to suggestedStake on click", async () => {
      const riskData = {
        action: "REDUCE_STAKE",
        suggestedStake: "5",
        kellyFraction: 0.02,
        winProbability: 0.08,
        reasoning: "Reduce stake",
        warnings: [],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(riskData),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("Use suggested: $5")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Use suggested: $5"));

      const input = screen.getByPlaceholderText("Min 1 USDC") as HTMLInputElement;
      expect(input.value).toBe("5");
    });

    it("clears stale risk advice when inputs change", async () => {
      const riskData = {
        action: "BUY",
        suggestedStake: "10",
        kellyFraction: 0.05,
        winProbability: 0.12,
        reasoning: "Favorable odds",
        warnings: [],
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(riskData),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("10");

      await act(async () => {
        fireEvent.click(screen.getByText("AI Risk Analysis (x402)"));
      });

      await waitFor(() => {
        expect(screen.getByText("BUY")).toBeInTheDocument();
      });

      // Change stake -- risk advice should clear
      setStakeInput("20");
      await waitFor(() => {
        expect(screen.queryByText("BUY")).not.toBeInTheDocument();
      });
    });
  });

  // --- Payout mode ---

  describe("payout mode", () => {
    it("renders all three payout mode options", () => {
      render(<ParlayBuilder />);
      expect(screen.getByText("Classic")).toBeInTheDocument();
      expect(screen.getByText("Progressive")).toBeInTheDocument();
      expect(screen.getByText("Cashout")).toBeInTheDocument();
    });

    it("defaults to Classic mode (value 0)", () => {
      render(<ParlayBuilder />);
      // Classic should have the active styling (ring class)
      const classicBtn = screen.getByText("Classic").closest("button")!;
      expect(classicBtn.className).toContain("brand-purple");
    });
  });

  // --- Transaction state ---

  describe("transaction feedback", () => {
    it("shows pending state", async () => {
      setupConnectedUser();
      mockUseBuyTicket.mockReturnValue({
        buyTicket: mockBuyTicket,
        resetSuccess: mockResetSuccess,
        isPending: true,
        isConfirming: false,
        isSuccess: false,
        error: null,
      });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Waiting for approval...")).toBeInTheDocument();
        expect(screen.getByText("Transaction submitted...")).toBeInTheDocument();
      });
    });

    it("shows confirming state", async () => {
      setupConnectedUser();
      mockUseBuyTicket.mockReturnValue({
        buyTicket: mockBuyTicket,
        resetSuccess: mockResetSuccess,
        isPending: false,
        isConfirming: true,
        isSuccess: false,
        error: null,
      });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Confirming...")).toBeInTheDocument();
        expect(screen.getByText("Waiting for confirmation...")).toBeInTheDocument();
      });
    });

    it("shows success state", async () => {
      setupConnectedUser();
      mockUseBuyTicket.mockReturnValue({
        buyTicket: mockBuyTicket,
        resetSuccess: mockResetSuccess,
        isPending: false,
        isConfirming: false,
        isSuccess: true,
        error: null,
      });
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.getByText("Ticket Bought!")).toBeInTheDocument();
        expect(screen.getByText("Your parlay ticket is live!")).toBeInTheDocument();
      });
    });

    it("shows error message (truncated if > 100 chars)", async () => {
      setupConnectedUser();
      const longMsg = "a".repeat(150);
      mockUseBuyTicket.mockReturnValue({
        buyTicket: mockBuyTicket,
        resetSuccess: mockResetSuccess,
        isPending: false,
        isConfirming: false,
        isSuccess: false,
        error: new Error(longMsg) as Error | null,
      });
      render(<ParlayBuilder />);
      await waitFor(() => {
        const errorEl = screen.getByText(/\.\.\.$/);
        expect(errorEl.textContent).toHaveLength(103); // 100 chars + "..."
      });
    });

    it("buy button is disabled during pending", async () => {
      setupConnectedUser();
      mockUseBuyTicket.mockReturnValue({
        buyTicket: mockBuyTicket,
        resetSuccess: mockResetSuccess,
        isPending: true,
        isConfirming: false,
        isSuccess: false,
        error: null,
      });
      render(<ParlayBuilder />);
      await waitFor(() => {
        const btn = screen.getByText("Waiting for approval...");
        expect(btn.closest("button")).toBeDisabled();
      });
    });
  });

  // --- SSR hydration / flicker prevention ---

  describe("SSR hydration", () => {
    it("renders with opacity-0 before mount then becomes visible", async () => {
      const { container } = render(<ParlayBuilder />);
      // Before useEffect runs, mounted=false, so opacity-0 + pointer-events-none
      const outerDiv = container.firstElementChild as HTMLElement;
      // After mount effect fires, opacity-0 should be removed
      await waitFor(() => {
        expect(outerDiv.className).not.toContain("opacity-0");
      });
    });

    it("does not use transition-opacity (flicker prevention)", () => {
      const { container } = render(<ParlayBuilder />);
      const outerDiv = container.firstElementChild as HTMLElement;
      expect(outerDiv.className).not.toContain("transition-opacity");
      expect(outerDiv.className).not.toContain("duration-");
    });
  });

  // --- Leg toggle behavior ---

  describe("leg toggle", () => {
    it("toggles a leg off when clicking the same outcome again", () => {
      const { container } = render(<ParlayBuilder />);
      const yesButtons = screen.getAllByText("Yes");
      fireEvent.click(yesButtons[0]);
      expect(container.querySelectorAll(".rounded-md.gradient-bg").length).toBe(1);
      // Click same leg/outcome again -> deselect
      fireEvent.click(yesButtons[0]);
      expect(container.querySelectorAll(".rounded-md.gradient-bg").length).toBe(0);
    });

    it("switches outcome when clicking No on a Yes-selected leg", () => {
      const { container } = render(<ParlayBuilder />);
      const yesButtons = screen.getAllByText("Yes");
      const noButtons = screen.getAllByText("No");
      fireEvent.click(yesButtons[0]); // Select first leg Yes
      expect(screen.getByText("YES")).toBeInTheDocument();
      fireEvent.click(noButtons[0]); // Switch to No
      expect(screen.getByText("NO")).toBeInTheDocument();
      expect(container.querySelectorAll(".rounded-md.gradient-bg").length).toBe(1); // Still 1 leg
    });

    it("enforces max legs limit", () => {
      mockUseParlayConfig.mockReturnValue({
        baseFeeBps: undefined,
        perLegFeeBps: undefined,
        maxLegs: 2,
        minStakeUSDC: undefined,
        isLoading: false,
        refetch: vi.fn(),
      });
      const { container } = render(<ParlayBuilder />);
      const yesButtons = screen.getAllByText("Yes");
      fireEvent.click(yesButtons[0]);
      fireEvent.click(yesButtons[1]);
      fireEvent.click(yesButtons[2]); // Should be ignored (max 2)
      // With maxLegs=2, there are 2 numbered squares, both filled
      const filledDots = container.querySelectorAll(".rounded-md.gradient-bg");
      expect(filledDots.length).toBe(2);
    });
  });

  // --- Fee display ---

  describe("fee calculation", () => {
    it("displays correct fee for 2-leg parlay", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(2);
      setStakeInput("100");
      // baseFee=100bps + 2*50bps = 200bps = 2%
      expect(screen.getByText("Fee (2.0%)")).toBeInTheDocument();
      expect(screen.getByText("$2.00")).toBeInTheDocument();
    });

    it("displays correct fee for 3-leg parlay", async () => {
      setupConnectedUser();
      render(<ParlayBuilder />);
      await waitFor(() => {
        expect(screen.queryByText("Connect Wallet")).not.toBeInTheDocument();
      });
      selectLegs(3);
      setStakeInput("100");
      // baseFee=100bps + 3*50bps = 250bps = 2.5%
      expect(screen.getByText("Fee (2.5%)")).toBeInTheDocument();
      expect(screen.getByText("$2.50")).toBeInTheDocument();
    });
  });
});
