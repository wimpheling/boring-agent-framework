import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultIdGenerator } from "../src";
import { serializeError } from "../src/types";
import { cloneValue, deepFreeze } from "../src/utils/clone";

describe("runtime utilities", () => {
  const originalStructuredClone = globalThis.structuredClone;
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: originalStructuredClone,
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("serializes Error values without undefined optional fields", () => {
    const error = new Error("bad", { cause: "because" });

    expect(serializeError(error)).toMatchObject({
      name: "Error",
      message: "bad",
      cause: "because",
    });
  });

  it("omits absent Error stack and cause fields", () => {
    const error = new Error("bad");
    Object.defineProperty(error, "stack", {
      configurable: true,
      value: undefined,
    });

    expect(serializeError(error)).toEqual({
      name: "Error",
      message: "bad",
    });
  });

  it("serializes string and unknown errors", () => {
    expect(serializeError("bad")).toEqual({ message: "bad" });
    expect(serializeError({ code: "x" })).toEqual({
      message: "Unknown error",
      cause: { code: "x" },
    });
  });

  it("uses JSON cloning when structuredClone is unavailable", () => {
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: undefined,
    });

    const input = { nested: { value: 1 } };
    const cloned = cloneValue(input);

    expect(cloned).toEqual(input);
    expect(cloned).not.toBe(input);
    expect(cloned.nested).not.toBe(input.nested);
  });

  it("falls back to shallow cloning when JSON cloning fails", () => {
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      value: undefined,
    });

    const circular: { readonly value: number; self?: unknown } = { value: 1 };
    circular.self = circular;

    const clonedObject = cloneValue(circular);
    const clonedArray = cloneValue([circular]);

    expect(clonedObject).toEqual({ value: 1, self: circular });
    expect(clonedObject).not.toBe(circular);
    expect(clonedArray).toEqual([circular]);
    expect(clonedArray).not.toBe([circular]);
    expect(cloneValue(1)).toBe(1);
    expect(cloneValue(Symbol.for("value"))).toBe(Symbol.for("value"));
  });

  it("returns nullish and already-frozen values directly from utility guards", () => {
    const frozen = Object.freeze({ value: 1 });

    expect(cloneValue(null)).toBeNull();
    expect(cloneValue(undefined)).toBeUndefined();
    expect(deepFreeze(null)).toBeNull();
    expect(deepFreeze(frozen)).toBe(frozen);
  });

  it("generates fallback ids when randomUUID is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });
    vi.spyOn(Date, "now").mockReturnValue(123456);

    expect(defaultIdGenerator()).toMatch(/^baf_2n9c_[a-z0-9]+$/);
  });
});
