import { describe, expect, it } from "vitest";
import { isConstrainedNetwork } from "./prefetch";

describe("isConstrainedNetwork", () => {
  it("skips on data saver and 2G/3G", () => {
    expect(isConstrainedNetwork({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(isConstrainedNetwork({ effectiveType: "3g" })).toBe(true);
    expect(isConstrainedNetwork({ effectiveType: "slow-2g" })).toBe(true);
  });
  it("prefetches on 4G, or when the browser doesn't say", () => {
    expect(isConstrainedNetwork({ effectiveType: "4g" })).toBe(false);
    expect(isConstrainedNetwork(null)).toBe(false);
  });
});
