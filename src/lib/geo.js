const EARTH_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const r1 = (Number(lat1) * Math.PI) / 180;
  const r2 = (Number(lat2) * Math.PI) / 180;
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLng = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_KM * c;
}

/**
 * Closest listings to a point (excluding current), sorted by distance.
 * @param {{ lat: number, lng: number }} origin
 * @param {Array<{ id: unknown, lat?: number, lng?: number }>} listings
 */
export function findNearbyListings(origin, listings, { excludeId, limit = 4, maxKm = 25 } = {}) {
  if (!listings?.length || !Number.isFinite(origin?.lat) || !Number.isFinite(origin?.lng)) return [];
  return listings
    .filter((l) => String(l.id) !== String(excludeId) && Number.isFinite(Number(l.lat)) && Number.isFinite(Number(l.lng)))
    .map((l) => ({
      listing: l,
      km: haversineKm(origin.lat, origin.lng, Number(l.lat), Number(l.lng)),
    }))
    .filter((row) => row.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((row) => ({ ...row.listing, _distanceKm: row.km }));
}
