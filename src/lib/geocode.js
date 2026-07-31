/**
 * Forward geocode using OpenStreetMap Nominatim (no API key).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export async function geocodePlace(query) {
  let q = String(query || "").trim();
  if (!q) return { ok: false, error: "Enter a place or landmark" };

  // Bias company / landmark searches to Bangalore (matches product focus; improves Nominatim hits).
  if (!/bangalore|bengaluru|karnataka|india/i.test(q)) {
    q = `${q}, Bengaluru, Karnataka, India`;
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) return { ok: false, error: "Search failed. Try again." };
  const data = await res.json().catch(() => []);
  const hit = Array.isArray(data) && data[0];
  if (!hit) return { ok: false, error: "No results. Try adding the city (e.g. Google office Bangalore)." };

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Invalid location." };

  return {
    ok: true,
    lat,
    lng,
    displayName: hit.display_name || q,
  };
}

// Bengaluru proximity + a metro-area bounding box so results stay local.
const BLR_CENTER = { lat: 12.9716, lon: 77.5946 };
const BLR_BBOX = "77.30,12.72,77.90,13.24"; // minLon,minLat,maxLon,maxLat

/** Build a {primary, secondary} pair from a Photon feature's properties. */
function photonLabel(p, fallback) {
  const primary =
    p.name ||
    [p.housenumber, p.street].filter(Boolean).join(" ") ||
    p.suburb || p.locality || p.district || p.city || fallback;
  const rest = [p.street, p.suburb, p.locality, p.district, p.city, p.state]
    .filter(Boolean)
    .filter((x) => x !== primary);
  const secondary = [...new Set(rest)].slice(0, 3).join(", ");
  return { primary, secondary };
}

/**
 * Google-style live place search via Photon (Komoot) — an OSM-based geocoder
 * built for as-you-type autocomplete. No API key, CORS-enabled, Bangalore-biased.
 * Pass an AbortSignal to cancel stale in-flight requests as the user keeps typing.
 * @returns {Promise<Array<{id,primary,secondary,label,display,lat,lng}>>}
 */
export async function searchPlaces(query, { limit = 6, signal } = {}) {
  const raw = String(query || "").trim();
  if (raw.length < 3) return [];

  // Bias to Bengaluru in the query text (Photon's `bbox` param is a hard filter
  // that drops even valid local hits, so we over-fetch and box-filter below).
  const q = /bangalore|bengaluru|karnataka/i.test(raw) ? raw : `${raw}, Bengaluru`;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(Math.max(limit * 4, 20)));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(BLR_CENTER.lat));
  url.searchParams.set("lon", String(BLR_CENTER.lon));

  let data;
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return []; // aborted or network error — caller keeps previous results
  }
  const [minLon, minLat, maxLon, maxLat] = BLR_BBOX.split(",").map(Number);
  const feats = (Array.isArray(data?.features) ? data.features : []).filter((f) => {
    const c = f.geometry?.coordinates;
    return c && c[0] >= minLon && c[0] <= maxLon && c[1] >= minLat && c[1] <= maxLat;
  });

  return feats
    .map((f, i) => {
      const [lng, lat] = f.geometry?.coordinates || [];
      const p = f.properties || {};
      const { primary, secondary } = photonLabel(p, raw);
      return {
        id: p.osm_id ? `${p.osm_type || "n"}${p.osm_id}` : `${lat}-${lng}-${i}`,
        primary,
        secondary,
        label: primary,
        display: [primary, secondary].filter(Boolean).join(", "),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      };
    })
    .filter((x) => x.lat != null)
    .slice(0, limit);
}

/**
 * Reverse geocode a dropped/dragged pin back to a readable address (Photon).
 * @returns {Promise<{label,primary,secondary,display,lat,lng}|null>}
 */
export async function reverseGeocode(lat, lng, { signal } = {}) {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", "en");
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return null;
    const data = await res.json();
    const f = Array.isArray(data?.features) ? data.features[0] : null;
    if (!f) return null;
    const { primary, secondary } = photonLabel(f.properties || {}, "Pinned location");
    return {
      label: secondary ? `${primary}, ${secondary.split(",")[0]}` : primary,
      primary,
      secondary,
      display: [primary, secondary].filter(Boolean).join(", "),
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

// Metres between two lat/lng points (haversine).
function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// OSM has no ratings, so approximate "most-rated / prominent" by category:
// destinations people actually navigate by rank highest, plain roads lowest.
const PROMINENCE = {
  "railway:station": 100, "railway:subway": 100, "railway:halt": 80,
  "aeroway:aerodrome": 100,
  "shop:mall": 95, "shop:department_store": 80, "shop:supermarket": 70,
  "tourism:attraction": 90, "tourism:hotel": 60, "tourism:museum": 75,
  "amenity:hospital": 88, "amenity:university": 85, "amenity:college": 78,
  "amenity:marketplace": 72, "amenity:place_of_worship": 68, "amenity:cinema": 70,
  "amenity:stadium": 82, "leisure:stadium": 82, "leisure:park": 74,
  "office:*": 66, "amenity:bank": 55, "amenity:restaurant": 45, "amenity:cafe": 42,
  "amenity:*": 40, "shop:*": 40, "leisure:*": 45, "tourism:*": 50,
  "place:suburb": 60, "place:neighbourhood": 55, "place:*": 50,
  "highway:*": 8, "power:*": 2, "building:*": 15,
};

function prominenceOf(p) {
  const key = p?.osm_key, val = p?.osm_value;
  if (key && val && PROMINENCE[`${key}:${val}`] != null) return PROMINENCE[`${key}:${val}`];
  if (key && PROMINENCE[`${key}:*`] != null) return PROMINENCE[`${key}:*`];
  return 20;
}

/**
 * Nearby named places/landmarks around a point, for a "pick a landmark" dropdown.
 * Uses Photon reverse, keeps only named features within `maxMeters`, and sorts by
 * prominence (most navigable landmark first), then by distance. Returns [] on failure.
 * @returns {Promise<Array<{label,display,lat,lng,distanceMeters,prominence}>>}
 */
export async function nearbyLandmarks(lat, lng, { limit = 25, maxMeters = 1000, signal } = {}) {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", String(limit));
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const seen = new Set();
    const out = [];
    for (const f of features) {
      const props = f.properties || {};
      // Only named points of interest make good landmarks — skip bare roads/streets.
      if (!props.name) continue;
      const { primary, secondary } = photonLabel(props, "");
      if (!primary) continue;
      const display = [primary, secondary.split(",")[0]].filter(Boolean).join(", ");
      const key = display.toLowerCase();
      if (seen.has(key)) continue;
      const [flng, flat] = f.geometry?.coordinates || [lng, lat];
      const dist = distanceMeters(lat, lng, flat, flng);
      if (dist > maxMeters) continue;
      seen.add(key);
      out.push({ label: display, display, lat: flat, lng: flng, distanceMeters: Math.round(dist), prominence: prominenceOf(props) });
    }
    // Most prominent first; ties broken by proximity.
    out.sort((a, b) => (b.prominence - a.prominence) || (a.distanceMeters - b.distanceMeters));
    return out;
  } catch {
    return [];
  }
}
