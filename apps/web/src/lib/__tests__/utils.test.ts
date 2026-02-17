import { describe, it, expect } from "vitest";
import { mapStatus, parseOutcomeChoice } from "../utils";

describe("mapStatus", () => {
  it("maps 0 -> Active", () => expect(mapStatus(0)).toBe("Active"));
  it("maps 1 -> Won", () => expect(mapStatus(1)).toBe("Won"));
  it("maps 2 -> Lost", () => expect(mapStatus(2)).toBe("Lost"));
  it("maps 3 -> Voided", () => expect(mapStatus(3)).toBe("Voided"));
  it("maps 4 -> Claimed", () => expect(mapStatus(4)).toBe("Claimed"));
  it("maps unknown code to Active", () => expect(mapStatus(99)).toBe("Active"));
  it("maps negative to Active", () => expect(mapStatus(-1)).toBe("Active"));
});

describe("parseOutcomeChoice", () => {
  it("parses YES (0x01 padded to 32 bytes)", () => {
    const yes = ("0x" + "0".repeat(63) + "1") as `0x${string}`;
    expect(parseOutcomeChoice(yes)).toBe(1);
  });

  it("parses NO (0x02 padded to 32 bytes)", () => {
    const no = ("0x" + "0".repeat(63) + "2") as `0x${string}`;
    expect(parseOutcomeChoice(no)).toBe(2);
  });

  it("returns 0 for zero bytes", () => {
    const zero = ("0x" + "0".repeat(64)) as `0x${string}`;
    expect(parseOutcomeChoice(zero)).toBe(0);
  });

  it("returns 0 for unknown value (0xff)", () => {
    const unknown = ("0x" + "0".repeat(62) + "ff") as `0x${string}`;
    expect(parseOutcomeChoice(unknown)).toBe(0);
  });

  it("returns 0 for large unknown value", () => {
    const large = ("0x" + "f".repeat(64)) as `0x${string}`;
    expect(parseOutcomeChoice(large)).toBe(0);
  });

  it("returns 0 for invalid hex", () => {
    expect(parseOutcomeChoice("0xZZZ" as `0x${string}`)).toBe(0);
  });

  it("handles short hex strings (0x1)", () => {
    expect(parseOutcomeChoice("0x1" as `0x${string}`)).toBe(1);
  });

  it("handles short hex strings (0x2)", () => {
    expect(parseOutcomeChoice("0x2" as `0x${string}`)).toBe(2);
  });

  it("returns 0 for value 3", () => {
    expect(parseOutcomeChoice("0x3" as `0x${string}`)).toBe(0);
  });
});
