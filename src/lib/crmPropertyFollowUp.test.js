/**
 * The stale-listing queue.
 *
 * The rule that matters is that answering takes a flat out of the list. If a
 * confirmation did not record a timestamp, "still available" would leave the
 * row exactly where it was and the queue would never empty — which is how a
 * daily list becomes one nobody opens.
 */
import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_OUTCOMES, ageInDays, availabilityMessage, checkedLabel,
} from "./crmPropertyFollowUp";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

describe("what an owner can tell us", () => {
  it("keeps the flat on the site only when they say it is available", () => {
    const available = FOLLOW_UP_OUTCOMES.find((o) => o.id === "available");
    expect(available.status).toBeNull();
  });

  it("takes it off the site when it is gone, and says which kind of gone", () => {
    // A let flat is a number worth having; an unreachable owner is a
    // different problem with a different fix.
    expect(FOLLOW_UP_OUTCOMES.find((o) => o.id === "rented").status).toBe("rented");
    expect(FOLLOW_UP_OUTCOMES.find((o) => o.id === "dormant").status).toBe("dormant");
  });

  it("gives every outcome a note, so a row never records a blank answer", () => {
    for (const o of FOLLOW_UP_OUTCOMES) expect(o.note, o.id).toBeTruthy();
  });
});

describe("why a row is in the list", () => {
  it("counts how long a flat has been up", () => {
    expect(ageInDays(daysAgo(12), NOW)).toBe(12);
    expect(ageInDays(daysAgo(0), NOW)).toBe(0);
  });

  it("returns nothing rather than 1970 for a missing date", () => {
    // new Date(null) is the epoch, so without the guard this reads as 20,000
    // days and every row claims to be from the seventies.
    expect(ageInDays(null, NOW)).toBeNull();
    expect(ageInDays("", NOW)).toBeNull();
  });

  it("says plainly that nobody has asked yet", () => {
    expect(checkedLabel(null, NOW)).toBe("Never asked");
  });

  it("says how long since the last answer", () => {
    expect(checkedLabel(daysAgo(0), NOW)).toBe("Checked today");
    expect(checkedLabel(daysAgo(1), NOW)).toBe("Checked 1 day ago");
    expect(checkedLabel(daysAgo(12), NOW)).toBe("Checked 12 days ago");
  });
});

describe("asking the owner", () => {
  it("names them and their flat", () => {
    const m = availabilityMessage({
      posterName: "Ravi Kumar", propertyId: "MZ-AAA111",
      title: "2 BHK in HSR", area: "HSR",
    });
    expect(m).toContain("Hi Ravi");
    expect(m).toContain("MZ-AAA111");
    expect(m).toContain("still available");
  });

  it("falls back to the id when the listing has no title", () => {
    expect(availabilityMessage({ propertyId: "MZ-BBB222" })).toContain("MZ-BBB222");
  });

  it("stays grammatical with no owner name", () => {
    expect(availabilityMessage({ propertyId: "MZ-BBB222" })).toContain("Hi, this is MovEazy.");
  });
});
