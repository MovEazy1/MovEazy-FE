import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: null }));
const {
  NO_BUDGET, POOLS, bracketsFor, clientIn, flatIn, flatPool, followUp, freshFor, isHot, isSilent, lastSignal, morningPicks,
  placeClient, poolOf, scorecard, sentTo, suggestions,
} = await import("./crmPriority");

const NOW = new Date("2026-10-15T10:00:00").getTime();
const hAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const dAgo = (d) => hAgo(d * 24);
const facts = (types, max, min = null) => ({ flat_types: { value: types }, budget: { max, min } });
const ids = (...x) => new Set(x);

describe("pools and brackets", () => {
  it("reads the pool from a flat type, 4+ as one pool", () => {
    expect(["1 BHK", "2BHK", "3 bhk", "4 BHK", "5 BHK", "4+ BHK", "1 RK", "Villa", ""].map(poolOf))
      .toEqual(["1", "2", "3", "4", "4", "4", null, null, null]);
    expect(flatPool({ flat_type: "", bedrooms: 2 })).toBe("2");
  });
  it("has the brackets asked for", () => {
    expect(POOLS.map((p) => p.brackets.map((x) => x.label))).toEqual([
      ["< 20k", "20–25k", "25–30k", "> 30k"],
      ["< 35k", "35–40k", "40–45k", "45–50k", "50–55k", "55–60k", "> 60k"],
      ["< 50k", "50–60k", "60–70k", "70–80k", "80–90k", "> 90k"],
      ["All 4 BHK"],
    ]);
  });
  it("puts a value in its bracket with 2k either side", () => {
    expect(bracketsFor("1", 22500)).toEqual(["20000-25000"]);
    expect(bracketsFor("1", 23000)).toEqual(["20000-25000", "25000-30000"]); // exactly 2k from 25k counts
    expect(bracketsFor("1", 21000)).toEqual(["0-20000", "20000-25000"]);
    expect(bracketsFor("1", 31500)).toEqual(["25000-30000", "30000-Infinity"]);
    expect(bracketsFor("2", 70000)).toEqual(["60000-Infinity"]);
  });
  it("places a client in every pool they want, by their max budget", () => {
    const p = placeClient(facts(["1 BHK", "2 BHK", "1 RK"], 30000, 22000));
    expect(p.pools).toEqual(["1", "2"]);
    expect(p.brackets["1"]).toEqual(["25000-30000", "30000-Infinity"]);
    expect(p.brackets["2"]).toEqual(["0-35000"]);
    expect(clientIn(p, "1", ids("25000-30000"))).toBe(true);
    expect(clientIn(p, "1", ids("20000-25000"))).toBe(false);
    expect(placeClient(facts(["2 BHK"], null)).brackets["2"]).toEqual([NO_BUDGET]);
  });
  it("puts a flat in by rent", () => {
    const l = { flat_type: "2 BHK", rent: 41000 };
    expect(flatIn(l, "2", ids("40000-45000"))).toBe(true);
    expect(flatIn(l, "2", ids("35000-40000"))).toBe(true); // 41k is within 2k of 40k
    expect(flatIn(l, "2", ids("45000-50000"))).toBe(false);
    expect(flatIn(l, "1", ids("30000-Infinity"))).toBe(false);
  });
});

describe("follow-ups", () => {
  it("uses their follow-up date when set", () => {
    expect(followUp({ next_follow_up_at: hAgo(-2) }, 0, NOW).due).toBe(true);
    expect(followUp({ next_follow_up_at: dAgo(-2) }, 0, NOW).due).toBe(false);
    expect(followUp({ next_follow_up_at: dAgo(2) }, 0, NOW)).toMatchObject({ due: true, overdue: true });
  });
  it("otherwise, every 2 days since we last reached them", () => {
    expect(followUp({}, 0, NOW)).toMatchObject({ due: true, why: "Never contacted" });
    expect(followUp({}, new Date(dAgo(1)).getTime(), NOW).due).toBe(false);
    expect(followUp({}, new Date(dAgo(2)).getTime(), NOW)).toMatchObject({ due: true, overdue: false });
    expect(followUp({}, new Date(dAgo(4)).getTime(), NOW)).toMatchObject({ due: true, overdue: true });
  });
});

describe("flats for a client", () => {
  const placed = placeClient(facts(["2 BHK"], 40000));
  const flat = (id, rent, created, over = {}) => ({ property_id: id, flat_type: "2 BHK", rent, status: "published", created_at: created, ...over });
  const inventory = [
    flat("A", 39000, hAgo(5)), flat("B", 41000, hAgo(30)), flat("C", 52000, hAgo(2)),
    flat("D", 38000, dAgo(10)), flat("E", 39500, hAgo(3), { status: "rented" }), flat("F", 36000, hAgo(1)),
  ];
  const shortlists = [{ client_id: "c1", property_id: "F", shared_at: dAgo(2) }, { client_id: "c2", property_id: "A", shared_at: hAgo(1) }];
  const sent = sentTo("c1", shortlists);
  it("knows what was sent and when", () => {
    expect([...sent.ids]).toEqual(["F"]);
    expect(sent.last).toBe(new Date(dAgo(2)).getTime());
  });
  it("new since the last list: fits, unsent, live, newest first", () => {
    expect(freshFor({ inventory, placed, req: null, sent, now: NOW }).map((l) => l.property_id)).toEqual(["A", "B"]);
  });
  it("this morning: fits added in the last day", () => {
    expect(morningPicks({ inventory, placed, req: null, sent, now: NOW }).map((l) => l.property_id)).toEqual(["A"]);
  });
});

describe("signals", () => {
  const shortlists = [{ client_id: "c1", status: "liked", reacted_at: hAgo(5), opened_at: hAgo(6) }];
  const touches = [{ client_id: "c1", actor_email: "", type: "visit", created_at: hAgo(10) }, { client_id: "c1", actor_email: "a@x", type: "call", created_at: hAgo(1) }];
  it("takes their latest own move, never ours", () => {
    expect(lastSignal("c1", { shortlists, touches })).toEqual({ at: new Date(hAgo(5)).getTime(), label: "Liked a flat" });
    expect(lastSignal("c2", { shortlists, touches })).toBe(null);
  });
  it("hot within 3 days; silent after 7 days of nothing since we reached out", () => {
    expect(isHot({ at: new Date(hAgo(70)).getTime() }, NOW)).toBe(true);
    expect(isHot({ at: new Date(hAgo(80)).getTime() }, NOW)).toBe(false);
    expect(isSilent(null, new Date(dAgo(8)).getTime(), NOW)).toBe(true);
    expect(isSilent({ at: new Date(dAgo(9)).getTime() }, new Date(dAgo(8)).getTime(), NOW)).toBe(true);
    expect(isSilent({ at: new Date(dAgo(1)).getTime() }, new Date(dAgo(8)).getTime(), NOW)).toBe(false);
    expect(isSilent(null, new Date(dAgo(3)).getTime(), NOW)).toBe(false);
  });
});

it("scores today per agent", () => {
  const touches = [
    { client_id: "c1", actor_email: "a@x", type: "call", created_at: hAgo(1) },
    { client_id: "c1", actor_email: "a@x", type: "whatsapp", created_at: hAgo(2) },
    { client_id: "c2", actor_email: "a@x", type: "note", created_at: hAgo(1) },
    { client_id: "c3", actor_email: "b@x", type: "call", created_at: dAgo(1.5) },
  ];
  const shortlists = [{ client_id: "c1", shared_by: "a@x", shared_at: hAgo(1) }, { client_id: "c1", shared_by: "a@x", shared_at: hAgo(1) }];
  const clients = [{ id: "c9", status: "closed_by_us", closed_at: hAgo(3) }];
  expect(scorecard({ touches, shortlists, clients, priorityIds: ids("c1"), now: NOW }))
    .toEqual({ agents: [{ who: "a@x", contacted: 1, priority: 1, lists: 1 }], closures: 1 });
});

it("suggests hot, active or soon-moving clients not in Priority yet", () => {
  const clients = [
    { id: "c1", phone: "9845012345", temperature: "fire" },
    { id: "c2", phone: "9845012346" },
    { id: "c3", phone: "9845012347", status: "closed_by_us", temperature: "fire" },
    { id: "c4", phone: "", temperature: "hot" },
    { id: "c5", phone: "9845012348", temperature: "hot" },
  ];
  const out = suggestions({
    clients, priorityIds: ids("c5"), now: NOW,
    signalOf: (id) => (id === "c2" ? { at: new Date(hAgo(5)).getTime(), label: "Liked a flat" } : null),
    moveInOf: () => null,
  });
  expect(out.map((x) => [x.c.id, x.why])).toEqual([["c1", ["On fire"]], ["c2", ["Liked a flat"]]]);
});
