// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleChunkError, reloadForUpdate } from "./appUpdate";

describe("reloadForUpdate", () => {
  const reload = vi.fn();
  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal("location", { ...window.location, reload });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("reloads, but not again within 30 s", () => {
    vi.useFakeTimers();
    expect(reloadForUpdate()).toBe(true);
    expect(reloadForUpdate()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads again for a later deploy the same session (the old guard didn't)", () => {
    vi.useFakeTimers();
    expect(reloadForUpdate()).toBe(true);
    vi.advanceTimersByTime(31000);
    expect(reloadForUpdate()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe("isStaleChunkError", () => {
  it("knows a missing screen file from each browser", () => {
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/a.js"))).toBe(true);
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});
