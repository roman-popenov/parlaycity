import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoHint } from "../DemoHint";

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
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DemoHint", () => {
  it("renders when visible is true", () => {
    render(
      <DemoHint
        sessionKey="demo:test"
        step={1}
        message="Test hint message"
        visible={true}
      />,
    );
    expect(screen.getByTestId("demo-hint-1")).toBeInTheDocument();
    expect(screen.getByText("Test hint message")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not render when visible is false", () => {
    render(
      <DemoHint
        sessionKey="demo:test"
        step={2}
        message="Hidden hint"
        visible={false}
      />,
    );
    expect(screen.queryByTestId("demo-hint-2")).not.toBeInTheDocument();
  });

  it("dismiss hides the hint and persists to sessionStorage", () => {
    render(
      <DemoHint
        sessionKey="demo:test"
        step={1}
        message="Dismissable hint"
        visible={true}
      />,
    );
    expect(screen.getByTestId("demo-hint-1")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss hint"));
    expect(screen.queryByTestId("demo-hint-1")).not.toBeInTheDocument();
    expect(sessionStorage.setItem).toHaveBeenCalledWith("demo:test", "true");
  });

  it("stays hidden when sessionStorage has dismissed=true", () => {
    sessionStore["demo:test"] = "true";
    render(
      <DemoHint
        sessionKey="demo:test"
        step={1}
        message="Already dismissed"
        visible={true}
      />,
    );
    expect(screen.queryByTestId("demo-hint-1")).not.toBeInTheDocument();
  });

  it("renders correct step number", () => {
    render(
      <DemoHint
        sessionKey="demo:step3"
        step={3}
        message="Step 3 hint"
        visible={true}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByTestId("demo-hint-3")).toBeInTheDocument();
  });
});
