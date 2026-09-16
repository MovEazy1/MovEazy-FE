import { isFirebaseConfigured } from "./firebase";
import { getListingsData, isListingPubliclyVisible } from "./firestoreStore";
import { fetchInventoryAsListings } from "./inventory";

/**
 * The static/verified feed + user-uploaded inventory (Supabase), merged so
 * newly listed homes show up alongside the seed data. Both are fetched in
 * parallel; either can be empty. Uploaded inventory wins over a static row
 * with the same id. Shared by the map and the top-matches swipe deck so
 * there's one listing pool, not two that can drift apart.
 */
export async function fetchAllListings({ limit = 500, bhk = null, maxRent = null } = {}) {
  const [staticRows, inventoryRows] = await Promise.all([
    isFirebaseConfigured ? getListingsData({ limitCount: limit, bhk, maxRent }) : Promise.resolve([]),
    fetchInventoryAsListings({ limit }).catch(() => []),
  ]);
  const feed = staticRows.filter(isListingPubliclyVisible);
  const byId = new Map();
  for (const l of feed) byId.set(String(l.id), l);
  for (const l of inventoryRows) byId.set(String(l.id), l);
  return Array.from(byId.values());
}
