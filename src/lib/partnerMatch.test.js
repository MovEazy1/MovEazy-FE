import { describe, expect, it } from "vitest";
import { MATCH_MIN, bedroomsOf, hasRequirement, leadsForListing, matchesForLead, scoreLeadMatch } from "./partnerMatch";
import { EMPTY_FILTERS, applyFilters, bhkChipOf, matchesSearch } from "./partnerFilters";
import { inSource } from "./partners";

const flat = (over = {}) => ({
  property_id: "MZ-AAA111", area: "HSR Layout", nearby_areas: [], rent: 32000, flat_type: "2 BHK",
  bedrooms: 2, furnishing: "Fully Furnished", status: "published", available_from: null,
  brokerage_pct: 50, group_ids: [], ...over,
});
const lead = (over = {}) => ({
  name: "Rahul", status: "active", localities: ["HSR Layout", "Koramangala"], flat_types: ["2 BHK"],
  budget_min: 25000, budget_max: 40000, furnishing: "", ...over,
});

describe("scoreLeadMatch", () => {
  it("scores a perfect fit 100, with the PRD weights", () => {
    expect(scoreLeadMatch(flat(), lead()).score).toBe(100);
  });

  it("loses exactly the location weight in the wrong area", () => {
    expect(scoreLeadMatch(flat({ area: "Whitefield" }), lead()).score).toBe(60);
  });

  it("so a flat in the wrong area never counts as a match", () => {
    expect(60).toBeLessThan(MATCH_MIN);
    expect(matchesForLead(lead(), [flat({ area: "Whitefield" })])).toEqual([]);
  });

  it("finds a Kudlu Gate flat for a lead asking for HSR Extension", () => {
    const m = scoreLeadMatch(flat({ area: "Kudlu Gate" }), lead({ localities: ["HSR Extension"] }));
    expect(m.score).toBe(100);
  });

  it("gives half the budget for up to 10% over", () => {
    expect(scoreLeadMatch(flat({ rent: 43000 }), lead()).score).toBe(100 - 25 + 13);
    expect(scoreLeadMatch(flat({ rent: 50000 }), lead()).score).toBe(75);
  });

  it("gives a third of BHK for one bedroom off", () => {
    expect(scoreLeadMatch(flat({ flat_type: "3 BHK", bedrooms: 3 }), lead()).score).toBe(100 - 15 + 5);
  });

  it("gives half furnishing for the neighbouring kind", () => {
    expect(scoreLeadMatch(flat({ furnishing: "Semi Furnished" }), lead({ furnishing: "Fully Furnished" })).score).toBe(95);
  });

  it("marks a flat available only in two months down on availability", () => {
    const far = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    expect(scoreLeadMatch(flat({ available_from: far }), lead()).score).toBe(95);
  });
});

describe("matchesForLead / leadsForListing", () => {
  it("returns nothing for a lead with only a name and number", () => {
    const bare = { name: "X", phone: "9876543210", localities: [], flat_types: [] };
    expect(hasRequirement(bare)).toBe(false);
    expect(matchesForLead(bare, [flat()])).toEqual([]);
  });

  it("sorts best first, then by brokerage", () => {
    const out = matchesForLead(lead({ furnishing: "Fully Furnished" }), [
      flat({ property_id: "A", brokerage_pct: 30 }),
      flat({ property_id: "B", brokerage_pct: 100 }),
      flat({ property_id: "C", furnishing: "Unfurnished" }),
    ]);
    expect(out.map((m) => m.listing.property_id)).toEqual(["B", "A", "C"]);
  });

  it("runs in reverse and skips closed leads", () => {
    const out = leadsForListing(flat(), [lead({ name: "open" }), lead({ name: "done", status: "closed" })]);
    expect(out.map((m) => m.lead.name)).toEqual(["open"]);
  });
});

describe("filters", () => {
  it("reads BHK chips from flat_type or bedrooms", () => {
    expect(bedroomsOf("1 RK")).toBe(0.5);
    expect(bhkChipOf({ flat_type: "1 RK" })).toBe("1 RK");
    expect(bhkChipOf({ flat_type: "", bedrooms: 5 })).toBe("4+ BHK");
  });

  it("searches the way brokers type", () => {
    expect(matchesSearch(flat(), "2bhk hsr")).toBe(true);
    expect(matchesSearch(flat(), "hsr 30k")).toBe(true);
    expect(matchesSearch(flat(), "hsr 60k")).toBe(false);
    expect(matchesSearch(flat(), "whitefield")).toBe(false);
  });

  it("filters on brokerage share as a minimum", () => {
    const rows = [flat({ property_id: "A", brokerage_pct: 100 }), flat({ property_id: "B", brokerage_pct: 50 }),
      flat({ property_id: "C", brokerage_pct: null })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, brokerageMin: 75 }).map((r) => r.property_id)).toEqual(["A"]);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, brokerageMin: 50 }).map((r) => r.property_id)).toEqual(["A", "B"]);
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("filters rent min/max and location", () => {
    const rows = [flat({ property_id: "A", rent: 20000 }), flat({ property_id: "B", rent: 35000, area: "Bellandur" })];
    expect(applyFilters(rows, { ...EMPTY_FILTERS, rentMin: "30000" }).map((r) => r.property_id)).toEqual(["B"]);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, locations: ["HSR Layout"] }).map((r) => r.property_id)).toEqual(["A"]);
  });
});

describe("inSource", () => {
  it("puts a listing shared both ways in both tabs, and a private one in neither", () => {
    const both = flat({ source: "broker", on_platform: true, group_ids: ["g1"] });
    expect(inSource(both, "broker") && inSource(both, "group")).toBe(true);
    const groupOnly = flat({ source: "broker", on_platform: false, group_ids: ["g1"] });
    expect(inSource(groupOnly, "broker")).toBe(false);
    expect(inSource(flat({ source: "mine", on_platform: false }), "group")).toBe(false);
  });
});
