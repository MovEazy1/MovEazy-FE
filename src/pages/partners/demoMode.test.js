import { describe, expect, it } from "vitest";
import { DEMO_LEADS, demoHomesFor } from "./demoMode";
import { matchesForLead } from "../../lib/partnerMatch";

const photos = [{ cover_image_url: "https://example.com/a.jpg", images: [] }];

describe("demo matcher", () => {
  it("gives every sample client a shortlist from the real engine, with a spread of scores", () => {
    for (const lead of DEMO_LEADS) {
      const matches = matchesForLead(lead, demoHomesFor(lead, photos, 0));
      expect(matches.length).toBeGreaterThanOrEqual(8);
      const scores = new Set(matches.map((m) => m.score));
      expect(scores.size).toBeGreaterThan(1);
      expect(matches.every((m) => m.listing.demo && m.listing.cover_image_url)).toBe(true);
    }
  });

  it("is stable for one run and reshuffles on the next", () => {
    const lead = DEMO_LEADS[0];
    const a = demoHomesFor(lead, photos, 0).map((h) => `${h.area}:${h.rent}`);
    expect(demoHomesFor(lead, photos, 0).map((h) => `${h.area}:${h.rent}`)).toEqual(a);
    expect(demoHomesFor(lead, photos, 1).map((h) => `${h.area}:${h.rent}`)).not.toEqual(a);
  });

  it("works for a client with only a BHK", () => {
    const lead = { id: "x", flat_types: ["2 BHK"], localities: [], status: "active" };
    expect(matchesForLead(lead, demoHomesFor(lead, photos, 3)).length).toBeGreaterThanOrEqual(8);
  });
});
