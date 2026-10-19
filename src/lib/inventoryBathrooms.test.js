import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: null, supabasePublic: null }));
const { buildInventoryRow } = await import("./inventory");

describe("bathrooms when nobody said", () => {
  it("one per bedroom: 1 BHK 1, 2 BHK 2, 3 BHK 3", () => {
    expect([1, 2, 3, 4].map((bedrooms) => buildInventoryRow({ bedrooms }, {}).bathrooms)).toEqual([1, 2, 3, 4]);
  });
  it("never 0, and a count somebody chose stands", () => {
    expect(buildInventoryRow({}, {}).bathrooms).toBe(1);
    expect(buildInventoryRow({ bedrooms: 3, bathrooms: 2 }, {}).bathrooms).toBe(2);
    expect(buildInventoryRow({ bedrooms: 2, bathrooms: "" }, {}).bathrooms).toBe(2);
  });
});
