import { describe, expect, it } from "vitest";
import { budgetFit, filterSocieties, hasAmenities } from "./societyFilters";

const a = { name: "A", amenity_tags: ["Swimming Pool", "Gymnasium", "Club House"], rents: { 2: [32000, 40000], 3: [45000, 60000] } };
const b = { name: "B", amenity_tags: ["Infinity pool", "Kids Play Area"], rents: {} };
const c = { name: "C", amenity_tags: ["Power Backup"], rents: { 2: [22000, 26000] } };

describe("society filters", () => {
  it("matches amenity families", () => {
    expect(hasAmenities(a, ["pool", "gym", "club"])).toBe(true);
    expect(hasAmenities(b, ["pool", "kids"])).toBe(true);
    expect(hasAmenities(c, ["pool"])).toBe(false);
  });
  it("fits a budget by the cheapest known rent, per BHK when picked", () => {
    expect(budgetFit(a, 35000)).toBe("fits");
    expect(budgetFit(a, 35000, "3")).toBe("over");
    expect(budgetFit(b, 35000)).toBe("unknown");
    expect(budgetFit(a, 0)).toBe("fits");
  });
  it("keeps rent-unknown societies apart for the bottom", () => {
    const r = filterSocieties([a, b, c], { budget: 25000 });
    expect(r.ok.map((x) => x.name)).toEqual(["C"]);
    expect(r.unknown.map((x) => x.name)).toEqual(["B"]);
    expect(filterSocieties([a, b, c], { amenities: ["pool"] }).ok.map((x) => x.name)).toEqual(["A", "B"]);
  });
});
