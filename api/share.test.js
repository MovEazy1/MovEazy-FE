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
