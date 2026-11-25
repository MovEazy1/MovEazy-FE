/**
 * GET /api/geo → { city, region, country }: a rough guess of where the
 * visitor is, from Vercel's own IP geolocation headers — no permission popup,
 * no outside service. The site uses it only to pre-select a city in "Which
 * city are you searching in?" (lib/cities.js), and the CRM notes it as where
 * the tenant is now when that differs from the city they search in.
 *
 * Nothing is stored here. The answer is per visitor, so it is never cached.
 */
export const config = { runtime: "edge" };

const decode = (v) => {
  try { return decodeURIComponent(v || ""); } catch { return v || ""; }
};

export default function handler(req) {
  const h = req.headers;
  const country = h.get("x-vercel-ip-country") || "";
  const region = h.get("x-vercel-ip-country-region") || "";
  let city = decode(h.get("x-vercel-ip-city"));
  // Delhi's many districts all report the region; the city name varies.
  if (!city && country === "IN" && region === "DL") city = "Delhi";
  return new Response(JSON.stringify({ city: country === "IN" ? city : "", region: region === "DL" ? "Delhi" : "", country }), {
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}
