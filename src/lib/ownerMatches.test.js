import { describe, expect, it, vi } from "vitest";

vi.mock("./userRequirements", () => ({
  fetchAllUserRequirements: async () => [
    { user_id: "AAA111", localities: ["HSR Layout"], budget_min: 20000, budget_max: 35000, flat_types: ["2 BHK"] },
    { user_id: "BBB222", localities: ["HSR Layout", "Bellandur"], budget_min: 15000, budget_max: 40000, flat_types: ["2 BHK", "1 BHK"] },
    { user_id: "CCC333", localities: ["Whitefield"], budget_min: 50000, budget_max: 60000, flat_types: ["4 BHK"] },
  ],
}));
const { countMatchingTenants } = await import("./ownerMatches");

describe("countMatchingTenants", () => {
  it("counts each tenant once across flats, and per flat", async () => {
    const m = await countMatchingTenants([
      { property_id: "P1", area: "HSR Layout", rent: 30000, flat_type: "2 BHK" },
      { property_id: "P2", area: "Bellandur", rent: 22000, flat_type: "1 BHK" },
    ]);
    expect(m.byProperty.get("P1")).toBe(2);
    expect(m.byProperty.get("P2")).toBe(1);
    expect(m.total).toBe(2);
  });

  it("no flats on rent: none", async () => {
    expect((await countMatchingTenants([])).total).toBe(0);
  });
});
