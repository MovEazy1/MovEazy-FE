import { describe, expect, it } from "vitest";
import { isFlatComplete, justAwarded, liveOnWebsite, nextStep } from "./partnerPool";

const base = { rent: 25000, flat_type: "2 BHK", area: "HSR Layout", cover_image_url: "a.jpg", images: ["b.jpg", "c.jpg"], status: "published" };

describe("isFlatComplete", () => {
  it("needs 6 of 9 with rent, BHK, area and a photo", () => {
    expect(isFlatComplete({ ...base, furnishing: "Semi", deposit: 50000 })).toBe(true); // photos3 rent bhk area furnishing deposit
    expect(isFlatComplete(base)).toBe(false); // 4 of 9
    expect(isFlatComplete({ ...base, cover_image_url: "", images: [], furnishing: "Semi", deposit: 1, available_from: "2026-11-01", amenities: ["Lift"] })).toBe(false); // no photo
    expect(isFlatComplete({ ...base, area: "", furnishing: "Semi", deposit: 1, available_from: "2026-11-01" })).toBe(false); // no area
  });
});

describe("liveOnWebsite", () => {
  it("live and with a photo", () => {
    expect(liveOnWebsite(base)).toBe(true);
    expect(liveOnWebsite({ ...base, cover_image_url: "", images: [] })).toBe(false);
    expect(liveOnWebsite({ ...base, status: "paused" })).toBe(false);
  });
});

describe("nextStep", () => {
  it("shows only the next milestone", () => {
    expect(nextStep({ complete: 1, plan_ok: true })).toMatchObject({ max: 3, value: 1, reward: true, title: "2 more complete flats → 10 fresh leads" });
    expect(nextStep({ complete: 5, plan_ok: true })).toMatchObject({ max: 10, value: 5, reward: false });
    expect(nextStep({ complete: 12, plan_ok: false }).body).toMatch(/Premium/);
    expect(nextStep({ complete: 12, plan_ok: true }).title).toBe("8 more to 20 → 20 fresh leads");
  });
  it("then the daily streak", () => {
    expect(nextStep({ complete: 21, today: 0, streak: { days: 4, today_done: false } })).toMatchObject({
      title: "No inventory uploaded today", body: "Upload 5 more to keep your 4-day streak.", max: 5, value: 0 });
    expect(nextStep({ complete: 21, today: 2, streak: { days: 0, today_done: false } }).body).toBe("Upload 5 today to start a streak.");
    expect(nextStep({ complete: 25, today: 5, streak: { days: 6, today_done: true } }).title).toBe("6-day streak 🔥");
  });
});

describe("justAwarded", () => {
  it("rewards in the last 10 minutes", () => {
    const now = Date.parse("2026-10-14T10:00:00Z");
    const p = { milestones: [{ milestone: 3, given: 10, awarded_at: "2026-10-14T09:55:00Z" }, { milestone: 10, given: 0, awarded_at: null },
      { milestone: 20, given: 20, awarded_at: "2026-10-13T09:55:00Z" }] };
    expect(justAwarded(p, now).map((m) => m.milestone)).toEqual([3]);
  });
});
