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

export default async function handler(req) {
  const url = new URL(req.url);
  const listingId = String(url.searchParams.get("listingId") || "").trim().toUpperCase();

  const listing = await fetchListing(listingId);
  const origin = url.origin;

  // Everything except our own routing parameter goes on to the app.
  const onward = new URLSearchParams(url.searchParams);
  onward.delete("listingId");
  if (listingId) onward.set("listingId", listingId);
  const target = `${origin}/map?${onward.toString()}`;

  const title = listingTitle(listing);
  const description = listingDescription(listing);
  const image = listingId
    ? `${origin}/api/og?listingId=${encodeURIComponent(listingId)}`
    : `${origin}/logo-moveazy-bar.png`;

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
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${esc(target)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />

<link rel="canonical" href="${esc(target)}" />
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
