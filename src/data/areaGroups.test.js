/**
 * People name the same place at different zoom levels. Someone searching says
 * "HSR Extension"; the flat they want is listed as "Kudlu Gate". Both are
 * right, and before this the search simply missed it.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_LOCALITIES, expandArea, expandAreas, parentAreaOf, withParentArea,
} from "./preferenceOptions";

describe("the five new areas exist for both sides to pick", () => {
  it("is offered wherever localities are listed", () => {
    for (const a of ["HSR Extension", "Kudlu Gate", "Harlur Road", "Silver County Road", "ITI Layout"]) {
      expect(ALL_LOCALITIES, a).toContain(a);
    }
  });
});

describe("asking for the parent takes any of its children", () => {
  it("opens HSR Extension up into all five", () => {
    expect(expandArea("HSR Extension")).toEqual([
      "HSR Extension", "Kudlu Gate", "Harlur Road", "Silver County Road", "ITI Layout",
    ]);
  });

  it("leaves a plain locality alone", () => {
    expect(expandArea("Koramangala")).toEqual(["Koramangala"]);
  });

  it("does not widen a child into its siblings", () => {
    // Wanting Kudlu Gate is not wanting all of HSR Extension.
    expect(expandArea("Kudlu Gate")).toEqual(["Kudlu Gate"]);
  });

  it("merges across several picks without repeating", () => {
    const out = expandAreas(["HSR Extension", "Kudlu Gate", "Koramangala"]);
    expect(out.filter((a) => a === "Kudlu Gate")).toHaveLength(1);
    expect(out).toContain("Koramangala");
  });

  it("ignores case and stray spacing", () => {
    expect(expandArea("  hsr extension ")).toHaveLength(5);
  });
});

describe("listing a child also places it in the parent", () => {
  it("adds the parent to nearby areas", () => {
    expect(withParentArea("Kudlu Gate", [])).toEqual(["HSR Extension"]);
  });

  it("keeps whatever the poster already chose", () => {
    expect(withParentArea("Harlur Road", ["Bellandur"])).toEqual(["Bellandur", "HSR Extension"]);
  });

  it("doesn't add it twice", () => {
    expect(withParentArea("ITI Layout", ["HSR Extension"])).toEqual(["HSR Extension"]);
  });

  it("leaves a locality that isn't inside one untouched", () => {
    expect(withParentArea("Whitefield", ["BTM"])).toEqual(["BTM"]);
    expect(parentAreaOf("Whitefield")).toBe("");
  });

  it("knows which parent a child belongs to", () => {
    expect(parentAreaOf("Silver County Road")).toBe("HSR Extension");
  });
});
