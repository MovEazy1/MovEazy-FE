import { describe, expect, it } from "vitest";
import {
  autoFill, backupsFor, flatLine, freshPicks, keyToSlug, likedFlats, listUpdatedMessage, listsFor, matcherTenants, slugToKey, splitTenants, visitsMessage,
} from "./partnerMatcher";

const flat = (id, o = {}) => ({ property_id: id, area: "HSR Layout", rent: 30000, flat_type: "2 BHK", status: "published", ...o });

describe("matcherTenants", () => {
  const leads = [{ id: "L1", name: "Om", status: "active" }, { id: "L2", name: "Gone", status: "closed" }];
  const assigned = [
    { id: "A1", name: "Riya", phone: "9111111111", status: "contacted", localities: ["HSR Layout"], flat_types: ["2 BHK"], budget_max: 40000 },
    { id: "A2", name: "Done", status: "closed" },
    { id: "A3", name: "No", status: "not_interested" },
  ];
  const t = matcherTenants(leads, assigned);
  it("MovEazy's open tenants first, then the broker's own open clients", () => {
    expect(t.map((x) => x.key)).toEqual(["asg:A1", "lead:L1"]);
  });
  it("a MovEazy tenant carries the assignment and their requirement", () => {
    expect(t[0]).toMatchObject({ kind: "moveazy", assignment_id: "A1", name: "Riya", localities: ["HSR Layout"], budget_max: 40000 });
  });
  it("keys round-trip through the URL", () => {
    expect(slugToKey(keyToSlug("asg:A1"))).toBe("asg:A1");
    expect(slugToKey("lead-L1")).toBe("lead:L1");
  });
});

describe("lists, likes and the two tabs", () => {
  const riya = { kind: "moveazy", assignment_id: "A1", key: "asg:A1" };
  const om = { kind: "own", lead_id: "L1", key: "lead:L1" };
  const neha = { kind: "own", lead_id: "L9", key: "lead:L9" };
  const lists = [
    { id: "X1", assignment_id: "A1", created_at: "2026-10-01", property_ids: ["MZ-1", "MZ-2"],
      actions: { "MZ-1": { action: "liked", at: "2026-10-02" }, "MZ-2": { action: "skipped", at: "2026-10-02" } } },
    { id: "X2", assignment_id: "A1", created_at: "2026-10-05", property_ids: ["MZ-3", "MZ-4"],
      actions: { "MZ-3": { action: "liked", at: "2026-10-06" } } },
    { id: "X3", lead_id: "L1", created_at: "2026-10-03", property_ids: ["MZ-5"], actions: {} },
  ];
  it("a tenant's lists, newest first", () => expect(listsFor(riya, lists).map((l) => l.id)).toEqual(["X2", "X1"]));
  it("liked flats across their lists, latest first", () => {
    expect(likedFlats(listsFor(riya, lists)).map((l) => l.property_id)).toEqual(["MZ-3", "MZ-1"]);
  });
  it("Fresh: never sent a list. Existing: sent one", () => {
    const { fresh, existing } = splitTenants([riya, om, neha], lists);
    expect(fresh.map((t) => t.key)).toEqual(["lead:L9"]);
    expect(existing.map((t) => t.key)).toEqual(["asg:A1", "lead:L1"]);
  });
});

describe("freshPicks", () => {
  const lead = { localities: ["HSR Layout"], flat_types: ["2 BHK"], budget_max: 40000 };
  const homes = [
    ...Array.from({ length: 6 }, (_, i) => flat(`S${i}`)),                             // strong
    flat("NEAR-AREA", { rent: 43000 }),                                                // in HSR, just over budget → still strong (half budget)
    flat("NEAR-BHK", { area: "Bellandur" }),                                           // right BHK, wrong area
    flat("FAR", { area: "Whitefield", flat_type: "4 BHK", rent: 90000 }),              // nothing in common
    flat("GONE", { status: "rented" }),
    flat("SEEN"),
  ];
  it("never a flat in the exclude set, nor one that's let out", () => {
    const { picks } = freshPicks(lead, homes, new Set(["SEEN"]));
    const ids = picks.map((m) => m.listing.property_id);
    expect(ids).not.toContain("SEEN");
    expect(ids).not.toContain("GONE");
  });
  it("strong matches first, then near ones marked as such, never unrelated flats", () => {
    const { picks, strong, near } = freshPicks(lead, homes, new Set(["SEEN"]));
    const ids = picks.map((m) => m.listing.property_id);
    expect(ids).not.toContain("FAR");
    expect(ids).toContain("NEAR-BHK");
    expect(picks.find((m) => m.listing.property_id === "NEAR-BHK").near).toBe(true);
    expect(strong + near).toBe(picks.length);
    expect(picks.slice(0, strong).every((m) => !m.near)).toBe(true);
  });
  it("stops at ten", () => {
    const many = Array.from({ length: 25 }, (_, i) => flat(`M${i}`));
    expect(freshPicks(lead, many).picks).toHaveLength(10);
  });
  it("nothing for a tenant with no requirement", () => expect(freshPicks({}, homes).picks).toEqual([]));
});

describe("messages", () => {
  it("lists the liked flats and asks for a time", () => {
    const m = visitsMessage("Riya Sharma", [flat("A", { rent: 41000 }), flat("B", { area: "Bellandur" })]);
    expect(m.startsWith("Hi Riya, you liked these homes:\n1. 2 BHK · HSR Layout · ₹41,000\n2. 2 BHK · Bellandur · ₹30,000")).toBe(true);
    expect(m).toMatch(/day and time/);
  });
  it("one flat reads as one", () => expect(visitsMessage("", [flat("A")])).toMatch(/^Hi, you liked this home:/));
  it("flatLine", () => expect(flatLine({ bedrooms: 3, area: "HSR", rent: 0 })).toBe("3 BHK · HSR"));
});

describe("the shortlist screen", () => {
  it("backups: the next best, never what's on the list or taken off", () => {
    const ranked = ["A", "B", "C", "D", "E", "F"];
    expect(backupsFor(ranked, ["A", "B"], ["C"], 2)).toEqual(["D", "E"]);
    expect(backupsFor(ranked, ranked)).toEqual([]);
  });
  it("auto-fill tops the list back up to ten, in the AI's order", () => {
    expect(autoFill(["A", "B"], ["X", "Y", "Z"], 4)).toEqual(["A", "B", "X", "Y"]);
    expect(autoFill(["A", "B"], [], 4)).toEqual(["A", "B"]);
    expect(autoFill(["A", "B", "C"], ["X"], 2)).toEqual(["A", "B", "C"]);
  });
  it("tells the tenant their list changed", () => {
    expect(listUpdatedMessage("Riya Sharma", "https://x/c/1", 2)).toBe("Hi Riya, I've added 2 new homes to your list. Have a look and tap ♥ on the ones you like:\nhttps://x/c/1");
    expect(listUpdatedMessage("", "u", 0)).toMatch(/^Hi, I've updated your list\./);
    expect(listUpdatedMessage("A", "u", 1)).toMatch(/1 new home to/);
  });
  it("a flat flagged as rented is never suggested", () => {
    const lead = { localities: ["HSR Layout"], flat_types: ["2 BHK"], budget_max: 40000 };
    const { picks } = freshPicks(lead, [flat("OK"), flat("GONE", { rent_flag: "potentially_rented" })]);
    expect(picks.map((m) => m.listing.property_id)).toEqual(["OK"]);
  });
});
