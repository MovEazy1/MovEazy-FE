/**
 * Single source of truth for the preference vocabulary shared between the
 * demand side (Train My Broker → AIBroker.jsx, saved as a customer search
 * profile) and the supply side (List my Flat → ListMyFlat.jsx, saved to the
 * `inventory` table).
 *
 * Both sides MUST describe a home with the exact same option strings, otherwise
 * the requirement↔listing matching in lib/inventoryMatch.js can never line up.
 * Add or rename an option here once and both flows stay in lockstep.
 */

export const LOCALITIES = ["HSR", "Koramangala", "Indiranagar", "Bellandur", "Whitefield", "Electronic City", "Sarjapur", "BTM", "JP Nagar", "Marathahalli"];
export const LOCALITIES_MORE = ["HSR Extension", "Kudlu Gate", "Harlur Road", "Silver County Road", "ITI Layout", "Jayanagar", "Hebbal", "Mahadevpura", "Bannerghatta Rd", "Yelahanka", "Rajajinagar"];
export const OCCUPANTS = ["Bachelor", "Family", "Couple", "Working Professionals", "Students", "Pet Owner"];

/**
 * Exclusions a poster can state, listed beside the occupant types but never
 * pre-selected — unlike the types above, which start all-on.
 *
 * They belong to the supply side only. A seeker answering "who'll be living
 * there?" describes themselves; "bachelor girls not allowed" is a rule about
 * someone else, and has no meaning as an answer to that question.
 */
export const OCCUPANT_RESTRICTIONS = ["Bachelor Boys Not Allowed", "Bachelor Girls Not Allowed"];

/** What a posting flow shows: who may live there, then who may not. */
export const OCCUPANT_OPTIONS = [...OCCUPANTS, ...OCCUPANT_RESTRICTIONS];
export const FLAT_TYPES = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "Villa", "Room in Preoccupied flat"];
export const MUST_HAVES = ["Balcony", "Gym", "Swimming Pool", "Lift", "Covered Parking", "Power Backup", "Security", "Terrace", "Garden", "Maid Room", "Modular Kitchen", "Study Room", "Pet Friendly", "Near Metro", "Near Office", "Gated Society", "Good Sunlight", "Quiet Area", "High Floor", "Low Floor"];
export const LIFESTYLE = ["Walkable cafes", "Nightlife", "Parks", "Running Track", "Office Commute", "Schools", "Hospitals", "Grocery Nearby", "Peaceful Area", "Young Crowd", "Community Living"];
export const DEALBREAKERS = ["No Sunlight", "Ground Floor", "Too Far From Metro", "Bachelor Restrictions", "Old Buildings", "Small Kitchen", "Traffic Heavy Roads", "Water Problems", "Poor Mobile Network"];
export const OFFICE_CHIPS = ["Manyata Tech Park", "Embassy Tech Village", "Bagmane Tech Park", "Electronic City", "RMZ Ecoworld", "Prestige Tech Park"];
export const AGES = ["18–24", "25–30", "31–35", "36–45", "46+"];
export const FURNISHINGS = ["Fully Furnished", "Semi Furnished", "Unfurnished"];

/** Every locality, in one flat list (for List my Flat dropdowns). */
export const ALL_LOCALITIES = [...LOCALITIES, ...LOCALITIES_MORE];

/**
 * Localities that contain other localities.
 *
 * People name the same place at different zoom levels: someone searching says
 * "HSR Extension", and the flat they want is listed as "Kudlu Gate". Both are
 * right, and without this the search misses it entirely.
 *
 * The rule runs in opposite directions on the two sides, which is the whole
 * point:
 *  - Asking for the parent means you'll take any of its children.
 *  - Listing a child means the flat is also in the parent, while the listing
 *    keeps the precise name so a renter still reads "Kudlu Gate".
 */
export const AREA_GROUPS = {
  "HSR Extension": ["Kudlu Gate", "Harlur Road", "Silver County Road", "ITI Layout"],
};

const norm = (a) => String(a || "").trim().toLowerCase();

/** The wider area this one sits inside, or "" if it isn't inside one. */
export function parentAreaOf(area) {
  const a = norm(area);
  for (const [parent, children] of Object.entries(AREA_GROUPS)) {
    if (children.some((c) => norm(c) === a)) return parent;
  }
  return "";
}

/** The areas this one contains, itself included. A leaf expands to just itself. */
export function expandArea(area) {
  const a = norm(area);
  for (const [parent, children] of Object.entries(AREA_GROUPS)) {
    if (norm(parent) === a) return [parent, ...children];
  }
  return area ? [area] : [];
}

/** Every area a requirement covers once the parents are opened up. */
export function expandAreas(areas = []) {
  const out = [];
  for (const a of areas) {
    for (const one of expandArea(a)) {
      if (!out.some((x) => norm(x) === norm(one))) out.push(one);
    }
  }
  return out;
}

/**
 * A listing's area plus the wider one it belongs to, for `nearby_areas`.
 * Listing "Kudlu Gate" should surface for someone who searched "HSR Extension",
 * without the listing itself pretending to be somewhere vaguer than it is.
 */
export function withParentArea(area, nearbyAreas = []) {
  const parent = parentAreaOf(area);
  if (!parent) return [...nearbyAreas];
  const has = nearbyAreas.some((n) => norm(n) === norm(parent));
  return has ? [...nearbyAreas] : [...nearbyAreas, parent];
}

/** Budget slider bounds — mirrored by the rent field on the listing side. */
export const BUDGET = { MIN: 15000, MAX: 200000, STEP: 1000 };
