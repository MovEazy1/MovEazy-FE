import { describe, expect, it } from "vitest";
import { NO_DATE, bySoldOutDesc, monthLabel, soldOutMonth, soldOutMonths, todayInIndia } from "./soldOut";

const sold = (at) => ({ status: "rented", sold_out_at: at });

describe("soldOutMonth", () => {
  it("is the month in India", () => {
    expect(soldOutMonth(sold("2026-10-05T10:00:00Z"))).toBe("2026-10");
    // 31 Oct, 8 PM UTC is already 1 Nov in India.
    expect(soldOutMonth(sold("2026-10-31T20:00:00Z"))).toBe("2026-11");
  });
  it("undated if sold out before dates were kept; nothing if not sold out", () => {
    expect(soldOutMonth(sold(null))).toBe(NO_DATE);
    expect(soldOutMonth({ status: "published", sold_out_at: "2026-10-05T10:00:00Z" })).toBe("");
  });
});

describe("soldOutMonths", () => {
  it("counts each month, newest first, undated last", () => {
    const list = [sold("2026-09-02T10:00:00Z"), sold(null), sold("2026-10-01T10:00:00Z"), sold("2026-10-04T10:00:00Z"),
      { status: "published" }];
    expect(soldOutMonths(list)).toEqual([
      { key: "2026-10", count: 2, label: monthLabel("2026-10") },
      { key: "2026-09", count: 1, label: monthLabel("2026-09") },
      { key: NO_DATE, count: 1, label: "Date not recorded" },
    ]);
    expect(monthLabel("2026-10")).toMatch(/Oct.*2026/);
  });
});

describe("bySoldOutDesc", () => {
  it("newest sale first, undated at the end", () => {
    const list = [sold(null), sold("2026-09-02T10:00:00Z"), sold("2026-10-01T10:00:00Z")];
    expect(list.sort(bySoldOutDesc).map((l) => l.sold_out_at)).toEqual(["2026-10-01T10:00:00Z", "2026-09-02T10:00:00Z", null]);
  });
});

describe("todayInIndia", () => {
  it("rolls over at midnight India time", () => {
    expect(todayInIndia(new Date("2026-10-04T19:00:00Z"))).toBe("2026-10-05");
    expect(todayInIndia(new Date("2026-10-04T18:00:00Z"))).toBe("2026-10-04");
  });
});
