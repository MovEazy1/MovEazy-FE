import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_READS, thumbUrl, withPageData } from "./share.js";
import { takePageData } from "../src/lib/pageData.js";

const B = "https://x.supabase.co/storage/v1/object/public/listings/";
const SHELL = `<html><head><link rel="modulepreload" crossorigin href="/assets/a.js"></head><body><div id="root"></div></body></html>`;

describe("ad and building pages: the first photo and the data inside the page", () => {
  it("the photo each page puts at the top", () => {
    expect(PAGE_READS.building.lead({ photos: [`${B}b/1.jpg`], flats: [{ images: [`${B}f/1.jpg`] }] })).toBe(`${B}b/1.jpg`);
    expect(PAGE_READS.building.lead({ photos: [], flats: [{ images: [`${B}f/tour.mp4`, `${B}f/1.jpg`] }] })).toBe(`${B}f/1.jpg`);
    expect(PAGE_READS.building.lead({ cover_video: "v.mp4", photos: [`${B}b/1.jpg`] })).toBe("");
    expect(PAGE_READS["visit-b"].lead({ photos: [`${B}b/2.jpg`] })).toBe(`${B}b/2.jpg`);
    // A typed cover leads a flat's gallery; a made (framed) one doesn't.
    expect(PAGE_READS.visit.lead({ cover_image_url: `${B}c.jpg`, images: [`${B}1.jpg`] })).toBe(`${B}c.jpg`);
    expect(PAGE_READS.visit.lead({ cover_image_url: `${B}x/cover-123.jpg`, images: [`${B}1.jpg`] })).toBe(`${B}1.jpg`);
  });
  it("only real codes are looked up", () => {
    expect(PAGE_READS.building.ok("H33PSH")).toBe(true);
    expect(PAGE_READS.building.ok("H33PSH' or 1=1")).toBe(false);
    expect(PAGE_READS.visit.ok("MZ-LTQJ2A")).toBe(true);
  });
  it("adds the preload (the 480 px copy) and the data; scripts behind", () => {
    const html = withPageData(SHELL, "building_page:H33PSH", { name: "BR </script> Homes" }, `${B}b/1.jpg`);
    expect(html).toContain(`<link rel="preload" as="image" href="${thumbUrl(`${B}b/1.jpg`)}" fetchpriority="high">`);
    expect(html).toContain('modulepreload" fetchpriority="low"');
    expect(html).not.toContain("BR </script>");
    const data = JSON.parse(html.match(/window\.__MZ_PAGE__=(.*?);<\/script>/)[1]);
    expect(data).toEqual({ key: "building_page:H33PSH", data: { name: "BR </script> Homes" } });
  });
});

describe("the ad page drawn before the app", () => {
  it("photo, title, rent, deposit, facts and the button, as VisitAdPage writes them", async () => {
    const { adPrepaint } = await import("./_adPrepaint.js");
    const html = adPrepaint("flat", { flat_type: "1 BHK", furnishing: "Semi Furnished", area: "HSR", rent: 26000, deposit: 100000, bedrooms: 1, bathrooms: 1 },
      [`${B}1.jpg`, `${B}2.jpg`], thumbUrl(`${B}1.jpg`));
    expect(html).toContain("<h1>1 BHK · Semi Furnished</h1>");
    expect(html).toContain("<b>₹26,000</b><small> / month</small>");
    expect(html).toContain("<small>Deposit</small><b>₹1L</b>");
    expect(html).toContain("1 bed</span>");
    expect(html).toContain('<div class="va-gcount">1 / 2</div>');
    expect(html).toContain(`<img src="${thumbUrl(`${B}1.jpg`)}"`);
    expect(html).toContain("Schedule a visit");
  });
  it("a building's ad page: its name and rent from", async () => {
    const { adPrepaint } = await import("./_adPrepaint.js");
    const html = adPrepaint("building", { name: "BR <Homes>", area: "HSR", rent_from: 18000, flat_types: ["1 BHK", "2 BHK"] }, [], "");
    expect(html).toContain("<h1>BR &lt;Homes&gt;</h1>");
    expect(html).toContain("From <b>₹18,000</b>");
    expect(html).toContain("va-gallery--none");
  });
});

describe("the building and broker pages drawn before the app", () => {
  it("a building: name, where, available of total, rent from, floors, amenities", async () => {
    const { buildingPrepaint } = await import("./_buildingPrepaint.js");
    const html = buildingPrepaint({ name: "BR Homes", area: "HSR", landmark: "Sector 2", total_floors: 5, total_flats: 42, amenities: ["Lift"],
      flats: [{ available: true, rent: 27000 }, { available: true, rent: 35000 }, { available: false, rent: 20000 }] }, [`${B}1.jpg`, `${B}2.jpg`], `${B}t.jpg`);
    expect(html).toContain("<h1>BR Homes</h1>");
    expect(html).toContain("HSR · Sector 2");
    expect(html).toContain("<b>2</b><span>of 42 flats available</span>");
    expect(html).toContain("<b>₹27k+</b><span>rent from / month</span>");
    expect(html).toContain("<b>G+5</b><span>floors</span>");
    expect(html).toContain("Lift</span>");
    expect(html).toContain('<div class="bp-gcount">1 / 2</div>');
  });
  it("a broker: card, rating or new, contact, chips and the first homes", async () => {
    const { storefrontPrepaint } = await import("./_storefrontPrepaint.js");
    const html = storefrontPrepaint({ broker: { name: "yatharth singh", phone: "+91 89898 98989", rating: 4.8 },
      homes: [{ property_id: "MZ-1", rent: 33000, flat_type: "2 BHK", area: "HSR Layout", furnishing: "Semi Furnished", property_type: "Apartment" },
        { property_id: "MZ-2", rent: 20000, flat_type: "1 BHK", area: "HSR" }] }, () => `${B}t.jpg`);
    expect(html).toContain("<h1>yatharth singh</h1>");
    expect(html).toContain(">YS</span>");
    expect(html).toContain("<b>4.8</b>");
    expect(html).toContain("89898 98989");
    expect(html).toContain('<span class="sf-chip on">All 2</span><span class="sf-chip">1 BHK</span><span class="sf-chip">2 BHK</span>');
    expect(html).toContain("₹33,000 <small>/ month</small>");
    expect(html.match(/<img src="[^"]*t\.jpg"/g)).toHaveLength(1);
  });
});

describe("a partner's shortlist", () => {
  afterEach(() => vi.unstubAllGlobals());
  const list = { lead_name: "Ravi Kumar", known: false, broker: { name: "Kiran Realty" }, homes: [{ property_id: "MZ-1" }, { property_id: "MZ-2" }] };
  it("the first-visit form, drawn: header, the partner's words, no live fields", async () => {
    const { curatedPrepaint, withCuratedPrepaint } = await import("./_curatedPrepaint.js");
    const html = curatedPrepaint(list);
    expect(html).toContain("<b>Kiran Realty</b><span>picked 2 homes for you, Ravi</span>");
    expect(html).toContain("Kiran sees the homes you like");
    expect(html).not.toMatch(/<input|<form|<button/);
    const page = withCuratedPrepaint(SHELL.replace("<body>", "<body>"), "ab".repeat(16), list);
    expect(page).toContain('localStorage.getItem("mz_curated_' + "ab".repeat(16) + '")');
  });
  it("opened once, on the person's behalf only — and handed to the page", async () => {
    process.env.VITE_SUPABASE_URL = "https://x.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "k";
    vi.resetModules();
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (u) => { calls.push(String(u)); return String(u).endsWith("/app.html") ? new Response(SHELL) : new Response(JSON.stringify(list)); }));
    const { default: handler } = await import("./share.js");
    const tok = "ab".repeat(16);
    const person = await (await handler(new Request(`https://www.moveazy.co.in/api/share?kind=c&id=${tok}`, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile" } }))).text();
    expect(calls.filter((u) => u.endsWith("/rpc/partner_curated_open"))).toHaveLength(1);
    expect(person).toContain(`"key":"partner_curated_open:${tok}"`);
    expect(person).toContain("Your homes are ready");
    calls.length = 0;
    await handler(new Request(`https://www.moveazy.co.in/api/share?kind=c&id=${tok}`, { headers: { "user-agent": "WhatsApp/2.23" } }));
    expect(calls.some((u) => u.endsWith("/rpc/partner_curated_open"))).toBe(false);
    delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  });
});

describe("our team's shortlist (/curated/<token>)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const tok = `mz${"ab".repeat(12)}`;
  const open = { ok: true, client_name: "Ravi Kumar", agent_name: "Asha", property_ids: ["MZ-1", "MZ-2", "MZ-GONE", "MZ-3"], reactions: { "MZ-1": "liked" } };
  const rows = [
    { property_id: "MZ-3", rent: 30000, flat_type: "1 BHK" },
    { property_id: "MZ-2", rent: 41000, flat_type: "2 BHK", furnishing: "Semi-furnished", bedrooms: 2, bathrooms: 2, floor_number: 3, area: "HSR Layout", is_verified: true, amenities: ["Lift", "Gym"], images: [`${B}a/v.mp4`, `${B}a/1.jpg`] },
    { property_id: "MZ-1", rent: 25000, flat_type: "1 BHK" },
  ];
  it("opens on the first home not yet answered, in the list's order", async () => {
    const { teamCuratedPrepaint, teamListRows, teamListStart, teamCardPhoto } = await import("./_teamCuratedPrepaint.js");
    const list = teamListRows(open, rows);
    expect(list.map((r) => r.property_id)).toEqual(["MZ-1", "MZ-2", "MZ-3"]);
    expect(teamListStart(open, list)).toBe(1);
    expect(teamCardPhoto(list[1])).toBe(`${B}a/1.jpg`);
    const html = teamCuratedPrepaint(open, list, "p.jpg");
    expect(html).toContain("3 homes shortlisted for you");
    expect(html).toContain("Picked by Asha · MovEazy");
    expect(html).toContain("Ravi, we found these for you");
    expect(html).toContain("Viewing 2 out of 3 shortlisted properties");
    expect(html).toContain("₹41,000");
    expect(html).toContain("2 BHK · Semi-furnished");
    expect(html).toContain("Floor 3");
    expect(html).not.toMatch(/<input|<form|<button/);
  });
  it("opened once, for a person only — the open and the homes handed to the page", async () => {
    process.env.VITE_SUPABASE_URL = "https://x.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "k";
    vi.resetModules();
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (u) => {
      calls.push(String(u));
      if (String(u).endsWith("/app.html")) return new Response(SHELL);
      return new Response(JSON.stringify(String(u).includes("/rest/v1/inventory") ? rows : open));
    }));
    const { default: handler } = await import("./share.js");
    const person = await (await handler(new Request(`https://www.moveazy.co.in/api/share?kind=curated&id=${tok}`, { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile" } }))).text();
    expect(calls.filter((u) => u.endsWith("/rpc/curated_share_open"))).toHaveLength(1);
    expect(calls.find((u) => u.includes("/rest/v1/inventory"))).toContain(encodeURIComponent('"MZ-1","MZ-2","MZ-GONE","MZ-3"'));
    expect(person).toContain(`"key":"curated_share_open:${tok}"`);
    expect(person).toContain("Ravi, we found these for you");
    expect(person).toContain(`href="${thumbUrl(`${B}a/1.jpg`)}" fetchpriority="high"`);
    calls.length = 0;
    const robot = await (await handler(new Request(`https://www.moveazy.co.in/api/share?kind=curated&id=${tok}`, { headers: { "user-agent": "WhatsApp/2.23" } }))).text();
    expect(calls.some((u) => u.includes("/rpc/"))).toBe(false);
    expect(robot).not.toContain("__MZ_PAGE__");
    delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  });
});

describe("the page takes it once", () => {
  afterEach(() => { delete globalThis.window; });
  it("for its own read only", () => {
    globalThis.window = { __MZ_PAGE__: { key: "visit_ad_page:flat:MZ-LTQJ2A", data: { rent: 1 } } };
    expect(takePageData("building_page:H33PSH")).toBeUndefined();
    expect(takePageData("visit_ad_page:flat:mz-ltqj2a")).toEqual({ rent: 1 });
    expect(takePageData("visit_ad_page:flat:mz-ltqj2a")).toBeUndefined();
  });
});

describe("the handler", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("a person gets the page with its data; a robot the preview tags", async () => {
    process.env.VITE_SUPABASE_URL = "https://x.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "k";
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async (u) => (String(u).endsWith("/app.html")
      ? new Response(SHELL) : new Response(JSON.stringify({ name: "BR Homes", photos: [`${B}b/1.jpg`], flats: [] })))));
    const { default: handler } = await import("./share.js");
    const person = await (await handler(new Request("https://www.moveazy.co.in/api/share?kind=building&id=H33PSH", { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile" } }))).text();
    expect(person).toContain("window.__MZ_PAGE__=");
    expect(person).toContain(thumbUrl(`${B}b/1.jpg`));
    const robot = await (await handler(new Request("https://www.moveazy.co.in/api/share?kind=building&id=H33PSH", { headers: { "user-agent": "facebookexternalhit/1.1" } }))).text();
    expect(robot).not.toContain("__MZ_PAGE__");
    delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  });
});
