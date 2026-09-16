/**
 * Share endpoint: /p/MZ-XXXXXX
 *
 * The site is a static SPA — one index.html with one set of OG tags, served for
 * every route — so WhatsApp showed the same logo card for every property. Its
 * crawler doesn't run JavaScript, so no amount of client-side work can fix that.
 * This returns real per-property tags, then sends humans on to the map.
 *
 * Query parameters are carried through verbatim, which matters: the CRM's
 * `mz_s` share token and the UTM parameters have to survive the hop or the open
 * never gets attributed.
 */
import { fetchListing, listingTitle, listingDescription, esc } from "./_listing.js";

export const config = { runtime: "edge" };

/**
 * Surfaces whose link preview is rendered large and on desktop. They get the
 * full-size collage; a WhatsApp send keeps the small one, which is the only
 * place the ~600KB preview ceiling bites.
 */
const FEED_SOURCES = new Set(["facebook", "reddit", "twitter", "linkedin", "instagram"]);

export default async function handler(req) {
  const url = new URL(req.url);
  const listingId = String(url.searchParams.get("listingId") || "").trim().toUpperCase();

  const listing = await fetchListing(listingId);
  const origin = url.origin;

  // Everything except our own routing parameter goes on to the app.
  const tracking = new URLSearchParams(url.searchParams);
  tracking.delete("listingId");

  const onward = new URLSearchParams(tracking);
  if (listingId) onward.set("listingId", listingId);
  const target = `${origin}/map?${onward.toString()}`;

  /**
   * This page's own address, which is what og:url has to say.
   *
   * Pointing og:url at the onward /map URL is what made Facebook show the
   * site-wide marketing card instead of the flat: Facebook treats og:url as the
   * object's canonical address and re-scrapes it, landing on the SPA's
   * index.html and its one set of static tags. WhatsApp reads the tags it was
   * served and never re-resolves, which is why the same link previewed
   * correctly there and hid the bug for as long as WhatsApp was the only
   * surface we shared from.
   *
   * The tracking parameters stay on: Facebook can rewrite the link in the post
   * to og:url, so a bare /p/:id here would strip the UTMs off every click and
   * take the attribution with them. Vercel rewrote the path to /api/p before we
   * saw it, so this is rebuilt rather than read off the request.
   */
  const qs = tracking.toString();
  const selfUrl = listingId
    ? `${origin}/p/${encodeURIComponent(listingId)}${qs ? `?${qs}` : ""}`
    : target;

  const title = listingTitle(listing);
  const description = listingDescription(listing);

  // Which crawler is about to read this is knowable from the link itself: a
  // share built for a feed carries utm_source=facebook or =reddit.
  const size = FEED_SOURCES.has(String(url.searchParams.get("utm_source") || "").toLowerCase())
    ? "lg"
    : "sm";
  const dims = size === "lg" ? { w: 1200, h: 630 } : { w: 600, h: 315 };

  const image = listingId
    ? `${origin}/api/og?listingId=${encodeURIComponent(listingId)}&size=${size}`
    : `${origin}/og-share.jpg`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="MovEazy" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="${dims.w}" />
<meta property="og:image:height" content="${dims.h}" />
<meta property="og:image:alt" content="${esc(title)}" />
<meta property="og:url" content="${esc(selfUrl)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />

<link rel="canonical" href="${esc(selfUrl)}" />
<script>window.location.replace(${JSON.stringify(target)});</script>
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#04211D;color:#F4F2ED">
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px">
    <div>
      <p style="font-size:18px;font-weight:700;margin:0 0 8px">${esc(title)}</p>
      <p style="margin:0 0 18px;color:#B9CFCA">Opening on MovEazy…</p>
      <a href="${esc(target)}" style="color:#5EEAD4">Tap here if it doesn't open</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short cache: a crawler should pick up a re-listed price reasonably soon,
      // and the redirect itself must not get pinned in anyone's browser.
      "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
