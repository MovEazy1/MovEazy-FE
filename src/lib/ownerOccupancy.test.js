import { describe, expect, it } from "vitest";
import { daysToLeaseEnd, financialYear, occupancyPct, tenancyLength } from "./ownerOccupancy";
import { cleanLinkedIn, occupancyOf, requestBucket } from "./owners";

const now = new Date(2026, 8, 28); // 28 Sep 2026 — 181 days into FY 2026-27

describe("financialYear", () => {
  it("runs April to March", () => {
    expect(financialYear(now).label).toBe("FY 2026-27");
    expect(financialYear(new Date(2026, 1, 10)).label).toBe("FY 2025-26");
    expect(financialYear(new Date(2026, 3, 1)).start.getMonth()).toBe(3);
  });
});

describe("occupancyPct", () => {
  it("is 100 for a tenant who was there all year", () => {
    expect(occupancyPct([{ move_in_date: "2025-01-15", status: "active" }], now)).toBe(100);
  });

  it("counts overlapping flatmates once", () => {
    const t = [
      { move_in_date: "2026-04-01", status: "active" },
      { move_in_date: "2026-05-01", status: "active" },
    ];
    expect(occupancyPct(t, now)).toBe(100);
  });

  it("counts a gap between tenants against it", () => {
    // Out on 30 Jun, the next one in on 1 Aug: July (31 days) empty out of 181.
    const t = [
      { move_in_date: "2025-06-01", moved_out_on: "2026-06-30", status: "past" },
      { move_in_date: "2026-08-01", status: "active" },
    ];
    expect(occupancyPct(t, now)).toBe(Math.round(((181 - 31) / 181) * 100));
  });

  it("says nothing rather than guess when no move-in date is known", () => {
    expect(occupancyPct([{ status: "active" }], now)).toBeNull();
    expect(occupancyPct([], now)).toBeNull();
  });

  it("ignores removed rows", () => {
    expect(occupancyPct([{ move_in_date: "2025-01-01", status: "removed" }], now)).toBeNull();
  });
});

describe("tenancy helpers", () => {
  it("reads tenancy length the way people say it", () => {
    expect(tenancyLength({ move_in_date: "2025-11-01" }, now)).toBe("11 months");
    expect(tenancyLength({ move_in_date: "2024-08-01" }, now)).toBe("2 years 2 months");
    expect(tenancyLength({ move_in_date: "2026-09-20" }, now)).toBe("8 days");
    expect(tenancyLength({}, now)).toBe("");
  });

  it("counts days to the lease end", () => {
    expect(daysToLeaseEnd({ lease_end_date: "2026-10-28" }, now)).toBe(30);
    expect(daysToLeaseEnd({}, now)).toBeNull();
  });
});

describe("owners helpers", () => {
  it("accepts only real LinkedIn profile links", () => {
    expect(cleanLinkedIn("linkedin.com/in/rahul")).toBe("https://www.linkedin.com/in/rahul");
    expect(cleanLinkedIn("https://in.linkedin.com/in/rahul-m/")).toBe("https://www.linkedin.com/in/rahul-m");
    expect(cleanLinkedIn("https://evil.com/in/rahul")).toBe("");
    expect(cleanLinkedIn("https://linkedin.com/company/google")).toBe("");
  });

  it("reads occupied / listed / vacant", () => {
    expect(occupancyOf({ property_id: "A", status: "rented" }, [])).toBe("occupied");
    expect(occupancyOf({ property_id: "A", status: "published" }, [{ property_id: "A", status: "active" }])).toBe("occupied");
    expect(occupancyOf({ property_id: "A", status: "published" }, [])).toBe("listed");
    expect(occupancyOf({ property_id: "A", status: "paused" }, [{ property_id: "A", status: "past" }])).toBe("vacant");
  });

  it("files request statuses under the four tabs", () => {
    expect(requestBucket("awaiting_approval")).toBe("open");
    expect(requestBucket("scheduled")).toBe("in_progress");
    expect(requestBucket("resolved")).toBe("resolved");
  });
});
