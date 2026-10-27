/**
 * How many tenants on MovEazy are looking for a flat like the owner's: Find
 * My Flat requirements scored against each flat that isn't occupied, with the
 * same matching List my Flat shows (lib/inventoryMatch.js — 40+, no
 * deal-breaker). A count only: requirements_for_matching hands out
 * preferences and a short handle, never who the tenant is.
 *
 * → { total, byProperty: Map<property_id, count> } — total counts a tenant
 * once however many of the flats they fit.
 */
let reqsPromise = null;

export async function countMatchingTenants(flats) {
  const [{ matchListingToRequirements }, { fetchAllUserRequirements }] = await Promise.all([
    import("./inventoryMatch"), import("./userRequirements"),
  ]);
  if (!reqsPromise) reqsPromise = fetchAllUserRequirements().catch(() => { reqsPromise = null; return []; });
  const reqs = await reqsPromise;
  const everyone = new Set();
  const byProperty = new Map();
  for (const p of flats ?? []) {
    const hits = matchListingToRequirements(p, reqs, { min: 40 });
    byProperty.set(p.property_id, hits.length);
    for (const m of hits) everyone.add(m.requirement.user_id);
  }
  return { total: everyone.size, byProperty };
}
