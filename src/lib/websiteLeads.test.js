import { describe, expect, it } from "vitest";
import { BOOST, matchedPartnerFlats, rankBoosted } from "./websiteLeads";

const id = (r) => r.id;

describe("rankBoosted", () => {
  it("floats a boosted partner flat up when it fits", () => {
    const rows = [{ id: "MZ", score: 78 }, { id: "P", score: 70 }, { id: "X", score: 60 }];
    expect(rankBoosted(rows, new Set(["P"]), id).map(id)).toEqual(["P", "MZ", "X"]);
  });
  it("never lifts one that doesn't fit", () => {
    const rows = [{ id: "MZ", score: 62 }, { id: "P", score: 55 }];
    expect(rankBoosted(rows, new Set(["P"]), id).map(id)).toEqual(["MZ", "P"]);
  });
  it("is capped at the boost", () => {
    const rows = [{ id: "MZ", score: 60 + BOOST + 1 }, { id: "P", score: 60 }];
    expect(rankBoosted(rows, new Set(["P"]), id).map(id)).toEqual(["MZ", "P"]);
  });
  it("leaves the order alone without a boosted set", () => {
    const rows = [{ id: "A", score: 50 }, { id: "B", score: 90 }];
    expect(rankBoosted(rows, null, id).map(id)).toEqual(["B", "A"]);
  });
});

describe("matchedPartnerFlats", () => {
  it("partner flats at 70+, best first, at most 3", () => {
    const rows = [{ id: "A", score: 71 }, { id: "B", score: 95 }, { id: "C", score: 69 }, { id: "D", score: 80 }, { id: "E", score: 75 }, { id: "MZ", score: 99 }];
    expect(matchedPartnerFlats(rows, new Set(["A", "B", "C", "D", "E"]), id)).toEqual(["B", "D", "E"]);
  });
});
