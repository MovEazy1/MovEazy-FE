import { describe, expect, it } from "vitest";
import { dueToday, flatDetailScore, inDaysLabel, movingSoon, myFlats, newActions, reminderPresets, stageCounts, whenLabel } from "./partnerTenants";

// 2026-10-12 09:00 IST
const NOW = new Date("2026-10-12T03:30:00Z");

describe("stageCounts", () => {
  it("each stage, open ones and all", () => {
    const c = stageCounts([{ stage: "new" }, { stage: "liked" }, { stage: "liked" }, { stage: "done" }, { stage: "lost" }]);
    expect(c).toMatchObject({ new: 1, liked: 2, done: 1, lost: 1, open: 3, all: 5 });
  });
});

describe("reminderPresets", () => {
  const p = Object.fromEntries(reminderPresets(NOW).map((x) => [x.id, x.at.toISOString()]));
  it("later today is 3 hours on in the morning", () => expect(p.later).toBe("2026-10-12T06:30:00.000Z"));
  it("tomorrow 10 am IST", () => expect(p.tomorrow).toBe("2026-10-13T04:30:00.000Z"));
  it("in 3 days and next week, 10 am", () => {
    expect(p["3d"]).toBe("2026-10-15T04:30:00.000Z");
    expect(p.week).toBe("2026-10-19T04:30:00.000Z");
  });
  it("in the evening, later today is 7 pm if sooner than 3 hours", () => {
    const evening = new Date("2026-10-12T12:30:00Z"); // 6 pm IST
    expect(reminderPresets(evening)[0].at.toISOString()).toBe("2026-10-12T13:30:00.000Z");
  });
});

describe("whenLabel", () => {
  it("today and tomorrow by name", () => {
    expect(whenLabel("2026-10-12T11:30:00Z", NOW)).toBe("Today, 5:00 pm");
    expect(whenLabel("2026-10-13T04:30:00Z", NOW)).toBe("Tomorrow, 10:00 am");
  });
  it("otherwise the date", () => expect(whenLabel("2026-10-20T04:30:00Z", NOW)).toMatch(/20 Oct, 10:00 am$/));
});

describe("Home lists", () => {
  it("due today: overdue and later today, not tomorrow", () => {
    const r = dueToday([{ id: "t", due_at: "2026-10-13T04:30:00Z" }, { id: "late", due_at: "2026-10-11T04:30:00Z" }, { id: "eve", due_at: "2026-10-12T13:30:00Z" }], NOW);
    expect(r.map((x) => x.id)).toEqual(["late", "eve"]);
  });
  it("new actions: open tenants with something new, newest first", () => {
    const r = newActions([
      { key: "a", stage: "liked", new_actions: 2, last_action_at: "2026-10-11" },
      { key: "b", stage: "list_sent", new_actions: 1, last_action_at: "2026-10-12" },
      { key: "c", stage: "done", new_actions: 3 },
      { key: "d", stage: "liked", new_actions: 0 },
    ]);
    expect(r.map((t) => t.key)).toEqual(["b", "a"]);
  });
  it("moving soon: within 15 days, still open, soonest first", () => {
    const r = movingSoon([
      { key: "a", stage: "liked", move_in: "2026-10-20" },
      { key: "b", stage: "new", move_in: "2026-10-14" },
      { key: "c", stage: "done", move_in: "2026-10-14" },
      { key: "d", stage: "new", move_in: "2026-12-01" },
      { key: "e", stage: "visit", move_in: "2026-10-10" },
    ], 15, NOW);
    expect(r.map((t) => [t.key, t.in_days])).toEqual([["e", -2], ["b", 2], ["a", 8]]);
    expect(inDaysLabel(2)).toBe("in 2 days");
    expect(inDaysLabel(-2)).toBe("2 days ago");
  });
});

describe("flats", () => {
  it("detail score and what's missing", () => {
    const s = flatDetailScore({ rent: 30000, flat_type: "2 BHK", area: "HSR", images: ["a", "b"], cover_image_url: "c", furnishing: "Semi" });
    expect(s.done).toBe(5);
    expect(s.missing).toEqual(["Available from", "Deposit", "Description", "Amenities"]);
  });
  it("my flats by state", () => {
    const f = myFlats([{ source: "mine", status: "published" }, { source: "mine", status: "rented" }, { source: "mine", status: "paused" }, { source: "moveazy", status: "published" }]);
    expect([f.live.length, f.paused.length, f.letOut.length]).toEqual([1, 1, 1]);
  });
});
