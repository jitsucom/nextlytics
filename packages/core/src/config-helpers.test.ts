import { describe, expect, it } from "vitest";
import { withDefaults } from "./config-helpers";

describe("withDefaults", () => {
  it("defaults callbacks to an empty object when omitted", () => {
    const result = withDefaults({});
    expect(result.callbacks).toEqual({});
  });

  it("preserves user-provided callbacks", () => {
    const getUser = async () => undefined;
    const result = withDefaults({ callbacks: { getUser } });
    expect(result.callbacks.getUser).toBe(getUser);
  });
});
