/**
 * ERC-8021 Builder Code attribution suffix for agent scripts.
 * Same encoding as apps/web/src/lib/builder-code.ts (Node.js version).
 */

export function encodeBuilderCodeSuffix(code: string): `0x${string}` {
  const codeBytes = Buffer.from(code, "ascii");
  const len = codeBytes.length;
  const marker = Buffer.from([
    0x80, 0x21, 0x80, 0x21, 0x80, 0x21, 0x80, 0x21,
    0x80, 0x21, 0x80, 0x21, 0x80, 0x21, 0x80, 0x21,
  ]);
  const suffix = Buffer.concat([
    Buffer.from([len]),
    codeBytes,
    Buffer.from([0x00]),
    marker,
  ]);
  return `0x${suffix.toString("hex")}` as `0x${string}`;
}

export const BUILDER_CODE = process.env.BUILDER_CODE ?? "parlayvoo";
export const BUILDER_SUFFIX = encodeBuilderCodeSuffix(BUILDER_CODE);
