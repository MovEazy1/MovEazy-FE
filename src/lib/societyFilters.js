/**
 * The tenant site's society filters (moveazy.co.in/find/societies): amenities
 * and budget. Researched amenities are free text ("Swimming Pool", "Pool",
 * "Infinity pool"), so each filter chip matches a family of words.
 */
export const AMENITY_FILTERS = [
  { id: "pool", label: "Swimming pool", re: /pool/i },
  { id: "gym", label: "Gym", re: /\bgym|fitness/i },
  { id: "club", label: "Clubhouse", re: /club/i },
  { id: "kids", label: "Kids play area", re: /kid|child|play ?(area|ground)|creche|tot/i },
  { id: "power", label: "Power backup", re: /power|back-?up|generator|dg\b/i },
  { id: "parking", label: "Parking", re: /parking|car park/i },
  { id: "security", label: "24×7 security", re: /security|cctv|guard/i },
  { id: "sports", label: "Sports courts", re: /tennis|badminton|basketball|squash|court|cricket|football/i },
  { id: "walk", label: "Jogging track", re: /jog|walk|track|trail/i },
  { id: "lift", label: "Lift", re: /lift|elevator/i },
];

export const BHK_FILTERS = [{ id: "1", label: "1 BHK" }, { id: "2", label: "2 BHK" }, { id: "3", label: "3 BHK" }, { id: "4", label: "4 BHK" }];
export const BUDGETS = [15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000];

/** Has every picked amenity (by family). */
export function hasAmenities(society, picked) {
  if (!picked.length) return true;
  const tags = society.amenity_tags ?? society.amenities ?? [];
  return picked.every((id) => {
    const f = AMENITY_FILTERS.find((x) => x.id === id);
    return !f || tags.some((t) => f.re.test(t));
  });
}

/**
 * Against a budget (and maybe a BHK): "fits" when the cheapest rent known for
 * that type (any type when none is picked) is within budget, "over" when it
 * isn't, "unknown" when no rent is known yet.
 */
export function budgetFit(society, budget, bhk) {
  if (!budget) return "fits";
  const rents = society.rents ?? {};
  const keys = bhk ? [bhk] : ["1rk", "1", "2", "3", "4"];
  const mins = keys.map((k) => Number((rents[k] ?? [])[0])).filter((v) => v > 0);
  if (!mins.length) return "unknown";
  return Math.min(...mins) <= budget ? "fits" : "over";
}

/** Filter, keeping rent-unknown ones (when a budget is set) at the bottom. */
export function filterSocieties(rows, { amenities = [], budget = 0, bhk = "" }) {
  const ok = [];
  const unknown = [];
  for (const s of rows) {
    if (!hasAmenities(s, amenities)) continue;
    const fit = budgetFit(s, budget, bhk);
    if (fit === "fits") ok.push(s);
    else if (fit === "unknown") unknown.push(s);
  }
  return { ok, unknown };
}

export const budgetLabel = (v) => (v >= 100000 ? `₹${v / 100000}L` : `₹${Math.round(v / 1000)}k`);
