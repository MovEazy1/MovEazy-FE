import { describe, expect, it } from "vitest";
import { shareSummary } from "./ShareWithForm";

describe("post a flat — who sees it", () => {
  const groups = [{ id: "g1", name: "HSR Brokers" }, { id: "g2", name: "BTM Circle" }];
  it("says it in a few words", () => {
    expect(shareSummary({ platformOn: false, platformPct: 50, groupPct: {} }, groups)).toBe("Only me");
    expect(shareSummary({ platformOn: true, platformPct: 60, groupPct: {} }, groups)).toBe("All MovEazy brokers · 60%");
    expect(shareSummary({ platformOn: false, platformPct: 50, groupPct: { g1: 50 } }, groups)).toBe("HSR Brokers");
    expect(shareSummary({ platformOn: true, platformPct: 50, groupPct: { g1: 50, g2: 40 } }, groups)).toBe("All MovEazy brokers · 50% + 2 groups");
  });
});
