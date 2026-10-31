import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
const { adPageUrl, adSlots, adSourceLabel, calendarLink, dayLabel, readAdUtm, slotLabel, slotsByDay } = await import("./visitAds");
const { defaultVisitSlots } = await import("./visits");

// Sun 1 Nov 2026, 8:30 am in India.
const NOW = new Date("2026-11-01T08:30:00+05:30").getTime();
const ist = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false, day: "numeric" });

describe("default visit slots", () => {
  it("every day 10 am – 6 pm on the hour, for 7 days, never within the hour", () => {
    const s = defaultVisitSlots({ days: 7, now: NOW });
    expect(s).toHaveLength(56);
    expect(s[0].slot_at).toBe(new Date("2026-11-01T10:00:00+05:30").toISOString());
    expect(s.at(-1).slot_at).toBe(new Date("2026-11-07T17:00:00+05:30").toISOString());
    expect(s.every((x) => x.default && x.capacity == null)).toBe(true);
  });
  it("never within the next hour", () => {
    const s = defaultVisitSlots({ days: 1, now: new Date("2026-11-01T09:30:00+05:30").getTime() });
    expect(s[0].slot_at).toBe(new Date("2026-11-01T11:00:00+05:30").toISOString());
  });
  it("late in the day, today's are gone", () => {
    const late = new Date("2026-11-01T16:30:00+05:30").getTime();
    const s = defaultVisitSlots({ days: 1, now: late });
    expect(s).toEqual([]);
    expect(defaultVisitSlots({ days: 2, now: late })[0].slot_at).toBe(new Date("2026-11-02T10:00:00+05:30").toISOString());
    expect(defaultVisitSlots({ days: 1, now: new Date("2026-11-01T15:59:00+05:30").getTime() }).map((x) => ist(x.slot_at))).toEqual(["1, 17"]);
  });
});

describe("ad page slots", () => {
  it("the team's slots when there are some, else the default", () => {
    const team = ["2026-11-03T06:30:00Z", "2026-10-30T06:30:00Z"];
    expect(adSlots({ slots: team }, NOW)).toEqual(["2026-11-03T06:30:00.000Z"]);
    expect(adSlots({ slots: [] }, NOW)).toHaveLength(56);
  });
  it("groups by India day and words them", () => {
    const days = slotsByDay(adSlots({ slots: [] }, NOW));
    expect(days).toHaveLength(7);
    expect(days[0].day).toBe("2026-11-01");
    expect(dayLabel("2026-11-01", NOW)).toBe("Today");
    expect(dayLabel("2026-11-02", NOW)).toBe("Tomorrow");
    expect(dayLabel("2026-11-04", NOW)).toMatch(/Wed.*4.*Nov/);
    expect(slotLabel(days[0].slots[1])).toBe("11 AM – 12 PM");
  });
});

describe("links and UTM", () => {
  it("the page and the Meta link", () => {
    expect(adPageUrl("flat", "MZ-AB12CD")).toBe("https://www.moveazy.co.in/visit/MZ-AB12CD");
    expect(adPageUrl("building", "H33PSH", { meta: true }))
      .toBe("https://www.moveazy.co.in/visit/b/H33PSH?utm_source=facebook&utm_medium=paid_social&utm_campaign=H33PSH");
  });
  it("keeps the UTM keys only", () => {
    expect(readAdUtm("?utm_source=facebook&utm_campaign=MZ-1&utm_content=reel-2&x=1&fbclid=abc"))
      .toEqual({ utm_source: "facebook", utm_campaign: "MZ-1", utm_content: "reel-2", fbclid: "abc" });
  });
  it("words where a visit came from", () => {
    expect(adSourceLabel({ utm_source: "facebook", utm_campaign: "MZ-1", utm_content: "reel-2" })).toBe("Meta ad · MZ-1 · reel-2");
    expect(adSourceLabel({})).toBe("Ad page");
  });
  it("a Google Calendar link for the hour", () => {
    const u = new URL(calendarLink({ title: "2 BHK", slotAt: "2026-11-02T05:30:00.000Z", where: "HSR Layout" }));
    expect(u.searchParams.get("dates")).toBe("20261102T053000Z/20261102T063000Z");
    expect(u.searchParams.get("text")).toBe("Flat visit · 2 BHK");
  });
});
