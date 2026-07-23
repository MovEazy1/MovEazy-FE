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

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", raw);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(BLR_CENTER.lat));
  url.searchParams.set("lon", String(BLR_CENTER.lon));
  url.searchParams.set("bbox", BLR_BBOX);

  let data;
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return []; // aborted or network error — caller keeps previous results
  }
  const feats = Array.isArray(data?.features) ? data.features : [];

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
    .filter((x) => x.lat != null);
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
