/**
 * Lead ↔ property matching for the partner app.
 *
 * Deterministic on purpose (PRD §16, "V1 matching"): location 40, budget 25,
 * BHK 15, furnishing 10, availability 10. Every point is explainable from the
 * two records, so a broker who asks "why is this a 72?" can be answered.
 *
 * Kept apart from the UI and from lib/inventoryMatch.js (the customer-side
 * engine, which reads a much richer requirement) so the scoring can be
 * replaced later without touching a screen: callers only see
 * { score, reasons } and the two list helpers.
 */
import { expandAreas } from "../data/preferenceOptions";

export const WEIGHTS = { location: 40, budget: 25, bhk: 15, furnishing: 10, availability: 10 };

/** Below this a flat is not called a match. Location alone cannot be missed and pass. */
export const MATCH_MIN = 65;

const norm = (s) => String(s || "").trim().toLowerCase();
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** "2 BHK" → 2, "1 RK" → 0.5, "Villa" → null. */
export function bedroomsOf(label) {
  const s = norm(label);
  // A room in a flat someone already lives in: its own size, below a 1 RK.
  if (/\broom\b/.test(s)) return 0.25;
  if (/\brk\b/.test(s)) return 0.5;
  const m = /(\d+)\s*\+?\s*bhk/.exec(s);
  return m ? Number(m[1]) : null;
}

const listingBedrooms = (l) => bedroomsOf(l.flat_type) ?? num(l.bedrooms);

/** Does the lead say anything we can match on? A bare name + number does not. */
export function hasRequirement(lead) {
  return Boolean(
    (lead?.localities ?? []).length || (lead?.flat_types ?? []).length ||
    num(lead?.budget_min) != null || num(lead?.budget_max) != null || lead?.furnishing,
  );
}

const FURNISH_RANK = { unfurnished: 0, "semi furnished": 1, "fully furnished": 2 };
const furnishRank = (f) => FURNISH_RANK[norm(f).replace("-", " ")];

/**
 * 0–100 plus the reasons that earned it. A criterion the lead left blank earns
 * its full weight: "any furnishing" is satisfied by every flat.
 */
export function scoreLeadMatch(listing, lead, { today = new Date() } = {}) {
  const reasons = [];
  let score = 0;

  // Location — the listing's own area, or any area it is also in.
  const wanted = expandAreas(lead.localities ?? []).map(norm);
  if (!wanted.length) {
    score += WEIGHTS.location;
  } else {
    const where = [listing.area, ...(listing.nearby_areas ?? [])].map(norm).filter(Boolean);
    if (where.some((w) => wanted.includes(w))) {
      score += WEIGHTS.location;
      reasons.push(listing.area);
    }
  }

  // Budget — inside the range is full marks; up to 10% over still earns half.
  const rent = num(listing.rent);
  const lo = num(lead.budget_min);
  const hi = num(lead.budget_max);
  if (lo == null && hi == null) {
    score += WEIGHTS.budget;
  } else if (rent != null) {
    if ((lo == null || rent >= lo * 0.9) && (hi == null || rent <= hi)) {
      score += WEIGHTS.budget;
      reasons.push("In budget");
    } else if (hi != null && rent <= hi * 1.1) {
      score += Math.round(WEIGHTS.budget / 2);
      reasons.push("Just over budget");
    }
  }

  // BHK — exact, or one bedroom either side for a third of the points.
  const wantBeds = (lead.flat_types ?? []).map(bedroomsOf).filter((b) => b != null);
  const wantNames = (lead.flat_types ?? []).map(norm);
  if (!wantNames.length) {
    score += WEIGHTS.bhk;
  } else {
    const beds = listingBedrooms(listing);
    if (wantNames.includes(norm(listing.flat_type)) || (beds != null && wantBeds.includes(beds))) {
      score += WEIGHTS.bhk;
      reasons.push(listing.flat_type || `${beds} BHK`);
    } else if (beds != null && wantBeds.some((b) => Math.abs(b - beds) === 1)) {
      score += Math.round(WEIGHTS.bhk / 3);
    }
  }

  // Furnishing — exact, or next door (semi for fully) for half.
  if (!lead.furnishing) {
    score += WEIGHTS.furnishing;
  } else {
    const a = furnishRank(lead.furnishing);
    const b = furnishRank(listing.furnishing);
    if (a != null && a === b) {
      score += WEIGHTS.furnishing;
      reasons.push(listing.furnishing);
    } else if (a != null && b != null && Math.abs(a - b) === 1) {
      score += Math.round(WEIGHTS.furnishing / 2);
    }
  }

  // Availability — live now or within a month.
  if (listing.status === "published" || listing.status == null) {
    const from = listing.available_from ? new Date(listing.available_from) : null;
    const soon = !from || from.getTime() <= today.getTime() + 31 * 86400000;
    score += soon ? WEIGHTS.availability : Math.round(WEIGHTS.availability / 2);
  }

  return { score: Math.min(100, score), reasons };
}

/** The flats matching one lead, best first. None for a lead with no requirement. */
export function matchesForLead(lead, listings, { min = MATCH_MIN } = {}) {
  if (!hasRequirement(lead)) return [];
  return listings
    .map((listing) => ({ listing, ...scoreLeadMatch(listing, lead) }))
    .filter((m) => m.score >= min)
    .sort((a, b) => b.score - a.score || (Number(b.listing.brokerage_pct) || 0) - (Number(a.listing.brokerage_pct) || 0));
}

/** The same engine in reverse: leads a flat suits (Property detail → Find matching leads). */
export function leadsForListing(listing, leads, { min = MATCH_MIN } = {}) {
  return leads
    .filter((lead) => lead.status !== "closed" && hasRequirement(lead))
    .map((lead) => ({ lead, ...scoreLeadMatch(listing, lead) }))
    .filter((m) => m.score >= min)
    .sort((a, b) => b.score - a.score);
}
