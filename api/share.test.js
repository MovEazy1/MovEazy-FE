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
