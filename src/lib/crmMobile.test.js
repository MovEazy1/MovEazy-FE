import { describe, expect, it } from "vitest";
import {
  PREMIUM_STEPS, countSteps, daysLeft, duration, goneQuiet, lastUnpaidTap, moveazyLeadStage, ownLeadStage,
  packStep, paymentNudge, premiumStep, usageSummary, waitingTotal,
} from "./crmMobile";

const NOW = new Date("2026-10-15T06:00:00Z").getTime();
const ago = (days) => new Date(NOW - days * 86400000).toISOString();

describe("which step of paying a partner is on", () => {
  it("puts a UTR waiting first, even on a trial", () => {
    expect(premiumStep({ plan_source: "trial", premium: [{ status: "payment_check", created_at: ago(1) }] })).toBe("utr");
  });
  it("tells a paid plan from a trial", () => {
    expect(premiumStep({ plan_source: "payment", premium: [{ status: "started", created_at: ago(9) }] })).toBe("premium");
    expect(premiumStep({ plan_source: "trial", premium: [] })).toBe("trial");
  });
  it("counts a Pay tap that came to nothing, on a trial or not", () => {
    expect(premiumStep({ plan_source: "trial", premium: [{ status: "started", created_at: ago(2) }] })).toBe("tapped");
    expect(premiumStep({ premium: [{ status: "started", created_at: ago(2) }] })).toBe("tapped");
    expect(premiumStep({ premium: [{ status: "started", created_at: ago(5) }, { status: "approved", created_at: ago(1) }] })).toBe("never");
    expect(premiumStep({ premium: [] })).toBe("never");
  });
  it("sorts the lead pack the same way", () => {
    expect(packStep({ lead_pack: [] })).toBe("never");
    expect(packStep({ lead_pack: [{ status: "awaiting_payment" }] })).toBe("tapped");
    expect(packStep({ lead_pack: [{ status: "awaiting_payment" }, { status: "payment_check" }] })).toBe("utr");
    expect(packStep({ lead_pack: [{ status: "fulfilled" }, { status: "awaiting_payment" }] })).toBe("bought");
  });
  it("counts partners per step and finds the latest unpaid tap", () => {
    const rows = [{ premium: [] }, { plan_source: "trial" }, { plan_source: "trial" }];
    expect(countSteps(rows, premiumStep, PREMIUM_STEPS)).toEqual({ never: 1, tapped: 0, utr: 0, trial: 2, premium: 0 });
    expect(lastUnpaidTap({ premium: [{ status: "started", amount: 1500, created_at: ago(5) }, { status: "started", amount: 4999, created_at: ago(1) }] }).amount).toBe(4999);
  });
  it("has a message for each stuck step", () => {
    expect(paymentNudge({ name: "Arjun S" }, "tapped")).toMatch(/^Hi Arjun, you were about to take MovEazy Premium/);
    expect(paymentNudge({ name: "" }, "tapped", true)).toMatch(/^Hi there, you started buying the MovEazy lead pack/);
  });
  it("counts days left, rounding up", () => {
    expect(daysLeft(new Date(NOW + 1.2 * 86400000).toISOString(), NOW)).toBe(2);
    expect(daysLeft(ago(1), NOW)).toBe(0);
  });
});

describe("partner usage", () => {
  const rows = [
    { name: "A", plan_source: "trial", last_seen: ago(0.1), seconds_today: 300, flats_today: 2 },
    { name: "B", plan_source: "trial", last_seen: ago(4) },
    { name: "C", plan_source: "payment", last_seen: null },
    { name: "D", last_seen: ago(10) },
  ];
  it("finds partners on a plan who haven't opened the app in 3 days, longest first", () => {
    expect(goneQuiet(rows, NOW).map((p) => p.name)).toEqual(["C", "B"]);
  });
  it("sums today", () => {
    expect(usageSummary(rows, NOW)).toEqual({ activeToday: 1, activeWeek: 2, secondsToday: 300, flatsToday: 2, onPlan: 3 });
  });
  it("reads durations", () => {
    expect([duration(0), duration(40), duration(720), duration(3900)]).toEqual(["—", "40s", "12m", "1h 5m"]);
  });
  it("says how far a lead has got", () => {
    expect(ownLeadStage({ status: "active" }).label).toBe("New");
    expect(ownLeadStage({ status: "active", last_contacted_at: ago(1), lists_sent: 1, likes: 2 }).label).toBe("Liked flats");
    expect(ownLeadStage({ status: "active", visits: 1 }).label).toBe("Visit fixed");
    expect(ownLeadStage({ status: "lost", visits: 1 }).label).toBe("Lost");
    expect(moveazyLeadStage({ status: "assigned", reach_count: 0 })).toBe("Not called yet");
    expect(moveazyLeadStage({ status: "assigned", reach_count: 2 })).toBe("Called / WhatsApped");
    expect(moveazyLeadStage({ status: "visit" })).toBe("Visit fixed");
  });
});

it("adds up what's waiting on the team", () => {
  expect(waitingTotal({ waiting: { slots_required: 3, payments_to_check: 1, lead_requests: 2, messages: 0, liked_no_visit: 70 } })).toBe(6);
  expect(waitingTotal(null)).toBe(0);
});
