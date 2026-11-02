import { describe, expect, it } from "vitest";
import {
  OUTCOMES, endsSearch, followUpState, isActive, isHotLead, lastContactByClient, partnerAssignMessage, partnerBucket,
  partnerDueRows, partnerSummaryMessage, quickPicks, suggestedNext, whenLabel,
} from "./followUps";

const DAY = 864e5;
const NOW = new Date(2026, 10, 2, 11, 0).getTime(); // Mon 2 Nov 2026, 11:00 local

describe("outcomes and dates", () => {
  it("has the eight outcomes; two end the search", () => {
    expect(OUTCOMES.map((o) => o.id)).toEqual(["talked", "not_picked", "call_later", "busy", "visit_booked", "flats_shared", "not_interested", "found_elsewhere"]);
    expect(endsSearch("not_interested")).toBe(true);
    expect(endsSearch("found_elsewhere")).toBe(true);
    expect(endsSearch("talked")).toBe(false);
  });
  it("suggests tomorrow 10 am after a miss, 2 days after a talk, nothing for call later", () => {
    expect(suggestedNext("not_picked", NOW)).toEqual(new Date(2026, 10, 3, 10, 0));
    expect(suggestedNext("talked", NOW)).toEqual(new Date(2026, 10, 4, 10, 0));
    expect(suggestedNext("call_later", NOW)).toBe(null);
    expect(suggestedNext("not_interested", NOW)).toBe(null);
  });
  it("quick picks: this evening only while it's ahead", () => {
    expect(quickPicks(NOW).map((p) => p.id)).toEqual(["evening", "tomorrow", "3d", "week"]);
    expect(quickPicks(new Date(2026, 10, 2, 17, 45).getTime()).map((p) => p.id)).toEqual(["tomorrow", "3d", "week"]);
  });
  it("reads a date as today / tomorrow / a weekday", () => {
    expect(whenLabel(new Date(2026, 10, 2, 18, 0), NOW)).toMatch(/^Today, 6:00 pm$/i);
    expect(whenLabel(new Date(2026, 10, 3, 10, 0), NOW)).toMatch(/^Tomorrow, 10:00 am$/i);
    expect(whenLabel(new Date(2026, 10, 6, 10, 0), NOW)).toMatch(/^Fri,? 6 Nov, 10:00 am$/i);
  });
});

describe("the daily list", () => {
  const client = (x = {}) => ({ id: "c", status: "fresh", created_at: new Date(NOW - 3 * DAY).toISOString(), ...x });

  it("only active clients: not closed, not Ice", () => {
    expect(isActive(client())).toBe(true);
    expect(isActive(client({ status: "closed_outside" }))).toBe(false);
    expect(isActive(client({ temperature: "ice" }))).toBe(false);
  });
  it("a date today is Today; a past one Overdue; a later one Upcoming", () => {
    expect(followUpState(client({ next_follow_up_at: new Date(NOW + 3600e3).toISOString() }), { now: NOW }).bucket).toBe("today");
    expect(followUpState(client({ next_follow_up_at: new Date(NOW - 2 * DAY).toISOString() }), { now: NOW }).bucket).toBe("overdue");
    expect(followUpState(client({ next_follow_up_at: new Date(NOW + 2 * DAY).toISOString() }), { now: NOW }).bucket).toBe("upcoming");
  });
  it("no date: due 2 days after we last reached them, never reached is overdue", () => {
    expect(followUpState(client(), { lastContactAt: NOW - DAY, now: NOW }).bucket).toBe("upcoming");
    expect(followUpState(client(), { lastContactAt: NOW - 2 * DAY, now: NOW }).bucket).toBe("today");
    expect(followUpState(client(), { now: NOW }).bucket).toBe("overdue");
  });
  it("nothing for 7 days — no contact, no visit — is Quiet", () => {
    const old = client({ created_at: new Date(NOW - 30 * DAY).toISOString() });
    expect(followUpState(old, { lastContactAt: NOW - 8 * DAY, now: NOW })).toMatchObject({ bucket: "quiet", why: "Nothing for 8 days" });
    expect(followUpState(old, { lastContactAt: NOW - 8 * DAY, lastSiteAt: NOW - DAY, now: NOW }).bucket).toBe("overdue");
    // A date someone set keeps them off Quiet.
    expect(followUpState({ ...old, next_follow_up_at: new Date(NOW + DAY).toISOString() }, { lastContactAt: NOW - 8 * DAY, now: NOW }).bucket).toBe("upcoming");
  });
  it("hot: on the site today, or moving in within 15 days", () => {
    expect(isHotLead({ lastSiteAt: NOW - 3600e3, now: NOW })).toBe(true);
    expect(isHotLead({ moveInAt: NOW + 10 * DAY, now: NOW })).toBe(true);
    expect(isHotLead({ moveInAt: NOW + 40 * DAY, lastSiteAt: NOW - 3 * DAY, now: NOW })).toBe(false);
    expect(isHotLead({ now: NOW })).toBe(false);
  });
  it("last contact counts staff contact only", () => {
    const m = lastContactByClient([
      { client_id: "a", type: "note", created_at: new Date(NOW).toISOString() },
      { client_id: "a", type: "call", created_at: new Date(NOW - DAY).toISOString() },
      { client_id: "a", type: "whatsapp", created_at: new Date(NOW - 2 * DAY).toISOString() },
    ]);
    expect(m.get("a")).toBe(NOW - DAY);
  });
});

describe("partners", () => {
  const today = new Date(NOW).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  it("buckets the partner's Today list", () => {
    expect(partnerBucket({ follow_up_on: "2026-10-30", assigned_at: NOW }, NOW)).toBe("overdue");
    expect(partnerBucket({ follow_up_on: today, assigned_at: NOW }, NOW)).toBe("today");
    expect(partnerBucket({ follow_up_on: "2026-11-09", assigned_at: NOW }, NOW)).toBe("later");
    expect(partnerBucket({ assigned_at: new Date(NOW - 3600e3).toISOString() }, NOW)).toBe("today");
    expect(partnerBucket({ assigned_at: new Date(NOW - 3 * DAY).toISOString() }, NOW)).toBe("overdue");
  });
  it("the WhatsApp to a partner just given a client", () => {
    expect(partnerAssignMessage({ partner: "Kiran", client: { name: "Ravi", phone: "+91 98450 12345" }, need: "2 BHK · HSR", note: "Hot" }))
      .toBe("Hi Kiran, a new MovEazy client for you:\nRavi – 9845012345\nLooking for: 2 BHK · HSR\nNote: Hot\nPlease call them today and log each call in the MovEazy partner app (Leads → Today).");
  });
  it("a partner's morning list: untouched, missed and due ones", () => {
    const rows = [
      { client_name: "A", client_phone: "9800000001", sla: "red" },
      { client_name: "B", client_phone: "9800000002", sla: "ok", follow_up_on: "2026-11-09", last_action_at: new Date(NOW).toISOString() },
      { client_name: "C", client_phone: "9800000003", sla: "ok", follow_up_on: today },
    ];
    const due = partnerDueRows(rows, NOW);
    expect(due.map((r) => r.client_name)).toEqual(["A", "C"]);
    expect(partnerSummaryMessage({ name: "Kiran" }, due)).toContain("1. A – 9800000001 (not called yet)\n2. C – 9800000003");
  });
});
