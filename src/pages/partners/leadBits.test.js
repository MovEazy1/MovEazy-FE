import { describe, expect, it } from "vitest";
import { factLines, householdLabel, moveInFact } from "./leadBits";

const NOW = new Date("2026-11-18T12:00:00+05:30");

describe("lead facts on the Leads list", () => {
  it("who is moving in, from either source", () => {
    expect(householdLabel({ household: "family" })).toBe("Family");
    expect(householdLabel({ household: "bachelor" })).toBe("Bachelor");
    expect(householdLabel({ household: "With Roommates" })).toBe("With Roommates");
    expect(householdLabel({})).toBe("");
  });

  it("an exact move-in date; one already gone is marked while the tenant is in play", () => {
    expect(moveInFact({ move_in: "2026-12-05", stage: "new" }, NOW)).toEqual({ text: "Move-in 5 Dec", passed: false });
    expect(moveInFact({ move_in: "2026-11-03", stage: "contacted" }, NOW)).toEqual({ text: "Move-in 3 Nov (passed)", passed: true });
    expect(moveInFact({ move_in: "2026-11-03", stage: "done" }, NOW)).toEqual({ text: "Move-in 3 Nov", passed: false });
    expect(moveInFact({ move_in: "2026-11-18", stage: "new" }, NOW).passed).toBe(false);
    expect(moveInFact({ move_in: "2027-01-10", stage: "new" }, NOW).text).toBe("Move-in 10 Jan 2027");
  });

  it("flexible says so; nothing known says nothing", () => {
    expect(moveInFact({ move_in_flexible: true }, NOW)?.text).toBe("Move-in flexible");
    expect(moveInFact({ move_in_raw: "Immediate move-in" }, NOW)?.text).toBe("Immediate move-in");
    expect(moveInFact({}, NOW)).toBeNull();
  });

  it("two lines: who · type · budget, then areas · move-in", () => {
    const f = factLines({ household: "Family", flat_types: ["2 BHK"], budget_min: 25000, budget_max: 35000,
      localities: ["HSR", "Koramangala", "BTM"], move_in: "2026-12-05", stage: "new" }, NOW);
    expect(f.one).toMatch(/^Family · 2 BHK · .*25.*35/);
    expect(f.two).toBe("HSR, Koramangala +1 · Move-in 5 Dec");
    expect(factLines({}, NOW)).toMatchObject({ one: "", two: "" });
  });
});
