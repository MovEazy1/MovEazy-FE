/**
 * The priority stack is the one answer we ask people to think hardest about,
 * and the only one whose value is entirely in its order.
 *
 * Renaming the options put that at risk: a ranking saved under the old wording
 * is a list of strings that no longer exist, and the obvious handling — drop
 * what you don't recognise — would have quietly reset everyone who had already
 * answered back to the default order.
 */
import { describe, expect, it } from "vitest";
import { PRIORITIES, reconcilePriority } from "./preferenceOptions";

/** The default order as it shipped before the rename, verbatim. */
const OLD = [
  "Near to Office", "Good locality", "Budget fit", "I want a flat quickly",
  "Apartment over standalone", "Flat size", "Ventilation",
];

describe("bringing a saved ranking up to date", () => {
  it("keeps the order someone chose, under the new names", () => {
    const out = reconcilePriority(["Budget fit", "Flat size", "Near to Office"]);
    expect(out.slice(0, 3)).toEqual([
      "Budget Deals", "Size of Flat", "Walking Distance to Office",
    ]);
  });

  it("appends what is new rather than slotting it into its default rank", () => {
    // Their order is theirs. A freshly added option has no claim to a position
    // they never gave it.
    const out = reconcilePriority(OLD);
    expect(out[0]).toBe("Walking Distance to Office");
    expect(out.at(-1)).toBe("Minimum Hassle should be there");
  });

  it("returns every option exactly once, whatever went in", () => {
    for (const input of [OLD, [], null, ["Budget fit", "Budget Deals"], ["nonsense"]]) {
      const out = reconcilePriority(input);
      expect(new Set(out).size, JSON.stringify(input)).toBe(PRIORITIES.length);
      expect([...out].sort()).toEqual([...PRIORITIES].sort());
    }
  });

  it("drops an option we no longer offer", () => {
    expect(reconcilePriority(["Retired option", "Budget fit"])).not.toContain("Retired option");
  });

  it("leaves a current ranking untouched", () => {
    const mine = [...PRIORITIES].reverse();
    expect(reconcilePriority(mine)).toEqual(mine);
  });

  it("starts everyone new on the stated order", () => {
    expect(PRIORITIES[0]).toBe("Minimum Hassle should be there");
    expect(PRIORITIES).toHaveLength(8);
  });
});
