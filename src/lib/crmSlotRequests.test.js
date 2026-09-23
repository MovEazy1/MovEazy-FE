/**
 * The queue of people waiting on a visit time.
 *
 * Two things matter here and neither is visible from the data alone: one flat
 * is one piece of work however many people are waiting on it, and one person
 * is one person however many times they asked. Get either wrong and the screen
 * either hides the urgent flats or invites somebody to message the same tenant
 * four times.
 */
import { describe, expect, it } from "vitest";
import {
  askPreferredTimeMessage, formatSlot, groupRequestsByProperty, slotsAvailableMessage,
} from "./crmSlotRequests";

const req = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  listing_id: "MZ-AAA111", listing_title: "2 BHK in HSR",
  customer_email: "a@example.com", customer_phone: "9876543210",
  customer_id: null, visit_time: "", notes: "", created_at: "2026-09-20T10:00:00Z",
  ...over,
});

describe("grouping the queue", () => {
  it("makes one card per flat, with everyone waiting on it", () => {
    const out = groupRequestsByProperty([
      req({ customer_phone: "9876543210" }),
      req({ customer_phone: "9000000001" }),
      req({ listing_id: "MZ-BBB222", customer_phone: "9000000002" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].propertyId).toBe("MZ-AAA111");
    expect(out[0].waiting).toHaveLength(2);
  });

  it("puts the flat with the most people waiting first", () => {
    // That is the one where putting times up does the most good.
    const out = groupRequestsByProperty([
      req({ listing_id: "MZ-ONE", customer_phone: "9000000001" }),
      req({ listing_id: "MZ-TWO", customer_phone: "9000000002" }),
      req({ listing_id: "MZ-TWO", customer_phone: "9000000003" }),
    ]);
    expect(out[0].propertyId).toBe("MZ-TWO");
  });

  it("counts a repeat asker once, not three times", () => {
    // Otherwise the same person gets messaged once per row they generated.
    const out = groupRequestsByProperty([
      req({ customer_phone: "9876543210" }),
      req({ customer_phone: "9876543210" }),
      req({ customer_phone: "9876543210", notes: "weekends only" }),
    ]);
    expect(out[0].waiting).toHaveLength(1);
    expect(out[0].waiting[0].asks).toBe(3);
    // And whatever they told us survives the dedupe.
    expect(out[0].waiting[0].notes).toBe("weekends only");
  });

  it("treats someone with no phone but an email as one person too", () => {
    const out = groupRequestsByProperty([
      req({ customer_phone: "", customer_email: "b@example.com" }),
      req({ customer_phone: "", customer_email: "B@example.com" }),
    ]);
    expect(out[0].waiting).toHaveLength(1);
  });

  it("still names a flat that has since left inventory", () => {
    const out = groupRequestsByProperty([req({ listing_title: "2 BHK in HSR" })], new Map());
    expect(out[0].title).toBe("2 BHK in HSR");
  });

  it("prefers the live listing's title over the one copied at ask time", () => {
    const listings = new Map([["MZ-AAA111", { title: "2 BHK · Silver County Road" }]]);
    expect(groupRequestsByProperty([req()], listings)[0].title).toBe("2 BHK · Silver County Road");
  });

  it("attaches the times already on a flat, so the screen knows it is solved", () => {
    const slots = new Map([["MZ-AAA111", [{ slot_at: "2026-09-25T09:30:00Z" }]]]);
    expect(groupRequestsByProperty([req()], new Map(), slots)[0].slots).toHaveLength(1);
  });

  it("ignores a request with no flat attached", () => {
    expect(groupRequestsByProperty([req({ listing_id: "" })])).toEqual([]);
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
    expect(formatSlot("not a date")).toBe("");
    expect(formatSlot(null)).toBe("");
  });
});
