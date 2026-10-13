import { describe, expect, it } from "vitest";
import { DEFAULT_PARTNER_AMENITIES, POSTING_AMENITIES, depositOptions, maintenanceValue, occupantsFor } from "./postingDetails";

describe("depositOptions", () => {
  it("2x, 2.5x, 3x, 4x the rent, to the nearest ₹10k", () =>
    expect(depositOptions(32000).map((o) => o.amount)).toEqual([60000, 80000, 100000, 130000]));
  it("never below ₹10k, never twice the same amount", () =>
    expect(depositOptions(3000).map((o) => o.amount)).toEqual([10000]));
  it("no rent yet: nothing to suggest", () => expect(depositOptions("")).toEqual([]));
});

describe("occupantsFor", () => {
  it("Only Family / Only Bachelors", () => {
    expect(occupantsFor("Family")).toEqual(["Family"]);
    expect(occupantsFor("Bachelor")).toEqual(["Bachelor"]);
  });
  it("neither tapped: both", () => expect(occupantsFor("")).toEqual(["Family", "Bachelor"]));
});

describe("maintenance and amenities", () => {
  it("blank maintenance is 0", () => {
    expect(maintenanceValue("")).toBe(0);
    expect(maintenanceValue("2,500")).toBe(2500);
  });
  it("saved under the names tenants search by", () => {
    const v = Object.fromEntries(POSTING_AMENITIES.map((a) => [a.label, a.value]));
    expect(v["Power Back up"]).toBe("Power Backup");
    expect(v["Indoor Car Parking"]).toBe("Covered Parking");
  });
  it("outside parking, pet friendly and walkable start ticked", () =>
    expect(DEFAULT_PARTNER_AMENITIES).toEqual(["Outside Car Parking", "Pet Friendly", "Walkable Neighbourhood"]));
});
