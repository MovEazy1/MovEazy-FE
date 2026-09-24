/**
 * The daily follow-up queue.
 *
 * The rule that matters is the snooze: parking a client has to hide them, and
 * their next move has to bring them straight back. Get the second half wrong
 * and "remind me in six hours" silently becomes "ignore this person for six
 * hours", including when they reply a minute later — which is the opposite of
 * a follow-up queue.
 */
import { describe, expect, it } from "vitest";
import {
  buildDailyTasks, describeAction, followUpMessage, isSnoozed, timeAgo,
} from "./crmDailyTasks";

const NOW = Date.parse("2026-09-24T12:00:00Z");
const at = (minsAgo) => new Date(NOW - minsAgo * 60000).toISOString();

const action = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  client_id: "c1", actor_email: "", type: "visit",
  body: "Wants a visit · MZ-AAA111", created_at: at(5), ...over,
});

const CLIENTS = [
  { id: "c1", name: "Asha Menon", phone: "9876543210", email: "asha@example.com", status: "fresh" },
  { id: "c2", name: "Ravi Kumar", phone: "9000000001", email: "ravi@example.com", status: "fresh" },
];

describe("building the queue", () => {
  it("makes one row per person, however much they did", () => {
    // An agent rings a person, not an event.
    const out = buildDailyTasks(
      [action({ created_at: at(5) }), action({ created_at: at(40) }), action({ client_id: "c2" })],
      CLIENTS, [], NOW,
    );
    expect(out).toHaveLength(2);
    const asha = out.find((t) => t.clientId === "c1");
    expect(asha.count).toBe(2);
  });

  it("shows the most recent thing they did", () => {
    const out = buildDailyTasks(
      [action({ body: "newest", created_at: at(2) }), action({ body: "older", created_at: at(90) })],
      CLIENTS, [], NOW,
    );
    expect(out[0].latest.body).toBe("newest");
  });

  it("puts the freshest person at the top", () => {
    const out = buildDailyTasks(
      [action({ client_id: "c2", created_at: at(3) }), action({ client_id: "c1", created_at: at(30) })],
      CLIENTS, [], NOW,
    );
    expect(out[0].clientId).toBe("c2");
  });

  it("carries the name and number an agent needs to act", () => {
    const out = buildDailyTasks([action()], CLIENTS, [], NOW);
    expect(out[0]).toMatchObject({ name: "Asha Menon", phone: "9876543210" });
  });

  it("drops an action whose client we cannot see", () => {
    // No client row means no name and no number — nothing to ring.
    expect(buildDailyTasks([action({ client_id: "ghost" })], CLIENTS, [], NOW)).toEqual([]);
  });
});

describe("parking a follow-up", () => {
  it("hides the client until the clock runs out", () => {
    const snooze = { client_id: "c1", snoozed_at: at(10), remind_at: at(-110) }; // ~2h away
    expect(isSnoozed(snooze, at(10), NOW)).toBe(true);
    expect(buildDailyTasks([action({ created_at: at(10) })], CLIENTS, [snooze], NOW)).toEqual([]);
  });

  it("brings them back once the time has passed", () => {
    const snooze = { client_id: "c1", snoozed_at: at(200), remind_at: at(5) };
    expect(isSnoozed(snooze, at(200), NOW)).toBe(false);
    expect(buildDailyTasks([action({ created_at: at(200) })], CLIENTS, [snooze], NOW)).toHaveLength(1);
  });

  it("brings them back the moment they do something new", () => {
    // The whole point: snoozed at 10:00, replied at 10:01, must not stay
    // hidden until 16:00.
    const snooze = { client_id: "c1", snoozed_at: at(60), remind_at: at(-300) };
    expect(isSnoozed(snooze, at(59), NOW)).toBe(false);
    const out = buildDailyTasks([action({ created_at: at(59) })], CLIENTS, [snooze], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].returned).toBe(true);
  });

  it("stays hidden for an action that predates the snooze", () => {
    const snooze = { client_id: "c1", snoozed_at: at(10), remind_at: at(-300) };
    expect(isSnoozed(snooze, at(90), NOW)).toBe(true);
  });

  it("never hides somebody who was never parked", () => {
    expect(isSnoozed(null, at(5), NOW)).toBe(false);
    expect(isSnoozed(undefined, at(5), NOW)).toBe(false);
  });
});

describe("how a row reads", () => {
  it("shows what they did, shortened when it runs long", () => {
    expect(describeAction({ body: "Wants a visit · MZ-AAA111" })).toBe("Wants a visit · MZ-AAA111");
    expect(describeAction({ body: "x".repeat(200) })).toHaveLength(90);
  });

  it("falls back to the activity type when there is no text", () => {
    expect(describeAction({ type: "shortlist", body: "" })).toBe("Activity: shortlist");
  });

  it("reads in minutes, then hours, then days", () => {
    expect(timeAgo(at(0), NOW)).toBe("just now");
    expect(timeAgo(at(4), NOW)).toBe("4 min ago");
    expect(timeAgo(at(120), NOW)).toBe("2 hrs ago");
    expect(timeAgo(at(60 * 48), NOW)).toBe("2 days ago");
  });

  it("renders nothing for a missing time rather than 1970", () => {
    expect(timeAgo(null, NOW)).toBe("");
  });

  it("opens WhatsApp with their name and what they just did", () => {
    const m = followUpMessage({ name: "Asha Menon", action: { body: "Wants a visit · MZ-AAA111" } });
    expect(m).toContain("Hi Asha");
    expect(m).toContain("wants a visit");
  });

  it("stays grammatical with no name and no action", () => {
    expect(followUpMessage({})).toContain("Hi, this is MovEazy.");
  });
});
