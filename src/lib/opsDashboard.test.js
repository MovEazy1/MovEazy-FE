/**
 * The arithmetic behind /dashboard.
 *
 * Two things here are easy to get wrong and impossible to notice by looking:
 * an inclusive range that quietly drops a day, and summing a level metric.
 * "Active leads: 640" on a 30-day view — the same twenty leads counted thirty
 * times — reads as a triumph rather than as a bug, so the flow/level split is
 * pinned here rather than eyeballed on the page.
 */
import { describe, expect, it } from "vitest";
import {
  METRICS, addDays, dayDeltas, daysBetween, istToday, rangeFor, summarize, toCsv,
} from "./opsDashboard";

const flow = METRICS.find((m) => m.key === "new_leads");
const level = METRICS.find((m) => m.key === "active_leads");

/** Rows as the RPC returns them: newest first. */
const days = (...values) =>
  values.map((v, i) => ({
    day: addDays("2026-09-17", -i),
    new_leads: v,
    active_leads: v,
  }));

describe("the timeframe", () => {
  it("counts both ends of the range", () => {
    expect(daysBetween("2026-09-11", "2026-09-17")).toBe(7);
    expect(daysBetween("2026-09-17", "2026-09-17")).toBe(1);
  });

  it("resolves a preset to a range of exactly that many days", () => {
    const r = rangeFor(30, "2026-09-17");
    expect(r).toEqual({ from: "2026-08-19", to: "2026-09-17" });
    expect(daysBetween(r.from, r.to)).toBe(30);
  });

  it("crosses a month boundary without losing a day", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2026-02-26", "2026-03-02")).toBe(5);
  });

  it("reads today in IST, not in whatever zone the browser is in", () => {
    expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("reading one metric out of the rows", () => {
  it("totals a flow and takes the latest value of a level", () => {
    const rows = days(5, 3, 2); // today 5, yesterday 3, the day before 2
    expect(summarize(flow, rows).headline).toBe(10);
    expect(summarize(level, rows).headline).toBe(5);
  });

  it("compares a flow against the stretch before it", () => {
    const rows = days(5, 5); // 10
    const previous = days(4, 4); // 8
    expect(summarize(flow, rows, previous).change).toBeCloseTo(25);
  });

  it("compares a level against where it stood, not against a sum", () => {
    const rows = days(12, 11);
    const previous = days(10, 9);
    // 12 vs 10, not 23 vs 19.
    expect(summarize(level, rows, previous).change).toBeCloseTo(20);
  });

  it("refuses to express growth from nothing as a percentage", () => {
    expect(summarize(flow, days(7), days(0)).change).toBeNull();
    expect(summarize(flow, days(7)).change).toBeNull();
  });

  it("survives an empty range", () => {
    const s = summarize(flow, []);
    expect(s).toMatchObject({ headline: 0, peak: 0, average: 0, change: null });
  });
});

describe("day-on-day movement", () => {
  it("measures each day against the one below it in the table", () => {
    const series = dayDeltas(flow, days(5, 3, 3));
    expect(series.map((s) => s.delta)).toEqual([2, 0, null]);
  });

  it("leaves the oldest day without a comparison rather than inventing a zero", () => {
    expect(dayDeltas(flow, days(4)).at(-1).delta).toBeNull();
  });
});

describe("the export", () => {
  it("writes one column per metric, in the order the page shows them", () => {
    const [header] = toCsv(days(1)).split("\n");
    expect(header).toBe(`"Date",${METRICS.map((m) => `"${m.label}"`).join(",")}`);
  });

  it("fills a metric the rows don't carry with 0 rather than blank", () => {
    const [, row] = toCsv([{ day: "2026-09-17" }]).split("\n");
    expect(row).toBe(`"2026-09-17",${METRICS.map(() => '"0"').join(",")}`);
  });
});
