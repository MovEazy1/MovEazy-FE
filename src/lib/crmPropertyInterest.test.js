/**
 * Reading what a client wants from the flats they opened.
 *
 * The cases that matter: a single shared link must fill all three tiles; real
 * answers must always beat the guess, field by field; and evidence the client
 * didn't choose — a flat we sent that they merely opened — must not outvote
 * evidence they did.
 */
import { describe, expect, it } from "vitest";
import {
  basisLabel, effectiveFacts, groupInterestByClient, hasStatedRequirement, inferRequirement,
  rentSeenLabel, requirementForMatching,
} from "./crmPropertyInterest";

const inv = new Map([
  ["MZ-RPN52S", { property_id: "MZ-RPN52S", area: "JP Nagar", rent: 27000, flat_type: "2 BHK" }],
  ["MZ-HSR1", { property_id: "MZ-HSR1", area: "HSR", rent: 32000, flat_type: "2 BHK" }],
  ["MZ-HSR2", { property_id: "MZ-HSR2", area: "HSR", rent: 22000, flat_type: "1 BHK" }],
  ["MZ-KORA", { property_id: "MZ-KORA", area: "Koramangala", rent: 60000, flat_type: "3 BHK" }],
]);
const sig = (property_id, signal, at = "2026-09-20T10:00:00Z") => ({ client_id: "c1", property_id, signal, at });

describe("inferRequirement", () => {
  it("fills area, flat type and budget from the one flat a direct lead opened", () => {
    const r = inferRequirement([sig("MZ-RPN52S", "opened_link")], inv);
    expect(r.localities).toEqual(["JP Nagar"]);
    expect(r.flat_types).toEqual(["2 BHK"]);
    expect(r.rentSeen).toEqual({ min: 27000, max: 27000 });
    expect(r.basis).toEqual([{ propertyId: "MZ-RPN52S", signal: "opened_link" }]);
  });

  it("pads the matching budget either side of what they looked at", () => {
    // Matching on exactly ₹27k would find nothing; a person who opened ₹27k
    // will look at ₹25k and ₹29k.
    const r = inferRequirement([sig("MZ-RPN52S", "opened_link")], inv);
    expect(r.budget_min).toBe(24000);
    expect(r.budget_max).toBe(30000);
  });

  it("returns null when there is nothing to read", () => {
    expect(inferRequirement([], inv)).toBeNull();
    // A flat no longer in inventory is skipped, not guessed at.
    expect(inferRequirement([sig("MZ-GONE", "booked")], inv)).toBeNull();
    // An unknown signal carries no weight.
    expect(inferRequirement([sig("MZ-HSR1", "disliked")], inv)).toBeNull();
  });

  it("ranks areas by the weight behind them, not by count", () => {
    const r = inferRequirement([
      sig("MZ-KORA", "booked"),
      sig("MZ-HSR1", "okay"),
      sig("MZ-HSR2", "okay"),
    ], inv);
    // Okays are weak evidence: with a booking present, only strong evidence is
    // read at all, so two okays in HSR cannot outvote one booked visit.
    expect(r.localities).toEqual(["Koramangala"]);
  });

  it("ignores flats we sent and they only opened when they chose something themselves", () => {
    const r = inferRequirement([
      sig("MZ-RPN52S", "opened_link"),
      sig("MZ-KORA", "opened_share"),
    ], inv);
    expect(r.localities).toEqual(["JP Nagar"]);
    // The ₹60k flat we chose must not drag their budget up.
    expect(r.rentSeen).toEqual({ min: 27000, max: 27000 });
  });

  it("still uses flats we sent when that is all there is", () => {
    const r = inferRequirement([sig("MZ-KORA", "opened_share")], inv);
    expect(r.localities).toEqual(["Koramangala"]);
  });

  it("counts a flat once, at its strongest signal", () => {
    // Liked and then booked is one flat, not two votes for its area.
    const r = inferRequirement([
      sig("MZ-HSR1", "liked"),
      sig("MZ-HSR1", "booked"),
      sig("MZ-RPN52S", "liked"),
      sig("MZ-RPN52S", "opened_link"),
    ], inv);
    expect(r.basis.map((b) => b.propertyId)).toHaveLength(2);
    expect(r.basis[0]).toEqual({ propertyId: "MZ-HSR1", signal: "booked" });
  });

  it("spans the rents across several flats", () => {
    const r = inferRequirement([sig("MZ-HSR1", "liked"), sig("MZ-HSR2", "liked")], inv);
    expect(r.rentSeen).toEqual({ min: 22000, max: 32000 });
    expect(r.localities).toEqual(["HSR"]);
    expect(r.flat_types).toEqual(expect.arrayContaining(["2 BHK", "1 BHK"]));
  });
});

describe("effectiveFacts", () => {
  const inferred = inferRequirement([sig("MZ-RPN52S", "opened_link")], inv);

  it("uses the guess only where nothing real exists", () => {
    const f = effectiveFacts({}, null, inferred);
    expect(f.localities).toEqual({ value: ["JP Nagar"], inferred: true });
    expect(f.flat_types.inferred).toBe(true);
    expect(f.budget).toEqual({ min: 27000, max: 27000, inferred: true });
  });

  it("lets a stated field win over the guess, field by field", () => {
    // They picked an area and quit before the budget: the area is theirs, the
    // budget still comes from what they opened.
    const f = effectiveFacts({ localities: ["HSR"] }, null, inferred);
    expect(f.localities).toEqual({ value: ["HSR"], inferred: false });
    expect(f.budget.inferred).toBe(true);
  });

  it("prefers the client's own wizard answers to the guess", () => {
    const f = effectiveFacts({}, { flat_types: ["1 BHK"], budget_max: 20000 }, inferred);
    expect(f.flat_types).toEqual({ value: ["1 BHK"], inferred: false });
    expect(f.budget).toEqual({ min: undefined, max: 20000, inferred: false });
  });

  it("prefers the agent's requirement to the client's own answers", () => {
    const f = effectiveFacts({ budget_max: 35000 }, { budget_max: 20000 }, inferred);
    expect(f.budget.max).toBe(35000);
  });

  it("says nothing when there is nothing", () => {
    const f = effectiveFacts(null, null, null);
    expect(f.localities).toEqual({ value: [], inferred: false });
    expect(f.budget).toEqual({ min: null, max: null, inferred: false });
  });
});

describe("requirementForMatching", () => {
  const inferred = inferRequirement([sig("MZ-RPN52S", "opened_link")], inv);

  it("matches on the guess only when nothing is stated", () => {
    const empty = { localities: [], flat_types: [], min_score: 55 };
    const r = requirementForMatching(empty, inferred);
    expect(r.localities).toEqual(["JP Nagar"]);
    // Settings on their record are kept.
    expect(r.min_score).toBe(55);
  });

  it("returns a stated requirement untouched", () => {
    const stated = { localities: ["HSR"] };
    expect(requirementForMatching(stated, inferred)).toBe(stated);
    expect(hasStatedRequirement(stated)).toBe(true);
  });

  it("returns the requirement untouched when there is no guess", () => {
    const empty = { localities: [] };
    expect(requirementForMatching(empty, null)).toBe(empty);
  });
});

describe("labels", () => {
  it("reads a rent seen as one figure or a range", () => {
    expect(rentSeenLabel({ min: 27000, max: 27000 })).toBe("₹27k");
    expect(rentSeenLabel({ min: 22000, max: 32000 })).toBe("₹22k–₹32k");
    expect(rentSeenLabel(null)).toBe("");
  });

  it("names the flat the guess rests on", () => {
    expect(basisLabel({ basis: [{ propertyId: "MZ-RPN52S" }] })).toBe("MZ-RPN52S");
    expect(basisLabel({ basis: [{ propertyId: "A" }, { propertyId: "B" }, { propertyId: "C" }] })).toBe("A +2");
    expect(basisLabel(null)).toBe("");
  });
});

describe("groupInterestByClient", () => {
  it("groups by client and drops malformed rows", () => {
    const m = groupInterestByClient([
      { client_id: "a", property_id: "X" },
      { client_id: "a", property_id: "Y" },
      { client_id: "b", property_id: "Z" },
      { client_id: null, property_id: "Q" },
      { client_id: "c", property_id: "" },
    ]);
    expect(m.get("a")).toHaveLength(2);
    expect(m.get("b")).toHaveLength(1);
    expect(m.has("c")).toBe(false);
  });
});
