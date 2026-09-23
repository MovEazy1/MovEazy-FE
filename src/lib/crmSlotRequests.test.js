/**
 * The queue of people waiting on a visit time.
 *
 * A booking with no slot_at is somebody who asked for the next available slot
 * on a flat whose lister published none. Two things matter here and neither is
 * visible from the data alone: one flat is one piece of work however many
 * people are waiting on it, and one person is one person however many times
 * they asked. Get either wrong and the screen either hides the urgent flats or
 * invites somebody to message the same tenant four times.
 */
import { describe, expect, it } from "vitest";
import {
  askPreferredTimeMessage, formatSlot, groupRequestsByProperty, slotsAvailableMessage,
} from "./crmSlotRequests";

/** A visit_bookings row with no time on it. */
const booking = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  property_id: "MZ-AAA111",
  user_id: "user-1",
  slot_at: null,
  status: "scheduled",
  created_at: "2026-09-20T10:00:00Z",
  ...over,
});

const profiles = (...people) =>
  new Map(people.map((p) => [p.id, p]));

const ASHA = { id: "user-1", name: "Asha Menon", email: "asha@example.com", phone: "9876543210" };
const RAVI = { id: "user-2", name: "Ravi Kumar", email: "ravi@example.com", phone: "9000000001" };

describe("grouping the queue", () => {
  it("makes one card per flat, with everyone waiting on it", () => {
    const out = groupRequestsByProperty(
      [booking({ user_id: "user-1" }), booking({ user_id: "user-2" }),
       booking({ property_id: "MZ-BBB222", user_id: "user-2" })],
      new Map(), new Map(), profiles(ASHA, RAVI),
    );
    expect(out).toHaveLength(2);
    expect(out[0].propertyId).toBe("MZ-AAA111");
    expect(out[0].waiting).toHaveLength(2);
  });

  it("puts the flat with the most people waiting first", () => {
    // That is the one where putting times up does the most good.
    const out = groupRequestsByProperty(
      [booking({ property_id: "MZ-ONE", user_id: "user-1" }),
       booking({ property_id: "MZ-TWO", user_id: "user-1" }),
       booking({ property_id: "MZ-TWO", user_id: "user-2" })],
      new Map(), new Map(), profiles(ASHA, RAVI),
    );
    expect(out[0].propertyId).toBe("MZ-TWO");
  });

  it("counts a repeat asker once, not three times", () => {
    // Otherwise the same person gets messaged once per row they generated.
    const out = groupRequestsByProperty(
      [booking(), booking(), booking()],
      new Map(), new Map(), profiles(ASHA),
    );
    expect(out[0].waiting).toHaveLength(1);
    expect(out[0].waiting[0].asks).toBe(3);
  });

  it("carries the name and number off the profile, which the booking lacks", () => {
    const out = groupRequestsByProperty([booking()], new Map(), new Map(), profiles(ASHA));
    expect(out[0].waiting[0]).toMatchObject({
      name: "Asha Menon", phone: "9876543210", email: "asha@example.com",
    });
  });

  it("still lists someone whose profile we could not load", () => {
    // No name is a worse card, but dropping them loses a real person waiting.
    const out = groupRequestsByProperty([booking()], new Map(), new Map(), new Map());
    expect(out[0].waiting).toHaveLength(1);
    expect(out[0].waiting[0].phone).toBe("");
  });

  it("falls back to the property id when the flat is not in inventory", () => {
    expect(groupRequestsByProperty([booking()], new Map())[0].title).toBe("MZ-AAA111");
  });

  it("uses the live listing's title when it is there", () => {
    const listings = new Map([["MZ-AAA111", { title: "2 BHK · Silver County Road" }]]);
    expect(groupRequestsByProperty([booking()], listings)[0].title).toBe("2 BHK · Silver County Road");
  });

  it("attaches the times already on a flat, so the screen knows it is solved", () => {
    const slots = new Map([["MZ-AAA111", [{ slot_at: "2026-09-25T09:30:00Z" }]]]);
    expect(groupRequestsByProperty([booking()], new Map(), slots)[0].slots).toHaveLength(1);
  });

  it("ignores a booking with no flat attached", () => {
    expect(groupRequestsByProperty([booking({ property_id: "" })])).toEqual([]);
  });
});

describe("what gets sent", () => {
  it("asks for a time by name, and says which flat", () => {
    const m = askPreferredTimeMessage({ name: "Asha Menon", title: "2 BHK in HSR", propertyId: "MZ-AAA111" });
    expect(m).toContain("Hi Asha");
    expect(m).toContain("2 BHK in HSR");
  });

  it("stays grammatical when we never learned their name", () => {
    expect(askPreferredTimeMessage({ title: "2 BHK in HSR" })).toContain("Hi, this is MovEazy.");
  });

  it("lists the open times once there are some", () => {
    const m = slotsAvailableMessage({
      name: "Ravi", title: "2 BHK in HSR",
      slots: [{ slot_at: "2026-09-25T09:30:00Z" }, { slot_at: "2026-09-25T11:00:00Z" }],
      link: "https://www.moveazy.co.in/p/MZ-AAA111",
    });
    expect(m).toContain("Hi Ravi");
    expect(m).toMatch(/•/);
    expect(m).toContain("https://www.moveazy.co.in/p/MZ-AAA111");
  });

  it("asks them to reply when there is no link to send", () => {
    expect(slotsAvailableMessage({ name: "Ravi", slots: [] })).toContain("Reply with the one that suits you");
  });
});

describe("showing a time", () => {
  it("reads as a date a person would say out loud", () => {
    expect(formatSlot("2026-09-25T09:30:00Z")).toMatch(/Sep/);
  });

  it("renders nothing for a value that isn't a date", () => {
    // new Date(null) is the epoch, not an error — without the guard this went
    // out to a tenant as "Thu, 1 Jan, 5:30 am".
    expect(formatSlot("not a date")).toBe("");
    expect(formatSlot(null)).toBe("");
  });
});
