import { describe, expect, it } from "vitest";
import {
  bhkShort, equalSplit, findDuplicate, flatBasicsErrors, flatLabel, flatOwnerErrors, isUpiId, rupees, societyError, sp, splitTotal,
} from "./society";

describe("society helpers", () => {
  it("paths on the main host", () => {
    expect(sp("/flats")).toBe("/society/flats");
    expect(sp("flats")).toBe("/society/flats");
  });

  it("money and labels", () => {
    expect(rupees(45000)).toBe("₹45,000");
    expect(rupees(150000)).toBe("₹1,50,000");
    expect(bhkShort("2 BHK")).toBe("2BHK");
    expect(flatLabel("Tower A", "1203")).toBe("A-1203");
    expect(flatLabel("A - Tower 1", "12")).toBe("A-1-12");
    expect(flatLabel("", "g2")).toBe("G2");
    expect(flatLabel("Block", "5")).toBe("5");
  });

  it("UPI IDs", () => {
    expect(isUpiId("suresh@okaxis")).toBe(true);
    expect(isUpiId("Suresh.K-1@ybl")).toBe(true);
    expect(isUpiId("suresh")).toBe(false);
    expect(isUpiId("@okaxis")).toBe(false);
    expect(isUpiId("a@1bank")).toBe(false);
  });

  it("step one: every field", () => {
    expect(flatBasicsErrors({ block: "Tower A", flat_no: "1203", bhk: "2 BHK", rent: "45,000", furnishing: "Fully Furnished" }, ["Tower A"])).toEqual({});
    const e = flatBasicsErrors({ block: "", flat_no: "", bhk: "", rent: "500", furnishing: "" }, ["Tower A"]);
    expect(Object.keys(e).sort()).toEqual(["bhk", "block", "flat_no", "furnishing", "rent"]);
    expect(flatBasicsErrors({ flat_no: "1", bhk: "1 RK", rent: "9000000", furnishing: "Unfurnished" }).rent).toMatch(/too high/);
    expect(flatBasicsErrors({ flat_no: "1", bhk: "1 RK", rent: "9000", furnishing: "Unfurnished" })).toEqual({});
  });

  it("step two: the owner", () => {
    expect(flatOwnerErrors({ owner_name: "Rohit Mehta", owner_phone: "+91 98765 43210" })).toEqual({});
    expect(Object.keys(flatOwnerErrors({ owner_name: "R", owner_phone: "123", area_sqft: "40" })).sort()).toEqual(["area_sqft", "owner_name", "owner_phone"]);
  });

  it("duplicates by block + flat number", () => {
    const flats = [{ property_id: "A", block: "Tower A", flat_no: "1203" }];
    expect(findDuplicate(flats, "tower a", "12 03")?.property_id).toBe("A");
    expect(findDuplicate(flats, "Tower A", "1203", "A")).toBe(null);
    expect(findDuplicate(flats, "Tower B", "1203")).toBe(null);
  });

  it("splits", () => {
    expect(equalSplit(3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitTotal(equalSplit(3).map((pct) => ({ pct })))).toBe(100);
    expect(splitTotal([{ pct: "50" }, { pct: 30 }])).toBe(80);
    expect(equalSplit(0)).toEqual([]);
  });

  it("errors people can read", () => {
    expect(societyError({ message: "Pick the BHK type." })).toBe("Pick the BHK type.");
    expect(societyError({ message: "TypeError: Failed to fetch" })).toMatch(/internet/);
    expect(societyError({ message: "permission denied for function x" })).toMatch(/went wrong/);
  });
});
