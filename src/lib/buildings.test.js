import { describe, expect, it } from "vitest";
import { buildingUrl, cleanMobile, flatsByFloor, floorLabel, isMobile, nextDays, shortInr, visitTimes } from "./buildings";

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
