import { afterEach, describe, expect, it } from "vitest";
import { closestArea, deriveAreas, withCurrent } from "./areas";
import { AREA_GROUPS, expandAreas, parentAreaOf, setAreaGroups, withParentArea } from "../data/preferenceOptions";

const rows = [
  { id: "a", name: "HSR", chip: true, parent_id: null, sort: 20, active: true },
  { id: "b", name: "Koramangala", chip: true, parent_id: null, sort: 10, active: true },
  { id: "c", name: "HSR Extension", chip: false, parent_id: null, sort: 30, active: true },
  { id: "d", name: "Kudlu Gate", chip: true, parent_id: "c", sort: 40, active: true },
  { id: "e", name: "Bommanahalli", chip: true, parent_id: "c", sort: 50, active: false },
];

describe("the CRM's areas list", () => {
  afterEach(() => setAreaGroups(AREA_GROUPS));

  it("chips: shown quick chips in the CRM's order", () => expect(deriveAreas(rows).chips).toEqual(["Koramangala", "HSR", "Kudlu Gate"]));
  it("names: everything on the list, A–Z, removed ones left out", () =>
    expect(deriveAreas(rows).names).toEqual(["HSR", "HSR Extension", "Koramangala", "Kudlu Gate"]));
  it("groups keep removed areas, so their flats still count in the wider one", () =>
    expect(deriveAreas(rows).groups).toEqual({ "HSR Extension": ["Kudlu Gate", "Bommanahalli"] }));

  it("matching follows the CRM's groups once handed over", () => {
    setAreaGroups(deriveAreas(rows).groups);
    expect(expandAreas(["HSR Extension"])).toEqual(["HSR Extension", "Kudlu Gate", "Bommanahalli"]);
    expect(parentAreaOf("Bommanahalli")).toBe("HSR Extension");
    expect(withParentArea("Kudlu Gate", [])).toEqual(["HSR Extension"]);
    expect(parentAreaOf("Harlur Road")).toBe("");
  });
  it("an empty set of groups means no groups, not the defaults", () => {
    setAreaGroups({});
    expect(expandAreas(["HSR Extension"])).toEqual(["HSR Extension"]);
  });

  it("a dropdown keeps a saved area that left the list", () => {
    expect(withCurrent(["HSR", "BTM"], "HSR Layout")).toEqual(["HSR Layout", "HSR", "BTM"]);
    expect(withCurrent(["HSR", "BTM"], "hsr")).toEqual(["HSR", "BTM"]);
    expect(withCurrent(["HSR"], "")).toEqual(["HSR"]);
  });

  it("Google's name for a place, as the list names it", () => {
    const names = ["HSR", "HSR Extension", "BTM", "Koramangala"];
    expect(closestArea("HSR Layout", names)).toBe("HSR");
    expect(closestArea("hsr extension", names)).toBe("HSR Extension");
    expect(closestArea("Koramangala 5th Block", names)).toBe("Koramangala");
    expect(closestArea("BTMX Layout", names)).toBe("");
    expect(closestArea("", names)).toBe("");
  });
});
