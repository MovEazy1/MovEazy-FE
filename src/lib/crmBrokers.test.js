/**
 * What each broker is credited with.
 *
 * Every number on the Brokers tab follows a flat, a visit or a deal back to the
 * flat and from there to a broker, so the rule that decides whose flat it is
 * decides all of them.
 */
import { describe, expect, it } from "vitest";
import { brokerStats, inrShort, inventoryRequestMessage, sortBrokers } from "./crmBrokers";

const ravi = { id: "b1", name: "Ravi Kumar", phone: "9876543210" };
const meena = { id: "b2", name: "Meena", phone: "" };

const flat = (id, over = {}) => ({ property_id: id, status: "published", phone: "", created_at: "2026-09-20T10:00:00Z", ...over });

describe("brokerStats", () => {
  it("credits a flat linked in its internal details", () => {
    const s = brokerStats({ brokers: [ravi], links: [{ property_id: "MZ-1", broker_id: "b1" }], inventory: [flat("MZ-1")] });
    expect(s.get("b1").flats).toBe(1);
    expect(s.get("b1").propertyIds).toEqual(["MZ-1"]);
  });

  it("credits a flat posted from the broker's number, however it was typed", () => {
    // Flats listed before the upload form could name a broker at all.
    const s = brokerStats({ brokers: [ravi], inventory: [flat("MZ-2", { phone: "+91 98765 43210" })] });
    expect(s.get("b1").flats).toBe(1);
  });

  it("never credits one flat to two brokers — an explicit link wins", () => {
    const s = brokerStats({
      brokers: [ravi, { ...meena, phone: "9000000000" }],
      links: [{ property_id: "MZ-3", broker_id: "b2" }],
      inventory: [flat("MZ-3", { phone: "9876543210" })],
    });
    expect(s.get("b1").flats).toBe(0);
    expect(s.get("b2").flats).toBe(1);
  });

  it("doesn't match brokers with no number to flats with no number", () => {
    const s = brokerStats({ brokers: [meena], inventory: [flat("MZ-4", { phone: "" })] });
    expect(s.get("b2").flats).toBe(0);
  });

  it("counts only published flats as active", () => {
    const s = brokerStats({
      brokers: [ravi],
      links: ["MZ-1", "MZ-2", "MZ-3"].map((id) => ({ property_id: id, broker_id: "b1" })),
      inventory: [flat("MZ-1"), flat("MZ-2", { status: "rented" }), flat("MZ-3", { status: "dormant" })],
    });
    expect(s.get("b1").flats).toBe(3);
    expect(s.get("b1").active).toBe(1);
  });

  it("ignores a link to a flat that no longer exists", () => {
    const s = brokerStats({ brokers: [ravi], links: [{ property_id: "MZ-GONE", broker_id: "b1" }], inventory: [] });
    expect(s.get("b1").flats).toBe(0);
  });

  it("counts visits on their flats, not cancelled ones", () => {
    const s = brokerStats({
      brokers: [ravi],
      links: [{ property_id: "MZ-1", broker_id: "b1" }],
      inventory: [flat("MZ-1"), flat("MZ-9")],
      bookings: [
        { property_id: "MZ-1", status: "scheduled" },
        { property_id: "MZ-1", status: null },
        { property_id: "MZ-1", status: "cancelled" },
        { property_id: "MZ-9", status: "scheduled" },
      ],
    });
    expect(s.get("b1").visits).toBe(2);
  });

  it("credits closures and brokerage on their flats, and separates what has arrived", () => {
    const s = brokerStats({
      brokers: [ravi],
      links: [{ property_id: "MZ-1", broker_id: "b1" }],
      inventory: [flat("MZ-1")],
      clients: [
        { status: "closed_by_us", closed_property_id: "MZ-1", brokerage_amount: 30000, payment_status: "received" },
        { status: "closed_by_us", closed_property_id: "MZ-1", brokerage_amount: 25000, payment_status: "awaited" },
        // Closed elsewhere: not ours, not theirs.
        { status: "closed_outside", closed_property_id: "MZ-1", brokerage_amount: 99999 },
      ],
    });
    expect(s.get("b1").closures).toBe(2);
    expect(s.get("b1").revenue).toBe(55000);
    expect(s.get("b1").received).toBe(30000);
  });
});

describe("sortBrokers", () => {
  const a = { id: "a", name: "Zed" };
  const b = { id: "b", name: "Amit" };
  const c = { id: "c", name: "Mo" };
  const stats = new Map([
    ["a", { flats: 5, revenue: 0, closures: 0, lastSharedAt: 300 }],
    ["b", { flats: 1, revenue: 60000, closures: 2, lastSharedAt: 100 }],
    ["c", { flats: 0, revenue: 0, closures: 0, lastSharedAt: 0 }],
  ]);
  const ids = (rows) => rows.map((r) => r.id);

  it("sorts by flats, revenue, recency, quietness and name", () => {
    expect(ids(sortBrokers([a, b, c], stats, "flats"))).toEqual(["a", "b", "c"]);
    expect(ids(sortBrokers([a, b, c], stats, "revenue"))).toEqual(["b", "a", "c"]);
    expect(ids(sortBrokers([a, b, c], stats, "recent"))).toEqual(["a", "b", "c"]);
    // Never-shared first: they owe us a first flat.
    expect(ids(sortBrokers([a, b, c], stats, "quiet"))).toEqual(["c", "b", "a"]);
    expect(ids(sortBrokers([a, b, c], stats, "name"))).toEqual(["b", "c", "a"]);
  });
});

describe("inventoryRequestMessage", () => {
  it("asks about the areas we have demand in", () => {
    const msg = inventoryRequestMessage({ brokerName: "Ravi Kumar", agentName: "Asha", areas: ["HSR", "Bellandur"] });
    expect(msg).toContain("Hi Ravi,");
    expect(msg).toContain("Asha from MovEazy");
    expect(msg).toContain("in HSR, Bellandur?");
  });

  it("asks generally when there is no demand to point at", () => {
    expect(inventoryRequestMessage({ brokerName: "", agentName: "" })).toContain("any new flats available");
  });
});

describe("inrShort", () => {
  it("reads lakhs and thousands", () => {
    expect(inrShort(150000)).toBe("₹1.5L");
    expect(inrShort(45000)).toBe("₹45k");
    expect(inrShort(0)).toBe("₹0");
  });
});
