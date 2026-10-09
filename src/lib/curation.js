/**
 * Which flats an agent sees when building a list for one client, and which go
 * into the tray by themselves (pages/crm/CurateScreen.jsx, MatchesPane.jsx).
 *
 *   Never shown again   anything the client said no to — their own dislike
 *                       (a swipe anywhere), an agent's "Dislike" after a call,
 *                       or a rejected shortlist row. A "Pass" while curating
 *                       hides it from curating for this client, not Matches.
 *   Never shown at all  fewer bedrooms than they asked for (more is fine: a
 *                       3 BHK for a 2 BHK seeker, never a 1 BHK), or more than
 *                       20% over their budget.
 *   Pre-selected        flats from lists made for anyone in the last 30 days
 *                       that are still live, pass the rules above, and sit in
 *                       their area: a locality they named (or one inside it, or
 *                       a flat listing it as nearby), or within a straight line
 *                       of N km (8 by default) of the office they gave us.
 *                       Without a budget, the budget rule is skipped;
 *                       without a locality or an office, nothing is.
 *
 * Pure; tested in curation.test.js.
 */
import { matchRequirementToListings, scoreMatch } from "./inventoryMatch";
import { bedroomsOf } from "./partnerMatch";
import { haversineKm } from "./geo";
import { coordsOf } from "./commute";

export const OVER_BUDGET = 1.2;
export const DEFAULT_RADIUS_KM = 8;
export const RECENT_DAYS = 30;

const NO = new Set(["disliked", "rejected"]);
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * What this client turned down, and what an agent passed on for them.
 * @param {string} clientId
 * @param {object[]} shortlists   crm_shortlists rows (any client's; filtered here)
 * @param {object[]} reactions    their listing_reactions rows
 * @param {object[]} passes       crm_client_passes rows for them
 */
export function turnedDown(clientId, shortlists = [], reactions = [], passes = []) {
  const disliked = new Set();
  for (const s of shortlists) if (s.client_id === clientId && NO.has(s.status)) disliked.add(s.property_id);
  for (const r of reactions) if (r.reaction === "dislike") disliked.add(r.property_id);
  const passed = new Set(passes.map((p) => p.property_id));
  return { disliked, passed };
}

/** The fewest bedrooms they'd take: the smallest flat type they named. */
export function minBedrooms(req) {
  const counts = (req?.flat_types ?? []).map(bedroomsOf).filter((n) => n != null);
  return counts.length ? Math.min(...counts) : null;
}

const bedroomsOfListing = (l) => bedroomsOf(l?.flat_type) ?? num(l?.bedrooms);

/** Fewer bedrooms than asked, or over budget by more than 20%: not for them. */
export function withinLimits(listing, req, { budget = true } = {}) {
  const min = minBedrooms(req);
  const beds = bedroomsOfListing(listing);
  if (min != null && beds != null && beds < min) return false;
  const max = num(req?.budget_max);
  const rent = num(listing?.rent);
  if (budget && max != null && max > 0 && rent != null && rent > max * OVER_BUDGET) return false;
  return true;
}

/** In a locality they named (or inside it / nearby), or within `radiusKm` of their office. */
export function inTheirArea(listing, req, office = null, radiusKm = DEFAULT_RADIUS_KM) {
  const named = (req?.localities ?? []).length > 0;
  const at = coordsOf(office);
  if (!named && !at) return true; // nothing to judge by
  if (named && scoreMatch(listing, { localities: req.localities }).breakdown.area > 0) return true;
  const here = coordsOf(listing);
  if (at && here) return haversineKm(at.lat, at.lng, here.lat, here.lng) <= (num(radiusKm) || DEFAULT_RADIUS_KM);
  return false;
}

const live = (l) => l?.status === "published";

/**
 * The flats to curate from, best match first: live, not turned down, not
 * passed, within their limits, above their match score. `keep`: flats acted on
 * just now (passed, sold out), held in place so they can be undone.
 */
export function curationFeed({ inventory = [], req, down, minScore, keep = new Set() }) {
  const pool = inventory.filter((l) => keep.has(l.property_id) || (live(l) && !down.disliked.has(l.property_id)
    && !down.passed.has(l.property_id) && withinLimits(l, req)));
  return matchRequirementToListings(req, pool, { min: minScore ?? req?.min_score ?? 60 });
}

/** Matches for the side pane: as before, minus what they turned down and what breaks their limits. */
export function filterMatches(matches = [], req, down) {
  return matches.filter((m) => !down.disliked.has(m.listing.property_id) && withinLimits(m.listing, req));
}

/** Of one earlier list, the flats that fit this client now. */
export function fittingFromList(list, { inventoryById, req, office, radiusKm, down }) {
  const hasBudget = num(req?.budget_max) != null && num(req?.budget_max) > 0;
  return (list?.property_ids ?? []).filter((id) => {
    const l = inventoryById.get(id);
    return l && live(l) && !down.disliked.has(id) && !down.passed.has(id)
      && withinLimits(l, req, { budget: hasBudget }) && inTheirArea(l, req, office, radiusKm);
  });
}

/** Lists from the last `days` days, newest first, not this client's own. */
export function recentLists(lists = [], clientId, { days = RECENT_DAYS, now = Date.now() } = {}) {
  const since = now - days * 864e5;
  return lists
    .filter((s) => s.client_id !== clientId && new Date(s.created_at).getTime() >= since && (s.property_ids ?? []).length)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Whether there's anything to pre-select by: a locality or an office. Without
 * either, every flat on every list "fits", and the tray fills with all of them.
 */
export function canPreselect(req, office) {
  return (req?.localities ?? []).length > 0 || Boolean(coordsOf(office));
}

/** Everything that fits, across the recent lists, each flat once, newest list first. */
export function preselect(lists, ctx) {
  if (!canPreselect(ctx.req, ctx.office)) return [];
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const id of fittingFromList(list, ctx)) {
      if (!seen.has(id)) { seen.add(id); out.push(id); }
    }
  }
  return out;
}
