import { describe, expect, it } from "vitest";
import { parseStepInput, runRecommendations } from "./flatSearchAgent";
import { scoreListing } from "./flatRecommendationEngine";

const sampleListings = [
  {
    id: "1",
    bhk: "2 BHK",
    monthlyRent: 35000,
    address: "HSR Layout, Bengaluru",
    availability: "Immediate",
    furnishing: "Semi",
    lat: 12.91,
    lng: 77.64,
  },
  {
    id: "2",
    bhk: "1 BHK",
    monthlyRent: 18000,
    address: "Whitefield, Bengaluru",
    availability: "Within 30 days",
    furnishing: "Full",
    lat: 12.99,
    lng: 77.74,
  },
];

describe("flatSearchAgent", () => {
  it("parses area and budget from natural text", () => {
    const area = parseStepInput("area", "HSR and Koramangala");
    expect(area.ok).toBe(true);
    expect(area.patch.areas).toContain("HSR Layout");

    const budget = parseStepInput("budget", "25k-50k");
    expect(budget.ok).toBe(true);
    expect(budget.patch.budgetMin).toBeGreaterThan(0);
  });

  it("ranks HSR 2BHK higher for matching prefs", () => {
    const prefs = {
      areas: ["HSR Layout"],
      budgetMin: 25000,
      budgetMax: 50000,
      bhk: "2 BHK",
      furnishing: "Semi",
      timeline: "Immediate",
      mustHaves: "",
    };
    const recs = runRecommendations(sampleListings, prefs);
    expect(recs[0].listing.id).toBe("1");
    expect(recs[0].score).toBeGreaterThan(recs[1]?.score ?? 0);
  });

  it("scores budget mismatch lower", () => {
    const good = scoreListing(sampleListings[0], { budgetMin: 30000, budgetMax: 40000 });
    const bad = scoreListing(sampleListings[0], { budgetMin: 5000, budgetMax: 10000 });
    expect(good.score).toBeGreaterThan(bad.score);
  });
});
