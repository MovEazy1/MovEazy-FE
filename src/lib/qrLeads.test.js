import { describe, expect, it } from "vitest";
import { addBrowse, noteBrowse, readBrowse, visitMessage } from "./qrLeads";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe("what the tenant looked at", () => {
  it("starts empty and survives junk", () => {
    const s = memory();
    expect(readBrowse("ASHA01", s)).toEqual({ filters: [], opened: [], visits: [] });
    s.setItem("mz_qr_browse:ASHA01", "{not json");
    expect(readBrowse("ASHA01", s)).toEqual({ filters: [], opened: [], visits: [] });
  });
  it("adds without repeats, newest last, and ignores the All chip", () => {
    let b = { filters: [], opened: [], visits: [] };
    b = addBrowse(b, "filters", "2 BHK");
    b = addBrowse(b, "filters", "all");
    b = addBrowse(b, "opened", "P1");
    b = addBrowse(b, "opened", "P2");
    b = addBrowse(b, "opened", "P1");
    expect(b).toEqual({ filters: ["2 BHK"], opened: ["P2", "P1"], visits: [] });
    expect(addBrowse(b, "nonsense", "x")).toBe(b);
  });
  it("is kept per broker code, case-insensitively", () => {
    const s = memory();
    noteBrowse("asha01", "visits", "P9", s);
    expect(readBrowse("ASHA01", s).visits).toEqual(["P9"]);
    expect(readBrowse("RAVI02", s).visits).toEqual([]);
  });
  it("keeps at most 40", () => {
    let b = { filters: [], opened: [], visits: [] };
    for (let i = 0; i < 50; i += 1) b = addBrowse(b, "opened", `P${i}`);
    expect(b.opened).toHaveLength(40);
    expect(b.opened.at(-1)).toBe("P49");
  });
});

describe("visitMessage", () => {
  it("names the flat they asked about", () => {
    expect(visitMessage("Asha Rao", { flat_type: "2 BHK", area: "HSR Layout", rent: 25000 }))
      .toBe("Hi Asha, I requested a visit for the 2 BHK in HSR Layout (₹25,000) on MovEazy. When can I come and see it?");
    expect(visitMessage("", {})).toBe("Hi there, I requested a visit for the flat on MovEazy. When can I come and see it?");
  });
});

describe("hotspotCells", () => {
  it("groups check-ins within about a kilometre and keeps cells with 2 or more", async () => {
    const { hotspotCells } = await import("./qrLeads");
    const z = hotspotCells([
      { lat: 12.9116, lng: 77.6474, locality: "HSR Layout" },
      { lat: 12.9118, lng: 77.6476, locality: "HSR Layout" },
      { lat: 12.9119, lng: 77.6473, locality: "" },
      { lat: 12.9698, lng: 77.75, locality: "Whitefield" },
    ]);
    expect(z).toHaveLength(1);
    expect(z[0].count).toBe(3);
    expect(z[0].localities).toEqual(["HSR Layout"]);
  });
});
