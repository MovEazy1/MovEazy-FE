/**
 * The commute estimate has to be honest in two directions: never a number it
 * can't stand behind, and never optimistic enough that somebody plans around
 * it and arrives late.
 */
import { describe, expect, it } from "vitest";
import { commuteMinutes, coordsOf, formatCommute, withinCommute } from "./commute";

// Real Bengaluru points, so the numbers can be sanity-checked against the city.
const HSR = { lat: 12.9121, lng: 77.6446 };
const KORAMANGALA = { lat: 12.9352, lng: 77.6245 };
const WHITEFIELD = { lat: 12.9698, lng: 77.7500 };
const ELECTRONIC_CITY = { lat: 12.8452, lng: 77.6602 };

describe("estimating a commute", () => {
  it("puts neighbouring areas in the range somebody would recognise", () => {
    // HSR to Koramangala is a short hop everyone in the city has done.
    const mins = commuteMinutes(HSR, KORAMANGALA);
    expect(mins).toBeGreaterThan(8);
    expect(mins).toBeLessThan(25);
  });

  it("scales with distance across the city", () => {
    expect(commuteMinutes(HSR, WHITEFIELD)).toBeGreaterThan(commuteMinutes(HSR, KORAMANGALA));
    expect(commuteMinutes(HSR, WHITEFIELD)).toBeLessThan(90);
  });

  it("is symmetric — the flat to the office is the office to the flat", () => {
    expect(commuteMinutes(HSR, ELECTRONIC_CITY)).toBe(commuteMinutes(ELECTRONIC_CITY, HSR));
  });

  it("never claims a commute is under five minutes", () => {
    // Same building. There is still the walk down and the helmet.
    expect(commuteMinutes(HSR, HSR)).toBe(5);
  });

  it("says nothing rather than guessing when an end has no coordinates", () => {
    expect(commuteMinutes(HSR, null)).toBeNull();
    expect(commuteMinutes(HSR, {})).toBeNull();
    expect(commuteMinutes({ lat: null, lng: null }, HSR)).toBeNull();
    // 0,0 is the Atlantic: an unfilled column, not a location.
    expect(commuteMinutes(HSR, { lat: 0, lng: 0 })).toBeNull();
  });

  it("gives up beyond the city rather than printing an absurd number", () => {
    expect(commuteMinutes(HSR, { lat: 19.076, lng: 72.877 })).toBeNull(); // Mumbai
  });
});

describe("reading coordinates off whatever shape they arrive in", () => {
  it("accepts a listing's latitude/longitude and an office's lat/lng", () => {
    expect(coordsOf({ latitude: 12.91, longitude: 77.64 })).toEqual({ lat: 12.91, lng: 77.64 });
    expect(coordsOf({ lat: 12.91, lng: 77.64 })).toEqual({ lat: 12.91, lng: 77.64 });
  });

  it("rejects anything that isn't a pair of numbers", () => {
    for (const bad of [null, undefined, {}, "12.91,77.64", { lat: "abc", lng: 77 }]) {
      expect(coordsOf(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("showing it", () => {
  it("reads as minutes, then as hours", () => {
    expect(formatCommute(22)).toBe("22 min");
    expect(formatCommute(60)).toBe("1 hr");
    expect(formatCommute(95)).toBe("1 hr 35 min");
  });

  it("renders nothing when there is no estimate", () => {
    expect(formatCommute(null)).toBe("");
  });
});

describe("against the tolerance they gave us", () => {
  it("allows a little over when they said they were flexible", () => {
    // The whole point of that checkbox: don't bin a great flat by six minutes.
    expect(withinCommute(36, 30, true)).toBe(true);
    expect(withinCommute(36, 30, false)).toBe(false);
  });

  it("still refuses something far past the line", () => {
    expect(withinCommute(60, 30, true)).toBe(false);
  });

  it("assumes nothing when there is no estimate or no tolerance", () => {
    expect(withinCommute(null, 30)).toBe(true);
    expect(withinCommute(40, null)).toBe(true);
  });
});
