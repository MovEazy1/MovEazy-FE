/**
 * Requirement ↔ listing matching.
 *
 * A seeker's requirement (a public.customer_search_profiles row, or the raw
 * Train My Broker prefs object) is scored against an inventory listing. Both
 * sides speak the shared vocabulary from data/preferenceOptions.js, so the
 * fields line up 1:1. Returns a 0–100 score plus human-readable reasons and any
 * hard blockers (deal-breakers), so the UI can explain *why* a flat matches.
 */

const lower = (s) => String(s || "").trim().toLowerCase();

function toArr(v) {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") {
    return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}
function overlap(a, b) {
  const setB = new Set(b.map(lower));
  return a.filter((x) => setB.has(lower(x)));
}
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Canonicalise a requirement from either a DB search-profile row (snake_case)
 * or a Train My Broker prefs object (camelCase), so scoring reads one shape.
 */
export function normalizeRequirement(raw) {
  const r = raw || {};
  const areas = toArr(r.preferred_areas ?? r.preferredAreas ?? r.localities);
  const flatTypes = toArr(r.flat_types ?? r.flatTypes ?? r.property_type ?? r.propertyType ?? r.bhk);
  const mustHaves = toArr(r.mustHaves ?? r.must_haves);
  const dealBreakers = toArr(r.dealBreakers ?? r.deal_breakers);
  const occupants = toArr(r.occupants);
  return {
    areas,
    budgetMin: num(r.budget_min ?? r.budgetMin),
    budgetMax: num(r.budget_max ?? r.budgetMax),
    flatTypes,
    furnishing: lower(r.furnishing),
    mustHaves,
    dealBreakers,
    occupants,
    label: r.label || r.name || r.customer_name || r.email || r.user_id || "",
  };
}

const WEIGHTS = { area: 30, budget: 25, flatType: 15, mustHaves: 15, furnishing: 8, occupants: 7 };

/**
 * Score one listing against one requirement.
 * @returns {{score:number, reasons:string[], blockers:string[], breakdown:object}}
 */
export function scoreMatch(listing, requirementRaw) {
  const req = normalizeRequirement(requirementRaw);
  const l = listing || {};
  const reasons = [];
  const blockers = [];
  const breakdown = {};
  let score = 0;
  let possible = 0;

  const listingAreas = [l.area, ...(l.nearby_areas || l.nearbyAreas || [])].filter(Boolean);
  const listingAmenities = toArr(l.amenities);
  const listingRules = toArr(l.house_rules || l.houseRules);
  const listingOccupants = toArr(l.occupants_allowed || l.occupantsAllowed);

  // ── Deal-breakers: any listing attribute the seeker refuses → hard blocker.
  const listingTraits = [...listingRules, ...listingAmenities].map(lower);
  for (const db of req.dealBreakers) {
    if (listingTraits.some((t) => t.includes(lower(db)) || lower(db).includes(t))) {
      blockers.push(db);
    }
  }
  // "Bachelor Restrictions" as a deal-breaker: seeker is a bachelor but the flat
  // doesn't allow bachelors.
  if (req.dealBreakers.some((d) => lower(d).includes("bachelor")) &&
      listingOccupants.length && !listingOccupants.map(lower).includes("bachelor")) {
    blockers.push("Bachelor Restrictions");
  }

  // ── Area.
  if (req.areas.length) {
    possible += WEIGHTS.area;
    const hit = overlap(req.areas, listingAreas);
    if (hit.length) {
      score += WEIGHTS.area;
      reasons.push(`In ${hit[0]}`);
    }
    breakdown.area = hit.length ? WEIGHTS.area : 0;
  }

  // ── Budget: rent within range = full; up to 15% over = partial.
  const rent = num(l.rent);
  if (rent != null && (req.budgetMin != null || req.budgetMax != null)) {
    possible += WEIGHTS.budget;
    const min = req.budgetMin ?? 0;
    const max = req.budgetMax ?? Infinity;
    let pts = 0;
    if (rent >= min && rent <= max) {
      pts = WEIGHTS.budget;
      reasons.push("Within budget");
    } else if (max !== Infinity && rent > max && rent <= max * 1.15) {
      pts = Math.round(WEIGHTS.budget * 0.5);
      reasons.push("Slightly over budget");
    } else if (rent < min) {
      pts = Math.round(WEIGHTS.budget * 0.8);
      reasons.push("Under budget");
    }
    score += pts;
    breakdown.budget = pts;
  }

  // ── Flat type.
  if (req.flatTypes.length && l.flat_type) {
    possible += WEIGHTS.flatType;
    const hit = req.flatTypes.some((t) => lower(t) === lower(l.flat_type) || lower(t).includes(lower(l.flat_type)) || lower(l.flat_type).includes(lower(t)));
    if (hit) {
      score += WEIGHTS.flatType;
      reasons.push(l.flat_type);
    }
    breakdown.flatType = hit ? WEIGHTS.flatType : 0;
  }

  // ── Must-haves: fraction satisfied by amenities.
  if (req.mustHaves.length) {
    possible += WEIGHTS.mustHaves;
    const hit = overlap(req.mustHaves, listingAmenities);
    const pts = Math.round((hit.length / req.mustHaves.length) * WEIGHTS.mustHaves);
    score += pts;
    if (hit.length) reasons.push(`${hit.length}/${req.mustHaves.length} must-haves`);
    breakdown.mustHaves = pts;
  }

  // ── Furnishing.
  if (req.furnishing && l.furnishing) {
    possible += WEIGHTS.furnishing;
    const hit = lower(l.furnishing) === req.furnishing;
    if (hit) { score += WEIGHTS.furnishing; reasons.push(l.furnishing); }
    breakdown.furnishing = hit ? WEIGHTS.furnishing : 0;
  }

  // ── Occupants allowed.
  if (req.occupants.length && listingOccupants.length) {
    possible += WEIGHTS.occupants;
    const hit = overlap(req.occupants, listingOccupants);
    if (hit.length) { score += WEIGHTS.occupants; reasons.push("Occupant-friendly"); }
    breakdown.occupants = hit.length ? WEIGHTS.occupants : 0;
  }

  const pct = possible > 0 ? Math.round((score / possible) * 100) : 0;
  return { score: blockers.length ? 0 : pct, rawScore: pct, reasons, blockers, breakdown };
}

/**
 * Rank every requirement against one freshly-listed flat. Used on the List my
 * Flat success screen to show "this maps to N seekers looking right now".
 * Blocked or 0-overlap requirements are dropped.
 */
export function matchListingToRequirements(listing, requirements, { min = 40 } = {}) {
  return (requirements || [])
    .map((req) => ({ requirement: req, ...scoreMatch(listing, req) }))
    .filter((m) => m.blockers.length === 0 && m.score >= min)
    .sort((a, b) => b.score - a.score);
}

/** Symmetric helper: rank listings for one seeker (for the map / dashboard). */
export function matchRequirementToListings(requirement, listings, { min = 40 } = {}) {
  return (listings || [])
    .map((listing) => ({ listing, ...scoreMatch(listing, requirement) }))
    .filter((m) => m.blockers.length === 0 && m.score >= min)
    .sort((a, b) => b.score - a.score);
}
