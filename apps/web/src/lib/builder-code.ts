/**
 * ERC-8021 Builder Code attribution suffix.
 * Appended to calldata on every on-chain transaction for Base Agents bounty.
 *
 * Format: [length: 1 byte][codes: ASCII][schema: 0x00][marker: 0x8021... (16 bytes)]
 */

export function encodeBuilderCodeSuffix(code: string): `0x${string}` {
  const codeBytes = new TextEncoder().encode(code);
  const len = codeBytes.length;
  const marker = [
    0x80, 0x21, 0x80, 0x21, 0x80, 0x21, 0x80, 0x21,
    0x80, 0x21, 0x80, 0x21, 0x80, 0x21, 0x80, 0x21,
  ];
  const suffix = new Uint8Array([len, ...codeBytes, 0x00, ...marker]);
  const hex = Array.from(suffix)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as `0x${string}`;
}

export const BUILDER_CODE =
  process.env.NEXT_PUBLIC_BUILDER_CODE ?? "parlayvoo";
export const BUILDER_SUFFIX = encodeBuilderCodeSuffix(BUILDER_CODE);
