/**
 * Guards the seam between the two listing shapes.
 *
 * The map holds listings in the mapped shape (bhk / monthlyRent / location);
 * scoreMatch reads the inventory column names (flat_type / rent / area). If that
 * bridge drifts, ranking doesn't throw — it scores every home zero and "Best
 * match" silently stops ranking. These tests fail loudly instead.
 */
import { describe, expect, it } from "vitest";
import { mapInventoryToListing } from "./inventory";
import { scoreMatch, listingForScoring } from "./inventoryMatch";

const inventoryRow = {
  property_id: "MZ-TEST01",
  title: "2 BHK in HSR",
  area: "HSR",
  nearby_areas: ["Koramangala"],
  city: "Bengaluru",
  rent: 40000,
  deposit: 80000,
  flat_type: "2 BHK",
  furnishing: "Semi Furnished",
  amenities: ["Balcony", "Lift"],
  house_rules: [],
  occupants_allowed: ["Family"],
  images: [],
};

const requirement = {
  localities: ["HSR"],
  budget_min: 30000,
  budget_max: 50000,
  flat_types: ["2 BHK"],
  must_haves: ["Balcony", "Lift"],
  occupants: ["Family"],
  deal_breakers: [],
};

describe("scoring a listing that the map is holding", () => {
  it("survives the round trip through the mapped shape", () => {
    const mapped = mapInventoryToListing(inventoryRow);
    const direct = scoreMatch(inventoryRow, requirement);
    const viaMap = scoreMatch(listingForScoring(mapped), requirement);

    // The bridge must not lose information the score depends on.
    expect(viaMap.score).toBe(direct.score);
    expect(viaMap.score).toBeGreaterThan(0);
  });

  it("keeps every field the scorer actually reads", () => {
    const bridged = listingForScoring(mapInventoryToListing(inventoryRow));
    expect(bridged.area).toBe("HSR");
    expect(bridged.rent).toBe(40000);
    expect(bridged.flat_type).toBe("2 BHK");
    expect(bridged.furnishing).toBe("Semi Furnished");
    expect(bridged.amenities).toEqual(["Balcony", "Lift"]);
    expect(bridged.occupants_allowed).toEqual(["Family"]);
    expect(bridged.nearby_areas).toEqual(["Koramangala"]);
  });

  it("ranks a matching home above a mismatched one", () => {
    const good = listingForScoring(mapInventoryToListing(inventoryRow));
    const bad = listingForScoring(
      mapInventoryToListing({ ...inventoryRow, area: "Whitefield", nearby_areas: [], rent: 95000, flat_type: "1 RK" }),
    );
    expect(scoreMatch(good, requirement).score).toBeGreaterThan(scoreMatch(bad, requirement).score);
  });

  it("also accepts a raw inventory row, so either shape scores the same", () => {
    expect(listingForScoring(inventoryRow).area).toBe("HSR");
    expect(listingForScoring(inventoryRow).rent).toBe(40000);
  });
});
