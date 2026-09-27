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
import { COLUMNS, listingIdIn, matchesFilters, matchesSearch } from "./propertyColumns";

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

describe("searching the Properties table", () => {
  // The listing an agent reported as missing from the CRM. It was there all
  // along; the search could not find it from the link they pasted.
  const flat = {
    property_id: "MZ-FQ5U48", area: "Silver County Road", title: "3 BHK in SRJ Bluewaters",
    flat_type: "3 BHK", poster_name: "", phone: "", status: "published",
  };
  const other = { ...flat, property_id: "MZ-AAAA11", title: "2 BHK in HSR", area: "HSR" };

  it("finds a listing from the link that was pasted", () => {
    const link = "https://www.moveazy.co.in/property/MZ-FQ5U48";
    expect(matchesSearch(flat, link)).toBe(true);
    expect(matchesSearch(other, link)).toBe(false);
  });

  it("finds it from a share link with tracking on the end", () => {
    expect(matchesSearch(flat, "https://www.moveazy.co.in/p/MZ-FQ5U48?utm_source=whatsapp&utm_medium=crm")).toBe(true);
  });

  it("finds it from the id in any case", () => {
    expect(matchesSearch(flat, "mz-fq5u48")).toBe(true);
    expect(matchesSearch(flat, "  MZ-FQ5U48  ")).toBe(true);
  });

  it("treats an id as an exact lookup, not a substring", () => {
    // MZ-FQ5U48 must not also match a listing called MZ-FQ5U480.
    expect(matchesSearch({ ...flat, property_id: "MZ-FQ5U480" }, "MZ-FQ5U48")).toBe(false);
  });

  it("still searches free text as before", () => {
    expect(matchesSearch(flat, "bluewaters")).toBe(true);
    expect(matchesSearch(flat, "silver county")).toBe(true);
    expect(matchesSearch(other, "bluewaters")).toBe(false);
    expect(matchesSearch(flat, "")).toBe(true);
  });

  it("pulls the id out of whatever it arrives in", () => {
    expect(listingIdIn("https://www.moveazy.co.in/property/MZ-FQ5U48")).toBe("MZ-FQ5U48");
    expect(listingIdIn("have a look at mz-rpn52s")).toBe("MZ-RPN52S");
    expect(listingIdIn("HSR 2 BHK")).toBe("");
    expect(listingIdIn(null)).toBe("");
  });
});
