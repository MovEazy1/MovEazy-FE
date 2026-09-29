/**
 * Where a Google Maps short link (maps.app.goo.gl/…) points, so the partner
 * app can read the coordinates out of it. The browser can't follow these
 * itself (no CORS on the redirect).
 *
 * Only Google's short-link hosts are fetched, and only their redirect target
 * is returned — this is not a general URL fetcher.
 */
export const config = { runtime: "edge" };

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
const ALLOWED_TARGET = /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\.[a-z.]+\//i;

export default async function handler(req) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
  });
  let url;
  try {
    url = new URL(new URL(req.url).searchParams.get("u") || "");
  } catch {
    return json({ error: "bad link" }, 400);
  }
  if (url.protocol !== "https:" || !SHORT_HOSTS.has(url.hostname)) return json({ error: "not a Google Maps short link" }, 400);

  // Follow at most a few hops, each time only to Google.
  let current = url.toString();
  for (let hop = 0; hop < 4; hop++) {
    let res;
    try {
      res = await fetch(current, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; MovEazyBot/1.0)" } });
    } catch {
      return json({ error: "could not reach Google" }, 502);
    }
    const next = res.headers.get("location");
    if (!next) break;
    current = new URL(next, current).toString();
    if (ALLOWED_TARGET.test(current)) return json({ url: current });
    if (!SHORT_HOSTS.has(new URL(current).hostname)) break;
  }
  return ALLOWED_TARGET.test(current) ? json({ url: current }) : json({ error: "not a map location" }, 422);
}
