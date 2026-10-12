import { describe, expect, it } from "vitest";
import { allHomes, factsOf, firstName, flatLine, likedMessage } from "./curatedText";

describe("curatedText", () => {
  it("first names", () => {
    expect(firstName("  Ravi Kumar ")).toBe("Ravi");
    expect(firstName("")).toBe("");
  });

  it("only the facts a flat has", () => {
    const f = Object.fromEntries(factsOf({ deposit: 100000, furnishing: "Semi-furnished", area_sqft: 1250, floor_number: 3, bathrooms: 2,
      max_flatmates: 0, occupants_allowed: ["Family"], gender_pref: "female", available_from: "2000-01-01" }));
    expect(f).toMatchObject({ Deposit: "₹1,00,000", Furnishing: "Semi-furnished", Size: "1,250 sq ft", Floor: "3rd", Bathrooms: "2",
      Available: "Now", "Who can stay": "Family · Women only" });
    expect(f.Flatmates).toBeUndefined();
    expect(f.Type).toBeUndefined();
    expect(factsOf({})).toEqual([]);
  });

  it("floors read naturally", () => {
    const floor = (n) => Object.fromEntries(factsOf({ floor_number: n })).Floor;
    expect([0, 1, 2, 11, 12, 13, 21, 22].map(floor)).toEqual(["Ground", "1st", "2nd", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("a flat line", () => {
    expect(flatLine({ flat_type: "2 BHK", area: "HSR Layout" })).toBe("2 BHK · HSR Layout");
    expect(flatLine({ area: "HSR Layout" })).toBe("HSR Layout");
  });

  it("the message lists each liked flat and links back", () => {
    const m = likedMessage({ brokerName: "Ravi Kumar", url: "https://www.moveazy.co.in/c/abc", liked: [
      { flat_type: "2 BHK", area: "HSR Layout", rent: 32000 }, { flat_type: "1 BHK", area: "Koramangala", rent: 0 }] });
    expect(m).toBe("Hi Ravi, I liked these flats from your list:\n1) 2 BHK, HSR Layout — ₹32,000/month\n2) 1 BHK, Koramangala\n"
      + "When can I schedule the visits?\nhttps://www.moveazy.co.in/c/abc");
    expect(likedMessage({ liked: [{ flat_type: "2 BHK", area: "HSR", rent: 1000 }] })).toMatch(/^Hi, I liked this flat[\s\S]*the visit\?$/);
    expect(likedMessage({ brokerName: "Ravi" })).toMatch(/^Hi Ravi, I went through your list — none of these worked/);
  });

  it("every home once, answerable on its own list", () => {
    const homes = allHomes([
      { token: "now", homes: [{ property_id: "A" }, { property_id: "B" }] },
      { token: "old", homes: [{ property_id: "B", action: "liked" }, { property_id: "C" }] },
    ]);
    expect(homes.map((h) => `${h.property_id}@${h.token}`)).toEqual(["A@now", "B@now", "C@old"]);
    expect(allHomes()).toEqual([]);
  });
});
