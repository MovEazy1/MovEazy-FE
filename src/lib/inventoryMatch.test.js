import { describe, expect, it } from "vitest";
import { scoreMatch, matchListingToRequirements, normalizeRequirement } from "./inventoryMatch.js";

const listing = {
  property_id: "MZ-ABC123",
  area: "HSR",
  nearby_areas: ["Koramangala"],
  rent: 35000,
  flat_type: "2 BHK",
  furnishing: "Fully Furnished",
  amenities: ["Balcony", "Lift", "Covered Parking", "Near Metro"],
  house_rules: ["No Smoking"],
  occupants_allowed: ["Bachelor", "Working Professionals"],
};

describe("normalizeRequirement", () => {
  it("reads a snake_case DB search-profile row", () => {
    const r = normalizeRequirement({
      preferred_areas: ["HSR"],
      budget_min: 20000,
      budget_max: 40000,
      must_haves: "Balcony, Lift",
    });
    expect(r.areas).toEqual(["HSR"]);
    expect(r.budgetMin).toBe(20000);
    expect(r.mustHaves).toEqual(["Balcony", "Lift"]);
  });

  it("reads a camelCase Train My Broker prefs object", () => {
    const r = normalizeRequirement({ localities: ["HSR"], budgetMax: 40000, mustHaves: ["Gym"] });
    expect(r.areas).toEqual(["HSR"]);
    expect(r.budgetMax).toBe(40000);
    expect(r.mustHaves).toEqual(["Gym"]);
  });

  it("reads flat_types[] and deal_breakers[] array columns from user_requirements", () => {
    const r = normalizeRequirement({ localities: ["HSR"], flat_types: ["2 BHK", "3 BHK"], deal_breakers: ["No Sunlight"] });
    expect(r.flatTypes).toEqual(["2 BHK", "3 BHK"]);
    expect(r.dealBreakers).toEqual(["No Sunlight"]);
  });
});

describe("scoreMatch", () => {
  it("scores a strong match highly with reasons", () => {
    const req = { preferred_areas: ["HSR"], budget_min: 25000, budget_max: 40000, property_type: "2 BHK", furnishing: "Fully Furnished", must_haves: "Balcony, Lift" };
    const m = scoreMatch(listing, req);
    expect(m.score).toBeGreaterThanOrEqual(90);
    expect(m.blockers).toHaveLength(0);
    expect(m.reasons).toContain("Within budget");
    expect(m.reasons).toContain("In HSR");
  });

  it("gives partial credit when rent is slightly over budget", () => {
    const req = { preferred_areas: ["HSR"], budget_min: 20000, budget_max: 32000 };
    const m = scoreMatch(listing, req); // 35000 is < 15% over 32000
    expect(m.reasons).toContain("Slightly over budget");
    expect(m.score).toBeLessThan(100);
    expect(m.score).toBeGreaterThan(0);
  });

  it("treats a deal-breaker as a hard blocker (score 0)", () => {
    const req = { preferred_areas: ["HSR"], deal_breakers: "No Smoking" };
    const m = scoreMatch(listing, req);
    expect(m.blockers).toContain("No Smoking");
    expect(m.score).toBe(0);
  });

  it("blocks a bachelor when the flat has bachelor restrictions", () => {
    const familyOnly = { ...listing, occupants_allowed: ["Family", "Couple"] };
    const req = { preferred_areas: ["HSR"], deal_breakers: "Bachelor Restrictions" };
    const m = scoreMatch(familyOnly, req);
    expect(m.blockers).toContain("Bachelor Restrictions");
    expect(m.score).toBe(0);
  });

  it("scores low when nothing lines up", () => {
    const req = { preferred_areas: ["Whitefield"], budget_min: 5000, budget_max: 9000, property_type: "1 RK" };
    const m = scoreMatch(listing, req);
    expect(m.score).toBeLessThan(40);
  });
});

describe("matchListingToRequirements", () => {
  it("keeps only qualifying requirements, ranked by score", () => {
    const reqs = [
      { name: "A", preferred_areas: ["HSR"], budget_min: 30000, budget_max: 40000, property_type: "2 BHK", must_haves: "Balcony, Lift, Near Metro" },
      { name: "B", preferred_areas: ["Whitefield"], budget_min: 5000, budget_max: 9000 },       // too far / cheap
      { name: "C", preferred_areas: ["HSR"], deal_breakers: "No Smoking" },                      // blocked
    ];
    const out = matchListingToRequirements(listing, reqs, { min: 40 });
    expect(out.map((m) => m.requirement.name)).toEqual(["A"]);
  });
});
