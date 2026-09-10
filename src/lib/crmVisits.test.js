/**
 * The due-window rule decides which button lights up next to a client's name.
 * Getting it wrong sends a "your visit is in 2 hours" message a day early, so
 * the boundaries are pinned rather than eyeballed.
 */
import { describe, expect, it } from "vitest";
import {
  dayKey, dueState, groupBy, sortForAgenda, summariseVisits, DAY_MS, HOUR_MS,
} from "./crmVisits";

const NOW = new Date("2026-09-10T10:00:00+05:30").getTime();
const at = (ms) => ({ slot_at: new Date(NOW + ms).toISOString() });

describe("what's due on a visit", () => {
  it("says nothing while the visit is more than a day out", () => {
    expect(dueState(at(3 * DAY_MS), NOW)).toBe("none");
    expect(dueState(at(DAY_MS + HOUR_MS), NOW)).toBe("none");
  });

  it("asks for a reminder inside the last day", () => {
    expect(dueState(at(DAY_MS), NOW)).toBe("reminder");
    expect(dueState(at(6 * HOUR_MS), NOW)).toBe("reminder");
  });

  it("switches to confirmation inside the last two hours", () => {
    expect(dueState(at(2 * HOUR_MS), NOW)).toBe("confirm");
    expect(dueState(at(30 * 60 * 1000), NOW)).toBe("confirm");
  });

  it("stops asking once the visit has started", () => {
    expect(dueState(at(0), NOW)).toBe("past");
    expect(dueState(at(-HOUR_MS), NOW)).toBe("past");
  });

  it("marks a booking with no time as needing one", () => {
    expect(dueState({ slot_at: null }, NOW)).toBe("unscheduled");
    expect(dueState({ slot_at: "not a date" }, NOW)).toBe("unscheduled");
    expect(dueState(undefined, NOW)).toBe("unscheduled");
  });
});

describe("ordering and grouping", () => {
  it("puts visits needing a time first, then the rest by time", () => {
    const rows = [at(2 * DAY_MS), { slot_at: null }, at(HOUR_MS)];
    expect(sortForAgenda(rows).map((r) => r.slot_at)).toEqual([
      null, rows[2].slot_at, rows[0].slot_at,
    ]);
  });

  it("groups by local calendar day, not UTC", () => {
    // 11:30pm IST is still the same day; through UTC it would slip back one.
    expect(dayKey("2026-09-10T23:30:00+05:30")).toBe("2026-09-10");
  });

  it("collects rows the key can't place under one empty group", () => {
    const groups = groupBy([{ property_id: "A" }, { property_id: null }], (b) => b.property_id);
    expect(groups.map((g) => g.key).sort()).toEqual(["", "A"]);
  });
});

describe("the counts on the header", () => {
  it("counts only what nobody has sent yet", () => {
    const rows = [
      { ...at(6 * HOUR_MS) },                                  // reminder due
      { ...at(5 * HOUR_MS), reminder_sent_at: "2026-09-10" },  // already done
      { ...at(HOUR_MS) },                                      // confirm due
      { ...at(-DAY_MS) },                                      // past
      { slot_at: null },                                       // needs a time
    ];
    expect(summariseVisits(rows, NOW)).toMatchObject({
      total: 5, remindersDue: 1, confirmsDue: 1, unscheduled: 1, past: 1, upcoming: 3,
    });
  });
});

describe("sorting rows that have the booking one level down", () => {
  it("uses the accessor rather than silently sorting nothing", () => {
    const rows = [
      { booking: at(2 * DAY_MS) },
      { booking: { slot_at: null } },
      { booking: at(HOUR_MS) },
    ];
    const [g] = groupBy(rows, () => "x", (r) => r.booking.slot_at);
    expect(g.items.map((r) => r.booking.slot_at)).toEqual([
      null, rows[2].booking.slot_at, rows[0].booking.slot_at,
    ]);
  });
});
