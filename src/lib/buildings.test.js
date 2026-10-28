import { describe, expect, it } from "vitest";
import { buildingUrl, cleanMobile, flatsByFloor, floorLabel, isMobile, nextDays, shortInr, sortFlats, TENANT_FILTERS, tenantBoardStats, trackSummary, visitTimes } from "./buildings";

describe("buildings", () => {
  it("names floors the way people say them", () => {
    expect([0, 1, 2, 3, 4, 11, 12, 13, 21, 22, -1, -2, null].map(floorLabel)).toEqual([
      "Ground floor", "1st floor", "2nd floor", "3rd floor", "4th floor", "11th floor", "12th floor", "13th floor",
      "21st floor", "22nd floor", "Basement", "Basement 2", "Floor not set",
    ]);
  });

  it("groups flats by floor, lowest first, unknown last, cheapest first within a floor", () => {
    const g = flatsByFloor([
      { property_id: "a", floor_number: 2, rent: 40000 }, { property_id: "b", floor_number: null, rent: 1 },
      { property_id: "c", floor_number: 0, rent: 20000 }, { property_id: "d", floor_number: 2, rent: 30000 },
    ]);
    expect(g.map((x) => x.label)).toEqual(["Ground floor", "2nd floor", "Floor not set"]);
    expect(g[1].flats.map((f) => f.property_id)).toEqual(["d", "a"]);
    const taken = flatsByFloor([{ property_id: "x", floor_number: 1, rent: 1000, available: false }, { property_id: "y", floor_number: 1, rent: 9000, available: true }]);
    expect(taken[0].flats.map((f) => f.property_id)).toEqual(["y", "x"]);
  });

  it("sorts a building's flats the way a tenant picks; popularity keeps MovEazy's order", () => {
    const flats = [
      { property_id: "A", unit_no: "207", floor_number: 2, rent: 32000 },
      { property_id: "B", unit_no: "101", floor_number: 1, rent: 35000 },
      { property_id: "C", unit_no: "1003", floor_number: 10, rent: 27000 },
      { property_id: "D", unit_no: "", floor_number: 3, rent: 30000 },
      { property_id: "E", unit_no: "103", floor_number: 1, rent: 27000 },
    ];
    const ids = (how) => sortFlats(flats, how).map((f) => f.property_id).join("");
    expect(ids("popular")).toBe("ABCDE");
    expect(ids(undefined)).toBe("ABCDE");
    expect(ids("price_asc")).toBe("CEDAB");
    expect(ids("price_desc")).toBe("BADCE");
    expect(ids("flat_no")).toBe("BEACD");
    expect(flats.map((f) => f.property_id).join("")).toBe("ABCDE");
  });

  it("says where a tenant stands", () => {
    expect(trackSummary({ visit: "pending" })).toBe("Visit pending");
    // Liked before a visit: a tenant's swipe, or the team's answer on a property they've only seen online.
    expect(trackSummary({ visit: "pending", liked: "liked" })).toBe("Liked");
    expect(trackSummary({ visit: "", liked: "disliked", reasons: ["ventilation"] })).toBe("Did not like · Ventilation issue");
    expect(trackSummary({ visit: "done" })).toBe("Visit done");
    expect(trackSummary({ visit: "done", liked: "liked", liked_status: "will_pay_token" })).toBe("Liked · Will pay token");
    expect(trackSummary({ visit: "done", liked: "disliked", reasons: ["size_small", "No covered parking"] })).toBe("Did not like · Size is small, No covered parking");
  });

  it("counts a building's tenants and filters them", () => {
    const tenants = [
      { phone: "1", qr: { called: ["caretaker"] }, track: null },
      { phone: "2", qr: { called: [] }, track: { visit: "done", liked: "liked", liked_status: "will_pay_token", follow_up_on: "2000-01-01" } },
      { phone: "3", track: { visit: "done", liked: "liked", liked_status: "paid_token" } },
      { phone: "4", track: { visit: "done", liked: "disliked", reasons: ["size_small", "Noisy"] } },
      { phone: "5", track: { visit: "done", liked: "disliked", reasons: ["size_small"], follow_up_on: "2999-01-01" } },
      { phone: "6", track: { visit: "pending" } },
    ];
    const s = tenantBoardStats(tenants);
    expect([s.total, s.fromQr, s.called, s.noStatus, s.visitDone, s.visitPending]).toEqual([6, 2, 1, 1, 4, 1]);
    expect([s.liked, s.will_pay_token, s.paid_token, s.negotiate, s.disliked, s.due]).toEqual([2, 1, 1, 0, 2, 1]);
    expect(s.reasons).toEqual([["size_small", 2], ["Noisy", 1]]);
    const ids = (f) => tenants.filter((x) => TENANT_FILTERS.find((t) => t.id === f).test(x, "2026-10-28")).map((x) => x.phone).join("");
    expect(ids("due")).toBe("2");
    expect(ids("qr")).toBe("12");
    expect(ids("new")).toBe("1");
    expect(ids("disliked")).toBe("45");
    expect(ids("pending")).toBe("6");
  });

  it("offers half-hour visit times from 9 to 8, none in the next hour today", () => {
    const day = new Date(2030, 0, 5);
    const all = visitTimes(day, new Date(2030, 0, 1));
    expect(all[0].label).toBe("9:00 AM");
    expect(all.at(-1).label).toBe("8:00 PM");
    expect(all).toHaveLength(23);
    const today = visitTimes(day, new Date(2030, 0, 5, 15, 10));
    expect(today[0].label).toBe("4:30 PM");
    expect(today[0].part).toBe("Afternoon");
  });

  it("lists days from today", () => {
    const d = nextDays(3, new Date(2030, 0, 31, 18));
    expect(d.map((x) => x.getDate())).toEqual([31, 1, 2]);
  });

  it("reads Indian mobiles however they are typed", () => {
    expect(cleanMobile("+91 98765 43210")).toBe("9876543210");
    expect(isMobile("098765 43210")).toBe(true);
    expect(isMobile("12345")).toBe(false);
  });

  it("shortens rent", () => {
    expect([22000, 34500, 100000, 125000, 0].map(shortInr)).toEqual(["₹22k", "₹35k", "₹1L", "₹1.3L", ""]);
  });

  it("puts the QR on moveazy.co.in", () => {
    expect(buildingUrl("AB23CD", { qr: true })).toBe("https://www.moveazy.co.in/building/AB23CD?s=qr");
  });
});
