/**
 * Google Places for MovEazy Society (society.moveazy.co.in).
 *
 *   GET /api/places?u=<Google Maps link>   setting up a society: follows a
 *       short link, reads the place's name and spot from it, then finds the
 *       place (Text Search, IDs only — free) and its details (name, address,
 *       locality, rating, photos). Signed-in callers only (Supabase token).
 *   GET /api/places?id=<place id>          a society's rating and photos for
 *       its public page — only places one of our societies uses.
 *   GET /api/places?photo=<photo name>&w=  one Google photo: a redirect to
 *       Google's image (same rule: signed in, or one of our places); with
 *       &json=1, its address as { uri } (signed-in setup screens).
 *   GET /api/places?sweep=<s,w,n,e>          the CRM's society import (super
 *       admin only): the apartment complexes and gated societies in one small
 *       rectangle (up to 60), and the real-estate agencies in it (up to 20),
 *       each with its pin, address and business phone. The CRM walks the
 *       corridors cell by cell (lib/societyProspects.js).
 *
 * Google's terms let us keep the place id, not its photos or rating, so those
 * are fetched here when shown and cached at the edge for a day.
 * GOOGLE_MAPS_API_KEY (Vercel env, server only). Without it a link still
 * gives the name and the map spot ({ configured: false }).
 */
export const config = { runtime: "edge" };

const KEY = (process.env.GOOGLE_MAPS_API_KEY || "").trim();
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_KEY = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);
const MAPS_URL = /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\.[a-z.]+\//i;
const DETAIL_FIELDS = "id,displayName,formattedAddress,location,addressComponents,rating,userRatingCount,photos,googleMapsUri";

const json = (body, status = 200, cache = "no-store") => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": cache },
});

/** A signed-in MovEazy account (the society app sends its Supabase token). */
async function signedIn(req) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth) || !SUPABASE_URL) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey: SUPABASE_KEY } });
    return r.ok;
  } catch {
    return false;
  }
}

/** The super admin (the society import spends Google calls). */
async function superAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth) || !SUPABASE_URL) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_super_admin`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: auth },
      body: "{}",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

const SWEEP_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri,places.nationalPhoneNumber,places.businessStatus,nextPageToken";

/** Every place a Text Search finds inside one rectangle, up to `pages` pages of 20. */
async function searchRect(rect, textQuery, includedType, pages) {
  const out = [];
  let pageToken = "";
  for (let i = 0; i < pages; i++) {
    const body = { textQuery, includedType, pageSize: 20, locationRestriction: { rectangle: rect } };
    if (pageToken) body.pageToken = pageToken;
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": SWEEP_FIELDS },
      body: JSON.stringify(body),
    });
    if (!r.ok) break;
    const j = await r.json();
    for (const p of j.places || []) {
      if (p.businessStatus === "CLOSED_PERMANENTLY") continue;
      out.push({
        place_id: p.id,
        name: p.displayName?.text || "",
        address: p.formattedAddress || "",
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        types: p.types || [],
        maps_url: p.googleMapsUri || "",
        phone: p.nationalPhoneNumber || "",
      });
    }
    pageToken = j.nextPageToken || "";
    if (!pageToken) break;
  }
  return out;
}

/** Is this place one of our societies? */
async function known(placeId) {
  if (!SUPABASE_URL || !placeId) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/society_place_known`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ p_place: placeId }),
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

/** Where a short link points (only ever Google). */
async function expand(link) {
  let current = link;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (!SHORT_HOSTS.has(u.hostname)) break;
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; MovEazyBot/1.0)" } });
    const next = res.headers.get("location");
    if (!next) break;
    current = new URL(next, current).toString();
  }
  return current;
}

const inIndia = (lat, lng) => lat > 6 && lat < 37.5 && lng > 68 && lng < 97.5;

/** Name and spot out of a full Google Maps URL. */
export function readMapsUrl(raw) {
  const s = decodeURIComponent(String(raw || "")).replace(/\+/g, " ");
  let lat = null;
  let lng = null;
  for (const re of [/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|center)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/]) {
    const m = s.match(re);
    if (m && inIndia(Number(m[1]), Number(m[2]))) { lat = Number(m[1]); lng = Number(m[2]); break; }
  }
  const place = s.match(/\/maps\/place\/([^/@?]+)/);
  const q = s.match(/[?&]q=([^&]+)/);
  let name = (place?.[1] || q?.[1] || "").trim();
  if (/^-?\d{1,2}\.\d+\s*,/.test(name)) name = "";
  const pid = s.match(/[?&](?:query_place_id|place_id)=([A-Za-z0-9_-]{10,})/);
  return { name, lat, lng, placeId: pid?.[1] || "" };
}

function locality(components = []) {
  const pick = (t) => components.find((c) => (c.types || []).includes(t))?.longText || "";
  return pick("sublocality_level_1") || pick("neighborhood") || pick("sublocality") || pick("locality");
}

async function details(placeId) {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": DETAIL_FIELDS },
  });
  if (!r.ok) return null;
  const p = await r.json();
  return {
    place_id: p.id,
    name: p.displayName?.text || "",
    address: p.formattedAddress || "",
    area: locality(p.addressComponents),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    rating: p.rating ?? null,
    ratings: p.userRatingCount ?? 0,
    maps_uri: p.googleMapsUri || "",
    photos: (p.photos || []).slice(0, 6).map((ph) => ({
      name: ph.name,
      attribution: (ph.authorAttributions || []).map((a) => a.displayName).filter(Boolean).join(", "),
    })),
  };
}

export default async function handler(req) {
  const q = new URL(req.url).searchParams;

  // ── One photo ──
  if (q.get("photo")) {
    const name = q.get("photo");
    const m = name.match(/^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/);
    if (!m) return json({ error: "bad photo" }, 400);
    if (!KEY) return json({ configured: false }, 503);
    if (!(await known(m[1])) && !(await signedIn(req))) return json({ error: "not ours" }, 403);
    const w = Math.min(1600, Math.max(200, Number(q.get("w")) || 800));
    const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${KEY}`);
    if (!r.ok) return json({ error: "no photo" }, 404);
    const { photoUri } = await r.json();
    // While setting up (the place isn't ours yet) the app asks for the address itself.
    if (q.get("json")) return json({ uri: photoUri });
    return new Response(null, { status: 302, headers: { location: photoUri, "cache-control": "public, s-maxage=86400, max-age=3600" } });
  }

  // ── The society import: one rectangle ──
  if (q.get("sweep")) {
    const [s, w, n, e] = q.get("sweep").split(",").map(Number);
    const inBengaluru = [s, n].every((v) => v > 12.6 && v < 13.3) && [w, e].every((v) => v > 77.3 && v < 77.95);
    if (!inBengaluru || !(n > s && e > w) || n - s > 0.02 || e - w > 0.02) return json({ error: "bad rectangle" }, 400);
    if (!KEY) return json({ configured: false }, 503);
    if (!(await superAdmin(req))) return json({ error: "Only the super admin can import." }, 403);
    const rect = { low: { latitude: s, longitude: w }, high: { latitude: n, longitude: e } };
    const [societies, agents] = await Promise.all([
      searchRect(rect, "apartments gated society", "apartment_complex", 3),
      searchRect(rect, "real estate agent", "real_estate_agency", 1),
    ]);
    return json({ configured: true, societies, agents });
  }

  // ── A society's live details ──
  if (q.get("id")) {
    const id = q.get("id");
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return json({ error: "bad id" }, 400);
    if (!KEY) return json({ configured: false }, 200, "public, s-maxage=300");
    if (!(await known(id))) return json({ error: "not ours" }, 403);
    const d = await details(id);
    return d ? json({ configured: true, ...d }, 200, "public, s-maxage=86400, max-age=3600") : json({ error: "not found" }, 404);
  }

  // ── Setting up: a pasted link ──
  let link = String(q.get("u") || "").trim();
  if (!link) return json({ error: "Paste a Google Maps link." }, 400);
  if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
  let url;
  try {
    url = new URL(link);
  } catch {
    return json({ error: "That isn't a link." }, 400);
  }
  if (url.protocol !== "https:" || !(SHORT_HOSTS.has(url.hostname) || MAPS_URL.test(url.toString()))) {
    return json({ error: "That isn't a Google Maps link." }, 400);
  }
  if (!(await signedIn(req))) return json({ error: "Sign in first." }, 401);

  let full;
  try {
    full = await expand(url.toString());
  } catch {
    return json({ error: "Couldn't open that link. Try copying it again from Google Maps." }, 502);
  }
  const fromLink = readMapsUrl(full);
  if (!KEY) return json({ configured: false, name: fromLink.name, lat: fromLink.lat, lng: fromLink.lng, google_url: url.toString() });

  let placeId = fromLink.placeId;
  if (!placeId && (fromLink.name || fromLink.lat)) {
    // IDs-only Text Search: free. Biased to the spot in the link.
    const body = { textQuery: fromLink.name || `${fromLink.lat},${fromLink.lng}`, maxResultCount: 1 };
    if (fromLink.lat != null) body.locationBias = { circle: { center: { latitude: fromLink.lat, longitude: fromLink.lng }, radius: 500 } };
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify(body),
    });
    if (r.ok) placeId = (await r.json()).places?.[0]?.id || "";
  }
  if (!placeId) {
    return json({ configured: true, found: false, name: fromLink.name, lat: fromLink.lat, lng: fromLink.lng, google_url: url.toString() });
  }
  const d = await details(placeId);
  if (!d) return json({ configured: true, found: false, name: fromLink.name, lat: fromLink.lat, lng: fromLink.lng, google_url: url.toString() });
  return json({ configured: true, found: true, google_url: url.toString(), ...d });
}
