import { describe, expect, it } from "vitest";
import {
  curationFeed, filterMatches, fittingFromList, inTheirArea, minBedrooms, preselect, recentLists, turnedDown, withinLimits,
} from "./curation";

const flat = (id, o = {}) => ({
  property_id: id, status: "published", flat_type: "2 BHK", rent: 40000, area: "HSR Layout",
  latitude: 12.9116, longitude: 77.6474, ...o,
});
const NONE = { disliked: new Set(), passed: new Set() };

describe("turnedDown", () => {
  it("collects their dislikes from every source, and an agent's passes apart", () => {
    const down = turnedDown("C1", [
      { client_id: "C1", property_id: "A", status: "disliked" },
      { client_id: "C1", property_id: "B", status: "rejected" },
      { client_id: "C1", property_id: "D", status: "liked" },
      { client_id: "C2", property_id: "E", status: "disliked" },
    ], [{ property_id: "F", reaction: "dislike" }, { property_id: "G", reaction: "like" }], [{ property_id: "C" }]);
    expect([...down.disliked].sort()).toEqual(["A", "B", "F"]);
    expect([...down.passed]).toEqual(["C"]);
  });
});

describe("minBedrooms / withinLimits", () => {
  it("the smallest flat type they named", () => {
    expect(minBedrooms({ flat_types: ["3 BHK", "2 BHK"] })).toBe(2);
    expect(minBedrooms({ flat_types: [] })).toBe(null);
  });
  it("a bigger flat is fine, a smaller one is not", () => {
    const req = { flat_types: ["2 BHK"], budget_max: 40000 };
    expect(withinLimits(flat("A", { flat_type: "3 BHK", rent: 48000 }), req)).toBe(true);
    expect(withinLimits(flat("B", { flat_type: "1 BHK", rent: 35000 }), req)).toBe(false);
    expect(withinLimits(flat("C", { flat_type: "Room in Preoccupied flat", rent: 15000 }), req)).toBe(false);
  });
  it("up to 20% over budget, no more", () => {
    const req = { budget_max: 40000 };
    expect(withinLimits(flat("A", { rent: 48000 }), req)).toBe(true);
    expect(withinLimits(flat("B", { rent: 48001 }), req)).toBe(false);
    expect(withinLimits(flat("B", { rent: 60000 }), req, { budget: false })).toBe(true);
  });
  it("nothing stated, nothing ruled out", () => {
    expect(withinLimits(flat("A", { flat_type: "1 RK", rent: 90000 }), {})).toBe(true);
  });
});

describe("inTheirArea", () => {
  it("a locality they named, or one inside it", () => {
    expect(inTheirArea(flat("A"), { localities: ["HSR Layout"] })).toBe(true);
    expect(inTheirArea(flat("B", { area: "Whitefield", latitude: 12.97, longitude: 77.75 }), { localities: ["HSR Layout"] })).toBe(false);
  });
  it("or within the distance of their office, straight line", () => {
    const office = { lat: 12.9352, lng: 77.6245 }; // Koramangala, ~3.5 km from HSR
    const far = flat("W", { area: "Whitefield", latitude: 12.9698, longitude: 77.75 });
    expect(inTheirArea(flat("A", { area: "Somewhere" }), { localities: ["Indiranagar"] }, office, 8)).toBe(true);
    expect(inTheirArea(far, { localities: ["Indiranagar"] }, office, 8)).toBe(false);
    expect(inTheirArea(far, { localities: [] }, office, 20)).toBe(true);
  });
  it("no localities and no office: can't judge, so it fits", () => {
    expect(inTheirArea(flat("A"), {})).toBe(true);
  });
});

describe("curationFeed / filterMatches", () => {
  const inv = [
    flat("GOOD"), flat("DISLIKED"), flat("PASSED"), flat("SMALL", { flat_type: "1 BHK" }),
    flat("PRICEY", { rent: 60000 }), flat("SOLD", { status: "rented" }),
  ];
  const req = { localities: ["HSR Layout"], flat_types: ["2 BHK"], budget_max: 42000, min_score: 50 };
  const down = { disliked: new Set(["DISLIKED"]), passed: new Set(["PASSED"]) };
  it("only live flats they haven't turned down, within their limits", () => {
    expect(curationFeed({ inventory: inv, req, down }).map((m) => m.listing.property_id)).toEqual(["GOOD"]);
  });
  it("keeps flats acted on just now in place, so they can be undone", () => {
    const keep = new Set(["PASSED", "SOLD"]);
    expect(curationFeed({ inventory: inv, req, down, keep }).map((m) => m.listing.property_id).sort()).toEqual(["GOOD", "PASSED", "SOLD"]);
  });
  it("the side pane drops dislikes and broken limits, but keeps a pass", () => {
    const ms = inv.map((l) => ({ listing: l }));
    expect(filterMatches(ms, req, down).map((m) => m.listing.property_id)).toEqual(["GOOD", "PASSED", "SOLD"]);
  });
});

describe("pre-selection from recent lists", () => {
  const now = new Date("2026-10-09T10:00:00Z").getTime();
  const lists = [
    { id: "L1", client_id: "OTHER", created_at: "2026-10-05T10:00:00Z", property_ids: ["A", "B", "C"] },
    { id: "L2", client_id: "OTHER", created_at: "2026-10-08T10:00:00Z", property_ids: ["C", "D"] },
    { id: "OLD", client_id: "OTHER", created_at: "2026-08-01T10:00:00Z", property_ids: ["E"] },
    { id: "MINE", client_id: "ME", created_at: "2026-10-08T10:00:00Z", property_ids: ["F"] },
  ];
  it("the last 30 days, newest first, not their own", () => {
    expect(recentLists(lists, "ME", { now }).map((l) => l.id)).toEqual(["L2", "L1"]);
  });
  const inventoryById = new Map([
    ["A", flat("A", { flat_type: "3 BHK", rent: 48000 })], // bigger, +20%: in
    ["B", flat("B", { flat_type: "1 BHK", rent: 35000 })], // smaller: out
    ["C", flat("C")],
    ["D", flat("D", { status: "rented" })], // sold out: out
  ]);
  const req = { localities: ["HSR Layout"], flat_types: ["2 BHK"], budget_max: 40000 };
  const ctx = { inventoryById, req, office: null, radiusKm: 8, down: NONE };
  it("what fits from each list", () => {
    expect(fittingFromList(lists[0], ctx)).toEqual(["A", "C"]);
  });
  it("across lists, each flat once", () => {
    expect(preselect(recentLists(lists, "ME", { now }), ctx)).toEqual(["C", "A"]);
  });
  it("never something they turned down or an agent passed", () => {
    const down = { disliked: new Set(["A"]), passed: new Set(["C"]) };
    expect(preselect(recentLists(lists, "ME", { now }), { ...ctx, down })).toEqual([]);
  });
  it("nothing to go on — no locality, no office — pre-selects nothing", () => {
    expect(preselect(recentLists(lists, "ME", { now }), { ...ctx, req: { flat_types: ["2 BHK"] } })).toEqual([]);
    expect(preselect(recentLists(lists, "ME", { now }), { ...ctx, req: { flat_types: ["2 BHK"] }, office: { lat: 12.9116, lng: 77.6474 } })).toEqual(["C", "A"]);
  });
  it("without a budget, the budget rule is skipped", () => {
    const pricey = new Map([...inventoryById, ["A", flat("A", { rent: 90000 })]]);
    expect(fittingFromList(lists[0], { ...ctx, inventoryById: pricey, req: { ...req, budget_max: null } })).toEqual(["A", "C"]);
  });
});
