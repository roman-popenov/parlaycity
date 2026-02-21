import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoBanner } from "../DemoBanner";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockUseAccount = vi.fn(() => ({
  isConnected: false as boolean,
  address: undefined as string | undefined,
}));
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

const mockMint = vi.fn();
const mockUseUSDCBalance = vi.fn(() => ({
  balance: undefined as bigint | undefined,
  refetch: vi.fn(),
}));
const mockUseMintTestUSDC = vi.fn(() => ({
  mint: mockMint,
  isPending: false,
  isConfirming: false,
  isSuccess: false,
}));

vi.mock("@/lib/hooks", () => ({
  useUSDCBalance: () => mockUseUSDCBalance(),
  useMintTestUSDC: () => mockUseMintTestUSDC(),
}));

// ── Session storage mock ──────────────────────────────────────────────────

let sessionStore: Record<string, string>;

beforeEach(() => {
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
  mockUseAccount.mockReturnValue({ isConnected: false, address: undefined });
  mockUseUSDCBalance.mockReturnValue({ balance: undefined, refetch: vi.fn() });
  mockUseMintTestUSDC.mockReturnValue({
    mint: mockMint,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DemoBanner", () => {
  it("is hidden when wallet is not connected", () => {
    render(<DemoBanner />);
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
  });

  it("is hidden when wallet has USDC balance", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 1_000_000n, refetch: vi.fn() });
    render(<DemoBanner />);
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
  });

  it("shows when connected with zero balance", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    render(<DemoBanner />);
    expect(screen.getByTestId("demo-banner")).toBeInTheDocument();
    expect(screen.getByText("Welcome to ParlayVoo! Mint test USDC to get started.")).toBeInTheDocument();
  });

  it("shows when connected with undefined balance", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: undefined, refetch: vi.fn() });
    render(<DemoBanner />);
    expect(screen.getByTestId("demo-banner")).toBeInTheDocument();
  });

  it("calls mint on button click", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    render(<DemoBanner />);
    fireEvent.click(screen.getByText("Mint 1,000 Test USDC"));
    expect(mockMint).toHaveBeenCalled();
  });

  it("shows Signing... when isPending", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    mockUseMintTestUSDC.mockReturnValue({
      mint: mockMint,
      isPending: true,
      isConfirming: false,
      isSuccess: false,
    });
    render(<DemoBanner />);
    expect(screen.getByText("Signing...")).toBeInTheDocument();
  });

  it("shows Minting... when isConfirming", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    mockUseMintTestUSDC.mockReturnValue({
      mint: mockMint,
      isPending: false,
      isConfirming: true,
      isSuccess: false,
    });
    render(<DemoBanner />);
    expect(screen.getByText("Minting...")).toBeInTheDocument();
  });

  it("dismiss persists to sessionStorage", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    render(<DemoBanner />);
    expect(screen.getByTestId("demo-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
    expect(sessionStorage.setItem).toHaveBeenCalledWith("demo:bannerDismissed", "true");
  });

  it("stays hidden when sessionStorage has dismissed=true", () => {
    sessionStore["demo:bannerDismissed"] = "true";
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    render(<DemoBanner />);
    expect(screen.queryByTestId("demo-banner")).not.toBeInTheDocument();
  });

  it("disables mint button during isPending", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    mockUseMintTestUSDC.mockReturnValue({
      mint: mockMint,
      isPending: true,
      isConfirming: false,
      isSuccess: false,
    });
    render(<DemoBanner />);
    expect(screen.getByText("Signing...").closest("button")).toBeDisabled();
  });

  it("disables mint button during isConfirming", () => {
    mockUseAccount.mockReturnValue({ isConnected: true, address: "0x1234" });
    mockUseUSDCBalance.mockReturnValue({ balance: 0n, refetch: vi.fn() });
    mockUseMintTestUSDC.mockReturnValue({
      mint: mockMint,
      isPending: false,
      isConfirming: true,
      isSuccess: false,
    });
    render(<DemoBanner />);
    expect(screen.getByText("Minting...").closest("button")).toBeDisabled();
  });
});
