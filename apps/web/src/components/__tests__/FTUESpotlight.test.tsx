import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FTUESpotlight } from "../FTUESpotlight";

// ── DOM mocks ─────────────────────────────────────────────────────────────

const fakeRect = { top: 100, left: 100, width: 200, height: 40, right: 300, bottom: 140, x: 100, y: 100, toJSON: () => ({}) };
const fakeElement = { getBoundingClientRect: () => fakeRect } as unknown as HTMLElement;

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
  // Mock getElementById to return a fake element for FTUE targets
  vi.spyOn(document, "getElementById").mockReturnValue(fakeElement as unknown as HTMLElement);
  // Mock requestAnimationFrame to return ID without executing (measure() is called directly first)
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("FTUESpotlight", () => {
  it("renders tooltip on first visit (phase 1)", async () => {
    await act(async () => { render(<FTUESpotlight />); });
    expect(screen.getByTestId("ftue-tooltip")).toBeInTheDocument();
    expect(screen.getByText("Connect Your Wallet")).toBeInTheDocument();
  });

  it("does not render when both phases are completed", async () => {
    sessionStore["ftue:completed"] = "true";
    sessionStore["ftue:phase2_completed"] = "true";
    await act(async () => { render(<FTUESpotlight />); });
    expect(screen.queryByTestId("ftue-tooltip")).not.toBeInTheDocument();
  });

  it("skip button completes both phases", async () => {
    await act(async () => { render(<FTUESpotlight />); });
    expect(screen.getByTestId("ftue-tooltip")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText("Skip")); });
    expect(screen.queryByTestId("ftue-tooltip")).not.toBeInTheDocument();
    expect(sessionStorage.setItem).toHaveBeenCalledWith("ftue:completed", "true");
    expect(sessionStorage.setItem).toHaveBeenCalledWith("ftue:phase2_completed", "true");
  });

  it("renders progress dots", async () => {
    await act(async () => { render(<FTUESpotlight />); });
    // Phase 1 has 3 steps, so 3 dots
    const tooltip = screen.getByTestId("ftue-tooltip");
    const dots = tooltip.querySelectorAll(".rounded-full");
    // Filter to just the small progress dots (h-1.5 w-1.5)
    const progressDots = Array.from(dots).filter(d => d.classList.contains("h-1\\.5") || d.className.includes("h-1.5"));
    expect(progressDots.length).toBe(3);
  });

  it("shows Back button disabled on first step", async () => {
    await act(async () => { render(<FTUESpotlight />); });
    const backBtn = screen.getByText("Back");
    expect(backBtn).toBeDisabled();
  });
});
