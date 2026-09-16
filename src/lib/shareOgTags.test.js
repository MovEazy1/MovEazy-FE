/**
 * What a crawler is served when someone shares a flat.
 *
 * A Facebook post showed the site-wide marketing card instead of the flat, even
 * though /p/:id was serving the listing's own tags: og:url pointed at the
 * onward /map URL, Facebook took that as the object's canonical address,
 * re-scraped it, and got the SPA's index.html. WhatsApp reads the tags it was
 * handed and never re-resolves, so the same link previewed correctly there —
 * which is how this survived until the first Facebook share.
 *
 * These run the real edge handler with no Supabase configured, so fetchListing
 * returns null and nothing here touches the network. The tag wiring is the
 * point; the listing content is covered by the share-link tests.
 */
import { describe, expect, it } from "vitest";
import handler from "../../api/p.js";

const SHARE =
  "https://www.moveazy.co.in/api/p?listingId=MZ-ABC123" +
  "&utm_source=facebook&utm_medium=social&utm_campaign=property_share&utm_content=MZ-ABC123";

/**
 * Attribute values are HTML-escaped on the page, as they must be — so &amp;
 * has to come back out here or every parameter after the first parses as a
 * separate "amp;utm_medium" key and the assertions quietly pass on nothing.
 */
const unesc = (s) =>
  s == null
    ? null
    : s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
       .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Vercel rewrites /p/:id to /api/p?listingId=:id before the handler sees it. */
const scrape = async (url = SHARE) => {
  const res = await handler(new Request(url));
  const html = await res.text();
  return {
    html,
    tag: (property) =>
      unesc(html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`))?.[1] ?? null),
    canonical: unesc(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null),
  };
};

describe("the page a crawler gets for a shared flat", () => {
  it("points og:url at itself, not at the page it forwards humans to", async () => {
    const { tag } = await scrape();
    // The whole bug in one assertion: an og:url on /map sends Facebook to the
    // SPA, where every listing has the same generic card.
    expect(new URL(tag("og:url")).pathname).toBe("/p/MZ-ABC123");
  });

  it("keeps the tracking parameters on og:url", async () => {
    // Facebook can rewrite the link in the post to og:url. A bare /p/:id here
    // would quietly strip the UTMs off every click that post ever gets.
    const q = new URL((await scrape()).tag("og:url")).searchParams;
    expect(q.get("utm_source")).toBe("facebook");
    expect(q.get("utm_campaign")).toBe("property_share");
    expect(q.get("listingId")).toBeNull();
  });

  it("agrees with itself: canonical and og:url name the same address", async () => {
    const { tag, canonical } = await scrape();
    expect(canonical).toBe(tag("og:url"));
  });

  it("still sends a human on to the map, listing and token intact", async () => {
    const { html } = await scrape(`${SHARE}&mz_s=mzdeadbeef01`);
    const target = new URL(html.match(/window\.location\.replace\("([^"]*)"\)/)[1]);
    expect(target.pathname).toBe("/map");
    expect(target.searchParams.get("listingId")).toBe("MZ-ABC123");
    expect(target.searchParams.get("mz_s")).toBe("mzdeadbeef01");
    expect(target.searchParams.get("utm_source")).toBe("facebook");
  });

  it("asks for the big collage on a feed share and the small one otherwise", async () => {
    const feed = await scrape();
    expect(feed.tag("og:image")).toContain("size=lg");
    expect(feed.tag("og:image:width")).toBe("1200");

    const chat = await scrape(
      "https://www.moveazy.co.in/api/p?listingId=MZ-ABC123&utm_source=crm&utm_medium=whatsapp",
    );
    expect(chat.tag("og:image")).toContain("size=sm");
    expect(chat.tag("og:image:width")).toBe("600");
  });

  it("names the listing's own OG image rather than the site-wide fallback", async () => {
    const { tag } = await scrape();
    expect(tag("og:image")).toContain("/api/og?listingId=MZ-ABC123");
    expect(tag("og:image")).not.toContain("og-share.jpg");
  });
});
