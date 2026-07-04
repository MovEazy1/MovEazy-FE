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
