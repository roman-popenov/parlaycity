import { describe, it, expect } from "vitest";
import { mapStatus, parseOutcomeChoice, sanitizeNumericInput, blockNonNumericKeys } from "../utils";

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

describe("sanitizeNumericInput", () => {
  // --- Happy path: valid numeric strings pass through ---
  it("passes plain digits through", () => {
    expect(sanitizeNumericInput("123")).toBe("123");
  });

  it("passes decimal numbers through", () => {
    expect(sanitizeNumericInput("10.5")).toBe("10.5");
  });

  it("passes zero through", () => {
    expect(sanitizeNumericInput("0")).toBe("0");
  });

  it("passes single digit through", () => {
    expect(sanitizeNumericInput("5")).toBe("5");
  });

  it("passes large number through", () => {
    expect(sanitizeNumericInput("999999999")).toBe("999999999");
  });

  it("passes number with many decimal places", () => {
    expect(sanitizeNumericInput("1.123456")).toBe("1.123456");
  });

  it("handles leading decimal (.5)", () => {
    expect(sanitizeNumericInput(".5")).toBe(".5");
  });

  it("handles trailing decimal (5.)", () => {
    expect(sanitizeNumericInput("5.")).toBe("5.");
  });

  it("handles just a decimal point", () => {
    expect(sanitizeNumericInput(".")).toBe(".");
  });

  // --- Dangerous browser inputs: 'e' notation, sign prefixes, hex ---
  it("strips scientific notation 'e' (1e2 -> 12)", () => {
    expect(sanitizeNumericInput("1e2")).toBe("12");
  });

  it("strips uppercase 'E' notation (1E2 -> 12)", () => {
    expect(sanitizeNumericInput("1E2")).toBe("12");
  });

  it("strips '+' prefix (+10 -> 10)", () => {
    expect(sanitizeNumericInput("+10")).toBe("10");
  });

  it("strips '-' prefix (-5.5 -> 5.5)", () => {
    expect(sanitizeNumericInput("-5.5")).toBe("5.5");
  });

  it("strips '0x' hex prefix (0x1F -> 01)", () => {
    expect(sanitizeNumericInput("0x1F")).toBe("01");
  });

  it("strips '0X' uppercase hex (0X1A -> 01)", () => {
    expect(sanitizeNumericInput("0X1A")).toBe("01");
  });

  it("strips '0b' binary prefix (0b101 -> 0101)", () => {
    expect(sanitizeNumericInput("0b101")).toBe("0101");
  });

  it("strips '0o' octal prefix (0o17 -> 017)", () => {
    expect(sanitizeNumericInput("0o17")).toBe("017");
  });

  // --- Multiple decimal points ---
  it("keeps only first decimal point (1.2.3 -> 1.23)", () => {
    expect(sanitizeNumericInput("1.2.3")).toBe("1.23");
  });

  it("collapses three decimal points (1.2.3.4 -> 1.234)", () => {
    expect(sanitizeNumericInput("1.2.3.4")).toBe("1.234");
  });

  it("handles consecutive dots (1..2 -> 1.2)", () => {
    expect(sanitizeNumericInput("1..2")).toBe("1.2");
  });

  it("handles dots only (... -> .)", () => {
    expect(sanitizeNumericInput("...")).toBe(".");
  });

  // --- Letters and special characters ---
  it("strips all letters (abc -> empty)", () => {
    expect(sanitizeNumericInput("abc")).toBe("");
  });

  it("strips mixed alpha (1a2b3c -> 123)", () => {
    expect(sanitizeNumericInput("1a2b3c")).toBe("123");
  });

  it("strips spaces ( 10 -> 10)", () => {
    expect(sanitizeNumericInput(" 10 ")).toBe("10");
  });

  it("strips tabs and newlines", () => {
    expect(sanitizeNumericInput("\t10\n")).toBe("10");
  });

  it("strips comma separators (1,000 -> 1000)", () => {
    expect(sanitizeNumericInput("1,000")).toBe("1000");
  });

  it("strips dollar sign ($100 -> 100)", () => {
    expect(sanitizeNumericInput("$100")).toBe("100");
  });

  it("strips percent sign (50% -> 50)", () => {
    expect(sanitizeNumericInput("50%")).toBe("50");
  });

  it("strips parentheses (negative accounting format)", () => {
    expect(sanitizeNumericInput("(100)")).toBe("100");
  });

  it("strips unicode characters", () => {
    expect(sanitizeNumericInput("\u00A0100")).toBe("100"); // non-breaking space
  });

  it("strips emoji", () => {
    expect(sanitizeNumericInput("42\u{1F680}")).toBe("42");
  });

  // --- Edge cases ---
  it("handles empty string", () => {
    expect(sanitizeNumericInput("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(sanitizeNumericInput("   ")).toBe("");
  });

  it("handles Infinity", () => {
    expect(sanitizeNumericInput("Infinity")).toBe("");
  });

  it("handles NaN string", () => {
    expect(sanitizeNumericInput("NaN")).toBe("");
  });

  it("handles -Infinity", () => {
    expect(sanitizeNumericInput("-Infinity")).toBe("");
  });

  // --- Pasted content simulations ---
  it("strips 'USDC' suffix from pasted '100 USDC'", () => {
    expect(sanitizeNumericInput("100 USDC")).toBe("100");
  });

  it("strips currency prefix+suffix from '$100.50 USD'", () => {
    expect(sanitizeNumericInput("$100.50 USD")).toBe("100.50");
  });

  it("handles pasted scientific notation '1.5e3'", () => {
    expect(sanitizeNumericInput("1.5e3")).toBe("1.53");
  });

  it("handles pasted negative '-0.01'", () => {
    expect(sanitizeNumericInput("-0.01")).toBe("0.01");
  });

  // --- parseUnits/BigInt compatibility: output must be safe for parseUnits ---
  it("output of valid input can be parsed by parseFloat", () => {
    const inputs = ["10", "0.5", "100.00", ".25", "999999"];
    for (const input of inputs) {
      const sanitized = sanitizeNumericInput(input);
      expect(Number.isFinite(parseFloat(sanitized))).toBe(true);
    }
  });

  it("output never contains characters that crash BigInt", () => {
    const dangerous = ["1e2", "+10", "-5", "0x1F", "0b101", "0o17", "Infinity", "NaN"];
    for (const input of dangerous) {
      const sanitized = sanitizeNumericInput(input);
      // Should only contain digits and at most one dot
      expect(sanitized).toMatch(/^[\d.]*$/);
    }
  });
});

describe("blockNonNumericKeys", () => {
  function makeEvent(key: string, overrides: Partial<React.KeyboardEvent<HTMLInputElement>> = {}): React.KeyboardEvent<HTMLInputElement> {
    const prevented = { current: false };
    return {
      key,
      metaKey: false,
      ctrlKey: false,
      currentTarget: { value: "" } as HTMLInputElement,
      preventDefault: () => { prevented.current = true; },
      ...overrides,
      _prevented: prevented,
    } as unknown as React.KeyboardEvent<HTMLInputElement> & { _prevented: { current: boolean } };
  }

  function isPrevented(e: ReturnType<typeof makeEvent>): boolean {
    return (e as unknown as { _prevented: { current: boolean } })._prevented.current;
  }

  // --- Digit keys: all 10 should be allowed ---
  it("allows all digit keys 0-9", () => {
    for (const d of "0123456789".split("")) {
      const e = makeEvent(d);
      blockNonNumericKeys(e);
      expect(isPrevented(e)).toBe(false);
    }
  });

  it("allows digits when input already has content", () => {
    const e = makeEvent("5", { currentTarget: { value: "10" } as HTMLInputElement });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  // --- Decimal point ---
  it("allows decimal point on empty input", () => {
    const e = makeEvent(".");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows decimal point when input has only digits", () => {
    const e = makeEvent(".", { currentTarget: { value: "10" } as HTMLInputElement });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("blocks second decimal point (input already has '1.5')", () => {
    const e = makeEvent(".", { currentTarget: { value: "1.5" } as HTMLInputElement });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks decimal point when input is just '.'", () => {
    const e = makeEvent(".", { currentTarget: { value: "." } as HTMLInputElement });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks decimal point when input is '.5'", () => {
    const e = makeEvent(".", { currentTarget: { value: ".5" } as HTMLInputElement });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  // --- Dangerous characters that type="number" allows ---
  it("blocks 'e' (scientific notation)", () => {
    const e = makeEvent("e");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks 'E' (uppercase scientific notation)", () => {
    const e = makeEvent("E");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks '+' (positive sign)", () => {
    const e = makeEvent("+");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks '-' (negative sign)", () => {
    const e = makeEvent("-");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  // --- All lowercase letters blocked ---
  it("blocks all lowercase letters a-z", () => {
    for (let i = 97; i <= 122; i++) {
      const letter = String.fromCharCode(i);
      const e = makeEvent(letter);
      blockNonNumericKeys(e);
      expect(isPrevented(e)).toBe(true);
    }
  });

  // --- All uppercase letters blocked ---
  it("blocks all uppercase letters A-Z", () => {
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const e = makeEvent(letter);
      blockNonNumericKeys(e);
      expect(isPrevented(e)).toBe(true);
    }
  });

  // --- Special characters ---
  it("blocks space", () => {
    const e = makeEvent(" ");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks comma", () => {
    const e = makeEvent(",");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks slash", () => {
    const e = makeEvent("/");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks equals sign", () => {
    const e = makeEvent("=");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks at-sign", () => {
    const e = makeEvent("@");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks hash", () => {
    const e = makeEvent("#");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks dollar sign", () => {
    const e = makeEvent("$");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks percent", () => {
    const e = makeEvent("%");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks backtick", () => {
    const e = makeEvent("`");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks tilde", () => {
    const e = makeEvent("~");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  // --- Navigation keys: all allowed ---
  it("allows Backspace", () => {
    const e = makeEvent("Backspace");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Delete", () => {
    const e = makeEvent("Delete");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Tab", () => {
    const e = makeEvent("Tab");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Enter", () => {
    const e = makeEvent("Enter");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Escape", () => {
    const e = makeEvent("Escape");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Home", () => {
    const e = makeEvent("Home");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows End", () => {
    const e = makeEvent("End");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows all four arrow keys", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      const e = makeEvent(key);
      blockNonNumericKeys(e);
      expect(isPrevented(e)).toBe(false);
    }
  });

  // --- Modifier key combos (copy/paste/select/cut) ---
  it("allows Ctrl+A (select all)", () => {
    const e = makeEvent("a", { ctrlKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Ctrl+C (copy)", () => {
    const e = makeEvent("c", { ctrlKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Ctrl+V (paste)", () => {
    const e = makeEvent("v", { ctrlKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Ctrl+X (cut)", () => {
    const e = makeEvent("x", { ctrlKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Ctrl+Z (undo)", () => {
    const e = makeEvent("z", { ctrlKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Cmd+A (Mac select all)", () => {
    const e = makeEvent("a", { metaKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Cmd+V (Mac paste)", () => {
    const e = makeEvent("v", { metaKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Cmd+C (Mac copy)", () => {
    const e = makeEvent("c", { metaKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Cmd+X (Mac cut)", () => {
    const e = makeEvent("x", { metaKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  it("allows Cmd+Z (Mac undo)", () => {
    const e = makeEvent("z", { metaKey: true });
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(false);
  });

  // --- Without modifier, same keys are blocked ---
  it("blocks 'a' without modifier", () => {
    const e = makeEvent("a");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks 'v' without modifier", () => {
    const e = makeEvent("v");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  it("blocks 'c' without modifier", () => {
    const e = makeEvent("c");
    blockNonNumericKeys(e);
    expect(isPrevented(e)).toBe(true);
  });

  // --- Combined scenario: keydown + sanitize together ---
  describe("two-layer defense (keydown + sanitize)", () => {
    function simulateTyping(keys: string[], initialValue = ""): string {
      let value = initialValue;
      for (const key of keys) {
        const e = makeEvent(key, { currentTarget: { value } as HTMLInputElement });
        blockNonNumericKeys(e);
        if (!isPrevented(e)) {
          // Simulate the character being appended (simplified)
          if (key.length === 1) {
            value = sanitizeNumericInput(value + key);
          }
        }
      }
      return value;
    }

    it("typing '100' produces '100'", () => {
      expect(simulateTyping(["1", "0", "0"])).toBe("100");
    });

    it("typing '10.5' produces '10.5'", () => {
      expect(simulateTyping(["1", "0", ".", "5"])).toBe("10.5");
    });

    it("typing '1e2' blocks 'e', produces '12'", () => {
      expect(simulateTyping(["1", "e", "2"])).toBe("12");
    });

    it("typing '+10' blocks '+', produces '10'", () => {
      expect(simulateTyping(["+", "1", "0"])).toBe("10");
    });

    it("typing '-5' blocks '-', produces '5'", () => {
      expect(simulateTyping(["-", "5"])).toBe("5");
    });

    it("typing '10.5.3' blocks second dot, produces '10.53'", () => {
      expect(simulateTyping(["1", "0", ".", "5", ".", "3"])).toBe("10.53");
    });

    it("typing 'abc' produces empty string", () => {
      expect(simulateTyping(["a", "b", "c"])).toBe("");
    });

    it("typing '$100' blocks '$', produces '100'", () => {
      expect(simulateTyping(["$", "1", "0", "0"])).toBe("100");
    });

    it("typing '0x1F' blocks 'x' and 'F', produces '01'", () => {
      expect(simulateTyping(["0", "x", "1", "F"])).toBe("01");
    });
  });
});
