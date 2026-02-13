import { describe, expect, it } from "vitest";
import { stableHash } from "./stable-hash";

describe("stableHash", () => {
  it("hashes objects deterministically regardless of key order", () => {
    const a = { b: 1, a: 2 };
    const b = { a: 2, b: 1 };
    expect(stableHash(a)).toBe(stableHash(b));
  });

  it("hashes nested objects deterministically", () => {
    const a = { a: { z: 1, y: 2 } };
    const b = { a: { y: 2, z: 1 } };
    expect(stableHash(a)).toBe(stableHash(b));
  });

  it("preserves array order", () => {
    const a = { a: [1, 2] };
    const b = { a: [2, 1] };
    expect(stableHash(a)).not.toBe(stableHash(b));
  });

  it("drops undefined properties like JSON.stringify", () => {
    const a = { a: 1, b: undefined } as { a: number; b?: number | undefined };
    const b = { a: 1 };
    expect(stableHash(a)).toBe(stableHash(b));
  });
});
