/**
 * An area offered in one flow is offered in all of them.
 *
 * There are three separate lists, for three different jobs: the curated
 * localities every posting flow and the questionnaire read, what the search
 * agent parses typed answers against, and the map's filter chips. Adding an
 * area to one and not the others is the failure worth catching — a flat
 * postable in Hoodi that nobody can filter for is worse than not offering it.
 *
 * The second test guards the trap in the third list: the map's areas are
 * derived from demo data that also generates synthetic listings, so adding an
 * area the obvious way invents a flat in it.
 */
import { describe, expect, it } from "vitest";
import listingsData, { AREA_NAMES_SORTED } from "./listingsData";
import { ALL_LOCALITIES } from "./preferenceOptions";
import { POPULAR_AREAS } from "../lib/flatRecommendationEngine";

/** Areas that must be selectable wherever an area can be chosen. */
const OFFERED_EVERYWHERE = ["Hoodi", "Whitefield", "Koramangala", "Bellandur"];

describe("area coverage", () => {
  it.each(OFFERED_EVERYWHERE)("%s can be posted, searched and filtered", (area) => {
    // Posting, the AIBroker questionnaire, the CRM form, the listing importer.
    expect(ALL_LOCALITIES).toContain(area);
    // What a typed answer is matched against.
    expect(POPULAR_AREAS.some((a) => a.startsWith(area))).toBe(true);
    // The map's filter chips, and what a ?locality= link resolves against.
    expect(AREA_NAMES_SORTED.some((a) => a.startsWith(area))).toBe(true);
  });

  it("offers no area twice", () => {
    expect(new Set(ALL_LOCALITIES).size).toBe(ALL_LOCALITIES.length);
    expect(new Set(AREA_NAMES_SORTED).size).toBe(AREA_NAMES_SORTED.length);
  });

  it("does not invent a listing for an area that has none", () => {
    // Every row of the demo `localities` table becomes a synthetic listing that
    // store.js seeds into localStorage and the map and home page then show. An
    // area added there to make it filterable would fabricate a flat in it, so
    // AREA_NAMES_SORTED carries such areas separately.
    const seedAreas = new Set(listingsData.map((l) => l.locality || l.area));
    expect(seedAreas.has("Hoodi")).toBe(false);
    expect(listingsData.filter((l) => String(l.title || "").includes("Hoodi"))).toEqual([]);
  });
});
