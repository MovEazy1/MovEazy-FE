/**
 * Turning "every day, 8am to 8pm" into bookable times.
 *
 * property_visit_slots has no end column, so a window is only ever stored as
 * the individual hourly starts inside it. The arithmetic that does that used to
 * live in a component, where the upload form could not reach it and nothing
 * could test it — which is how flats were published with nothing bookable at
 * all. These are the cases that would break it quietly.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIT_RULE, buildTimes, datesForMode, localYMD, slotTimestamps, toMin,
} from "./visitSchedule";

describe("buildTimes", () => {
  it("gives one start an hour, and never one that runs past the end", () => {
    // 8am–8pm is 12 hours, so 12 starts: the last is 19:00, finishing at 20:00.
    const times = buildTimes("08:00", "20:00");
    expect(times).toHaveLength(12);
    expect(times[0]).toBe("08:00");
    expect(times[11]).toBe("19:00");
  });

  it("drops a trailing part-hour rather than offering a slot that overruns", () => {
    expect(buildTimes("08:00", "09:30")).toEqual(["08:00"]);
  });

  it("refuses a blank time instead of reading it as midnight", () => {
    // Number("") is 0. Were that allowed through, an empty <input type="time">
    // would generate a full day of slots starting at 00:00.
    expect(buildTimes("", "20:00")).toEqual([]);
    expect(toMin("")).toBeNaN();
  });

  it("refuses an end at or before the start", () => {
    expect(buildTimes("20:00", "08:00")).toEqual([]);
    expect(buildTimes("08:00", "08:00")).toEqual([]);
  });

  it("refuses times that are not times", () => {
    expect(toMin("25:00")).toBeNaN();
    expect(toMin("08:75")).toBeNaN();
    expect(buildTimes("8am", "8pm")).toEqual([]);
  });
});

describe("datesForMode", () => {
  // A Wednesday, so a week from it covers both weekend days.
  const wed = new Date("2026-09-23T10:00:00");

  it("covers the rolling week for everyday", () => {
    expect(datesForMode("everyday", wed)).toHaveLength(7);
  });

  it("splits the week into weekdays and weekends with nothing lost", () => {
    const weekdays = datesForMode("weekday", wed);
    const weekend = datesForMode("weekend", wed);
    expect(weekdays).toHaveLength(5);
    expect(weekend).toHaveLength(2);
    expect([...weekdays, ...weekend].sort()).toEqual(datesForMode("everyday", wed).sort());
  });

  it("starts today, not tomorrow", () => {
    expect(datesForMode("everyday", wed)[0]).toBe(localYMD(wed));
  });

  it("gives nothing for a mode it does not know", () => {
    expect(datesForMode("custom", wed)).toEqual([]);
    expect(datesForMode("", wed)).toEqual([]);
  });
});

describe("localYMD", () => {
  it("files a late-evening IST time under today, not yesterday", () => {
    // toISOString() would convert through UTC and shift this back a day for
    // any zone ahead of UTC, filing every evening's slots under the day before.
    const d = new Date(2026, 8, 23, 23, 30); // 23 Sep, local
    expect(localYMD(d)).toBe("2026-09-23");
  });
});

describe("slotTimestamps", () => {
  const wed = new Date("2026-09-23T10:00:00");

  it("expands the default rule to a week of hourly slots", () => {
    expect(slotTimestamps(DEFAULT_VISIT_RULE, { now: wed })).toHaveLength(7 * 12);
  });

  it("skips days already covered, so topping up a window adds only the gap", () => {
    const have = datesForMode("everyday", wed).slice(0, 5);
    expect(slotTimestamps(DEFAULT_VISIT_RULE, { now: wed, skipDates: have })).toHaveLength(2 * 12);
  });

  it("adds nothing when the whole window is already there", () => {
    const have = datesForMode("everyday", wed);
    expect(slotTimestamps(DEFAULT_VISIT_RULE, { now: wed, skipDates: have })).toEqual([]);
  });

  it("uses the dates given for a custom rule and ignores the window", () => {
    const out = slotTimestamps(
      { mode: "custom", fromT: "10:00", toT: "12:00", dates: ["2026-10-05"] },
      { now: wed },
    );
    expect(out).toHaveLength(2);
  });

  it("gives nothing for a rule with no times, rather than a day of midnights", () => {
    expect(slotTimestamps({ mode: "everyday", fromT: "", toT: "" }, { now: wed })).toEqual([]);
    expect(slotTimestamps(null)).toEqual([]);
  });

  it("produces timestamps that read back as the local hours asked for", () => {
    const [first] = slotTimestamps(
      { mode: "custom", fromT: "08:00", toT: "09:00", dates: ["2026-10-05"] },
      { now: wed },
    );
    expect(new Date(first).getHours()).toBe(8);
  });
});

describe("the default", () => {
  it("is every day, 8am to 8pm", () => {
    // The published default. A listing arriving with nothing bookable leaves a
    // tenant only "next available slot", which is a message to answer by hand.
    expect(DEFAULT_VISIT_RULE).toEqual({ mode: "everyday", fromT: "08:00", toT: "20:00" });
    expect(buildTimes(DEFAULT_VISIT_RULE.fromT, DEFAULT_VISIT_RULE.toT)).toHaveLength(12);
  });
});
