// @vitest-environment jsdom
/**
 * The Tenant views screen with a real overview: the numbers, scans by day,
 * how tenants found the flats, the people — tapping one who gave contact shows
 * their mobile, Call and WhatsApp, profile and what they opened; one who came
 * via the MovEazy website shows no number. Matching tenants are a count only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OVERVIEW = {
  scans: 1234, week: 56, people: 2, visited: 1, moveazy: 1, liked: 2, disliked: 1, reasons: [{ reason: "ventilation", n: 1 }],
  by_day: Array.from({ length: 14 }, (_, k) => ({ day: `2026-10-${String(15 + k).padStart(2, "0")}`, scans: k === 13 ? 7 : k === 12 ? 3 : 1 })),
  by_place: [
    { kind: "flat", ref: "MZ-1", name: null, scans: 900, week: 40, people: 1 },
    { kind: "building", ref: "b-1", name: "Sunrise Residency", scans: 334, week: 16, people: 1 },
  ],
  list: [
    { key: "u-ravi", user_id: "u-ravi", name: "Ravi Kumar", phone: "9845012345", email: "ravi@x.in", at: "2026-10-26T10:00:00Z", visit: true,
      profile: { company: "Flipkart", past_company: "", first_job: false, college: "IIT Madras", graduation_year: 2019,
        linkedin: "https://www.linkedin.com/in/ravi-k", in_bangalore_since: "2020", score: 82 },
      places: [{ kind: "flat", ref: "MZ-1", at: "2026-10-26T10:00:00Z", hits: 3, visit: true }] },
    { key: "tel:9811144455", user_id: null, name: "Asha Caller", phone: "9811144455", email: "", at: "2026-10-25T10:00:00Z", visit: false,
      profile: null, places: [{ kind: "building", ref: "b-1", at: "2026-10-25T10:00:00Z", hits: 0, visit: false, called: ["caretaker"] }],
      feedback: [{ kind: "pay_token", note: "", at: "2026-10-25T10:05:00Z", ref: "b-1" }, { kind: "other", note: "No lift?", at: "2026-10-25T10:04:00Z", ref: "b-1" }],
      status: { visit: "done", liked: "liked", liked_status: "will_pay_token", reasons: [], at: "2026-10-26T10:00:00Z" } },
    { key: "m-neha", user_id: null, name: "Neha Web", phone: "", email: "", at: "2026-10-24T10:00:00Z", visit: false, via: "moveazy",
      profile: null, places: [{ kind: "flat", ref: "MZ-1", at: "2026-10-24T10:00:00Z", hits: 4, visit: false }],
      status: { visit: "", liked: "liked", liked_status: "", reasons: [], at: "2026-10-24T11:00:00Z" } },
    { key: "tel:9811122233", user_id: null, name: "Walk In", phone: "9811122233", email: "", at: "2026-10-20T10:00:00Z", visit: false,
      profile: null, places: [{ kind: "building", ref: "b-1", at: "2026-10-20T10:00:00Z", hits: 2, visit: false }] },
  ],
};
vi.mock("../../lib/flatInsights", () => ({ fetchQrOverview: vi.fn(async () => OVERVIEW) }));
vi.mock("../../lib/ownerMatches", () => ({
  countMatchingTenants: vi.fn(async () => ({ total: 17, byProperty: new Map([["MZ-1", 12]]) })),
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "o1" }, loading: false }) }));

const { OwnerContext } = await import("./OwnerApp");
const QrScans = (await import("./QrScans")).default;

const flat = { property_id: "MZ-1", status: "published", title: "2 BHK in HSR Layout", area: "HSR Layout", flat_type: "2 BHK", rent: 30000 };
const ctx = { properties: [flat], tenants: [], byId: new Map([[flat.property_id, flat]]) };

let root, host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<MemoryRouter><OwnerContext.Provider value={ctx}><QrScans /></OwnerContext.Provider></MemoryRouter>);
  });
  await act(async () => {});
  return document.body;
}

describe("QR scans", () => {
  it("shows every scan, this week, contacts, visits and matching tenants", async () => {
    const page = await mount();
    const text = page.textContent;
    expect(text).toContain("1,234");
    expect(text).toContain("+56 this week");
    expect(text).toMatch(/2\s*Gave contact/);
    expect(text).toMatch(/1\s*Via MovEazy Website/);
    expect(text).toContain("Tenant views");
    expect(text).toContain("How tenants found your flats");
    expect(text).toMatch(/2\s*liked/);
    expect(text).toContain("Ventilation issue · 1");
    expect(text).toMatch(/1\s*Booked a visit/);
    expect(text).toMatch(/17\s*Matching tenants/);
    // Day by day, not property by property.
    expect(text).toContain("Scans by day");
    expect(text).not.toContain("By property");
    expect(text).not.toContain("12 matching");
    expect(text).toMatch(/7\s*scans · Today/);
    expect(text).toContain("Yesterday 3");
    expect(page.querySelectorAll(".qs-bars button").length).toBe(14);
    expect(text).toContain("Ravi Kumar");
    expect(text).toContain("Walk In");
    // A match is a count: no matching tenant's name or number anywhere.
    expect(text).not.toMatch(/Seeker #/);
  });

  it("tapping a person shows their contact, profile and what they opened", async () => {
    const page = await mount();
    const ravi = [...page.querySelectorAll("button")].find((b) => b.textContent.includes("Ravi Kumar"));
    await act(async () => ravi.click());
    const sheet = page.querySelector("[role=dialog]");
    expect(sheet.textContent).toContain("9845012345");
    expect(sheet.querySelector('a[href="tel:+919845012345"]')).toBeTruthy();
    expect(sheet.querySelector('a[href^="https://wa.me/919845012345"]')).toBeTruthy();
    expect(sheet.textContent).toContain("Flipkart");
    expect(sheet.textContent).toContain("IIT Madras, 2019");
    expect(sheet.querySelector('a[href="https://www.linkedin.com/in/ravi-k"]')).toBeTruthy();
    expect(sheet.textContent).toContain("Opened 3×");
  });

  it("a Call Caretaker tenant: who they called and what they said after", async () => {
    const page = await mount();
    const row = [...page.querySelectorAll("button")].find((b) => b.textContent.includes("Asha Caller"));
    expect(row.textContent).toContain("Pay Token");
    await act(async () => row.click());
    const sheet = page.querySelector("[role=dialog]");
    expect(sheet.textContent).toContain("Called the caretaker");
    expect(sheet.textContent).toContain("What they said after calling");
    expect(sheet.textContent).toContain('"No lift?"');
    expect(sheet.textContent).toContain("Where they stand");
    expect(sheet.textContent).toContain("Liked · Will pay token");
    expect(sheet.querySelector('a[href="tel:+919811144455"]')).toBeTruthy();
  });

  it("a tenant via the MovEazy website: tagged, where they stand, never a number", async () => {
    const page = await mount();
    const row = [...page.querySelectorAll("button")].find((b) => b.textContent.includes("Neha Web"));
    expect(row.textContent).toContain("MovEazy Website");
    expect(row.textContent).toContain("Liked");
    await act(async () => row.click());
    const sheet = page.querySelector("[role=dialog]");
    expect(sheet.textContent).toContain("Viewed on the MovEazy website");
    expect(sheet.querySelector('a[href^="tel:"]')).toBeNull();
    expect(sheet.textContent).toContain("Where they stand");
  });

  it("filters to MovEazy website tenants", async () => {
    const page = await mount();
    const chip = [...page.querySelectorAll("button")].find((b) => b.textContent === "Via MovEazy Website");
    await act(async () => chip.click());
    expect(page.textContent).toContain("Neha Web");
    expect(page.textContent).not.toContain("Walk In");
  });

  it("filters to people who booked a visit", async () => {
    const page = await mount();
    const chip = [...page.querySelectorAll("button")].find((b) => b.textContent === "Booked a visit");
    await act(async () => chip.click());
    expect(page.textContent).toContain("Ravi Kumar");
    expect(page.textContent).not.toContain("Walk In");
  });
});
