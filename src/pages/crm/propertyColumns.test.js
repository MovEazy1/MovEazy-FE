/**
 * The per-column tick-list filters on the Properties table.
 *
 * Two rules are easy to get subtly wrong and impossible to notice once wrong:
 * a column matches on the text the cell actually shows, and several columns
 * narrow together while several ticks inside one column widen. Get the first
 * wrong and a filter takes in rows that read differently; get the second wrong
 * and "2 BHK or 3 BHK" returns nothing.
 */
import { describe, expect, it } from "vitest";
import { COLUMNS, matchesFilters } from "./propertyColumns";

const flat = (over = {}) => ({
  property_id: "MZ-AAA111", flat_type: "2 BHK", furnishing: "Semi Furnished",
  area: "HSR", rent: 32000, poster_name: "MovEazy", source: "crm",
  created_at: "2026-09-12T10:00:00Z", ...over,
});

const col = (key) => COLUMNS.find((c) => c.key === key);

/** The predicate the table itself filters with. */
const keep = (filters) => (l) => matchesFilters(l, filters);

describe("what a column offers", () => {
  it("reads the cell, not the underlying field", () => {
    // The Home cell joins type and furnishing; filtering on flat_type alone
    // would take in rows whose cell reads differently.
    expect(col("home").of(flat())).toBe("2 BHK · Semi Furnished");
  });

  it("formats rent the way the cell does, so the tick matches what is shown", () => {
    expect(col("rent").of(flat({ rent: 32000 }))).toBe("₹32,000");
  });

  it("gives every column something for a row with holes in it", () => {
    const bare = { property_id: "MZ-BBB222" };
    for (const c of COLUMNS) {
      expect(c.of(bare), c.key).toBeTruthy();
    }
  });
});

describe("filtering", () => {
  const rows = [
    flat({ property_id: "MZ-1", flat_type: "2 BHK", area: "HSR" }),
    flat({ property_id: "MZ-2", flat_type: "3 BHK", area: "HSR" }),
    flat({ property_id: "MZ-3", flat_type: "2 BHK", area: "Whitefield" }),
  ];

  it("returns everything when nothing is ticked", () => {
    expect(rows.filter(keep({}))).toHaveLength(3);
    expect(rows.filter(keep({ area: new Set() }))).toHaveLength(3);
  });

  it("widens within a column — 2 BHK or 3 BHK", () => {
    const f = { home: new Set(["2 BHK · Semi Furnished", "3 BHK · Semi Furnished"]) };
    expect(rows.filter(keep(f))).toHaveLength(3);
  });

  it("narrows across columns — 2 BHK and in HSR", () => {
    const f = { home: new Set(["2 BHK · Semi Furnished"]), area: new Set(["HSR"]) };
    const out = rows.filter(keep(f));
    expect(out.map((r) => r.property_id)).toEqual(["MZ-1"]);
  });

  it("can return nothing, and says so honestly", () => {
    const f = { home: new Set(["3 BHK · Semi Furnished"]), area: new Set(["Whitefield"]) };
    expect(rows.filter(keep(f))).toEqual([]);
  });
});
