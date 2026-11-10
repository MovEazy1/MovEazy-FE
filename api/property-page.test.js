import { afterEach, describe, expect, it, vi } from "vitest";
import { depositText, photosOf, postedAgo, prepaint, thumbUrl, withListing } from "./property-page.js";
import { APP_LISTING_COLS } from "./_listing.js";
import { PUBLIC_INVENTORY_COLS } from "../src/lib/inventory.js";

const B = "https://x.supabase.co/storage/v1/object/public/listings/";
const row = {
  property_id: "MZ-LTQJ2A", title: "1 BHK in HSR", area: "HSR", full_address: "", landmark: "", rent: 26000, deposit: 100000,
  flat_type: "1 BHK", status: "published", created_at: "2026-11-10T06:00:00Z", rent_flag: null,
  images: [`${B}inventory/MZ-LTQJ2A/tour.mp4`, `${B}inventory/MZ-LTQJ2A/a.jpg`, `${B}inventory/MZ-LTQJ2A/b.jpg`],
  cover_image_url: "",
};
const SHELL = `<!doctype html><html><head><title>MovEazy — Move</title><link rel="modulepreload" crossorigin href="/assets/react.js"><link rel="stylesheet" href="/assets/index.css"></head><body><div id="root"></div></body></html>`;
const NOW = new Date("2026-11-10T19:00:00Z").getTime();

describe("the flat page's drawn copy", () => {
  it("reads the same row the app reads", () => {
    const cols = (s) => s.split(",").map((c) => c.trim()).sort();
    expect(cols(APP_LISTING_COLS)).toEqual(cols(PUBLIC_INVENTORY_COLS));
  });
  it("photos first, as the gallery orders them; the 480 px copy", () => {
    expect(photosOf(row)).toEqual([`${B}inventory/MZ-LTQJ2A/a.jpg`, `${B}inventory/MZ-LTQJ2A/b.jpg`]);
    expect(thumbUrl(`${B}inventory/MZ-LTQJ2A/a.jpg`)).toBe(`${B}thumbs/inventory/MZ-LTQJ2A/a.jpg`);
    expect(thumbUrl("https://elsewhere.com/a.jpg")).toBe("https://elsewhere.com/a.jpg");
  });
  it("writes rent, deposit and age the way the page does", () => {
    expect(depositText({ deposit: 100000 })).toBe("₹ 1,00,000");
    expect(depositText({ deposit: 3 })).toBe("3 months");
    expect(postedAgo("2026-11-10T06:00:00Z", NOW)).toBe("13 hours ago");
    const html = prepaint(row, NOW);
    expect(html).toContain("<h1>1 BHK in HSR</h1>");
    expect(html).toContain("Posted 13 hours ago");
    expect(html).toContain("<b>₹ 26,000</b>");
    expect(html).toContain(`src="${B}thumbs/inventory/MZ-LTQJ2A/a.jpg"`);
    expect(html).toContain("Schedule Visit");
    expect(html.match(/<span><\/span>/g)).toHaveLength(2);
  });
  it("escapes what a lister typed", () => {
    const html = prepaint({ ...row, title: `<img src=x onerror=alert(1)>` }, NOW);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("flags a flat a partner said may be rented", () => {
    expect(prepaint({ ...row, rent_flag: "potentially_rented" }, NOW)).toContain("Potentially rented");
  });
});

describe("the page", () => {
  it("adds the photo preload, the row, the drawn copy and the title; scripts behind", () => {
    const html = withListing(SHELL, row, NOW);
    expect(html).toContain(`<link rel="preload" as="image" href="${B}thumbs/inventory/MZ-LTQJ2A/a.jpg" fetchpriority="high">`);
    expect(html).toContain("<title>1 BHK in HSR · MovEazy</title>");
    expect(html).toContain('<link rel="modulepreload" fetchpriority="low" crossorigin');
    expect(html).toMatch(/<div id="prerender"><div class="mzp">[\s\S]*<\/div><div id="root"><\/div>/);
    const data = JSON.parse(html.match(/window\.__MZ_LISTING__=(.*?);<\/script>/)[1]);
    expect(data).toEqual({ id: "MZ-LTQJ2A", rows: [row] });
  });
  it("a row can't close the script it rides in", () => {
    const html = withListing(SHELL, { ...row, description: "</script><script>alert(1)</script>" }, NOW);
    expect(html).not.toContain("</script><script>alert(1)");
  });
});

describe("the edge handler", () => {
  afterEach(() => vi.unstubAllGlobals());
  const run = async (rows, host = "www.moveazy.co.in") => {
    vi.stubGlobal("fetch", vi.fn(async (u) => {
      const s = String(u);
      if (s.endsWith("/app.html")) return new Response(SHELL, { status: 200 });
      return new Response(JSON.stringify(rows), { status: 200 });
    }));
    const { default: handler } = await import("./property-page.js");
    const res = await handler(new Request(`https://${host}/api/property-page?id=MZ-LTQJ2A`));
    return { res, html: await res.text() };
  };
  it("a published flat: the full page, cached a minute at the edge", async () => {
    const { res } = await run([row]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cdn-cache-control")).toContain("s-maxage=60");
  });
  it("not found, or not published: the plain shell", async () => {
    expect((await run([])).html).toBe(SHELL);
    expect((await run([{ ...row, status: "paused" }])).html).toBe(SHELL);
  });
  it("other hosts draw their own apps here", async () => {
    expect((await run([row], "partners.moveazy.co.in")).html).toBe(SHELL);
  });
});
