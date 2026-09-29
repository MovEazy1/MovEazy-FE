/**
 * Coordinates out of a Google Maps link, however a broker got it:
 *   …/maps/place/…/@12.9121,77.6446,17z          (the map view)
 *   …/maps/place/…!3d12.9121!4d77.6446           (the pinned place — preferred)
 *   …/maps?q=12.9121,77.6446  ·  ?ll=  ·  /search/12.9121,+77.6446
 *   maps.app.goo.gl/AbC123 · goo.gl/maps/…       (short links: resolved by /api/resolve-map)
 * Returns { lat, lng } inside India, or null.
 */

const inIndia = (lat, lng) => lat > 6 && lat < 37.5 && lng > 68 && lng < 97.5;

export function coordsFromMapsUrl(raw) {
  const s = decodeURIComponent(String(raw || "")).replace(/\+/g, " ");
  const tries = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // the pin, when present, beats the viewport
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /\/search\/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /\/place\/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // plain "12.91, 77.64"
  ];
  for (const re of tries) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (inIndia(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export const isShortMapsLink = (raw) => /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(String(raw || "").trim());

/** The first http(s) link in a pasted message ("Location: https://maps.app.goo.gl/…"). */
export function firstLink(raw) {
  const m = String(raw || "").match(/https?:\/\/\S+/i);
  return m ? m[0].replace(/[),.]+$/, "") : String(raw || "").trim();
}

/** Coordinates for any pasted link or "lat, lng", following a short link through our resolver. */
export async function resolveMapsLink(raw) {
  const link = firstLink(raw);
  const direct = coordsFromMapsUrl(link);
  if (direct) return direct;
  if (!isShortMapsLink(link)) return null;
  try {
    const r = await fetch(`/api/resolve-map?u=${encodeURIComponent(link.startsWith("http") ? link : `https://${link}`)}`);
    if (!r.ok) return null;
    const { url } = await r.json();
    return coordsFromMapsUrl(url);
  } catch {
    return null;
  }
}
