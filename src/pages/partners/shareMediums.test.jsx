import { describe, expect, it } from "vitest";
import { cleanPct, defaultShare } from "./ShareMediums";
import { toSharing } from "./ShareWithForm";

describe("sharing a new flat", () => {
  it("starts with every medium at 50%", () => {
    expect(defaultShare([{ id: "g1" }, { id: "g2" }])).toEqual({ platformOn: true, platformPct: 50, groupPct: { g1: 50, g2: 50 } });
  });
  it("takes any whole number up to 100", () => {
    expect(cleanPct("35")).toBe(35);
    expect(cleanPct("150")).toBe(100);
    expect(cleanPct("4a5")).toBe(45);
    expect(cleanPct("")).toBe("");
  });
  it("saves a half-typed share as 50%, and an opted-out one as not shared", () => {
    expect(toSharing({ platformOn: true, platformPct: "", groupPct: { g1: "", g2: 30 } }))
      .toEqual({ platformPct: 50, groups: [{ group_id: "g1", pct: 50 }, { group_id: "g2", pct: 30 }] });
    expect(toSharing({ platformOn: false, platformPct: 40, groupPct: {} })).toEqual({ platformPct: null, groups: [] });
  });
});
