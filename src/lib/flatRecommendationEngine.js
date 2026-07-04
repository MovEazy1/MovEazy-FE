/** Rank published listings against a flat-search preference profile. */

export const POPULAR_AREAS = [
  "Indiranagar",
  "HSR Layout",
  "Koramangala",
  "Bellandur",
  "Whitefield",
  "Mahadevpura",
  "Jayanagar",
  "Hebbal",
  "Marathahalli",
  "Electronic City",
  "Sarjapur Road",
  "BTM Layout",
];

export const BUDGET_PRESETS = [
  { label: "₹10k – ₹25k", min: 10000, max: 25000 },
  { label: "₹25k – ₹50k", min: 25000, max: 50000 },
  { label: "₹50k – ₹75k", min: 50000, max: 75000 },
  { label: "₹75k – ₹1.5L+", min: 75000, max: 200000 },
];

export const TIMELINE_OPTIONS = ["Immediate", "Within 15 days", "Within 30 days", "Flexible"];

export const BHK_OPTIONS = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "3+ BHK", "Roommate needed"];

export const FURNISHING_OPTIONS = ["Full", "Semi", "None", "Any"];

export const EMPTY_PREFERENCES = {
  areas: [],
  budgetMin: null,
  budgetMax: null,
  bhk: "",
  furnishing: "",
  timeline: "",
  mustHaves: "",
};

function localityFromListing(listing) {
  const parts = [
    listing.area,
    listing.address,
    listing.location,
    listing.title,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!parts.length) return "Bengaluru";
  return parts[0].split(",")[0].trim() || "Bengaluru";
}

function listingRent(listing) {
  const n = Number(listing.monthlyRent ?? listing.rent ?? 0);
  if (Number.isFinite(n) && n > 0) return n;
  const text = String(listing.price || "").toLowerCase().replace(/,/g, "");
  const lakh = text.match(/(\d+(\.\d+)?)\s*lakh/);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const num = text.match(/(\d+)/);
  return num ? Number(num[1]) : 0;
}

function normalizeBhkValue(raw) {
  const t = String(raw || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (t.includes("ROOMMATE") || t.includes("FLATMATE")) return "Roommate needed";
  if (t.includes("1 RK") || t === "RK") return "1 RK";
  if (t.includes("1 BHK") || t === "1BHK") return "1 BHK";
  if (t.includes("2 BHK") || t === "2BHK") return "2 BHK";
  if (t.includes("3+") || t.includes("4 BHK")) return "3+ BHK";
  if (t.includes("3 BHK") || t === "3BHK") return "3 BHK";
  return t;
}

function listingSearchBlob(listing) {
  return [
    listing.title,
    listing.description,
    listing.address,
    listing.location,
    listing.area,
    listing.propertyType,
    listing.furnishing,
    ...(Array.isArray(listing.amenities) ? listing.amenities : []),
    ...(Array.isArray(listing.furnishings) ? listing.furnishings : []),
  ]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
}

export function listingImageUrl(listing) {
  const keys = ["image", "coverImage", "cover_image_url", "thumbnail", "photo", "photoUrl"];
  for (const k of keys) {
    const u = String(listing?.[k] || "").trim();
    if (u) return u;
  }
  const imgs = listing?.images;
  if (Array.isArray(imgs)) {
    const first = imgs.map((x) => String(x || "").trim()).find(Boolean);
    if (first) return first;
  }
  return "";
}

export function isBangaloreListing(listing) {
  const t = `${listing.address || ""} ${listing.location || ""} ${listing.city || ""}`.toLowerCase();
  if (t.includes("bangalore") || t.includes("bengaluru")) return true;
  const loc = localityFromListing(listing).toLowerCase();
  if (POPULAR_AREAS.some((a) => loc === a.toLowerCase() || loc.includes(a.toLowerCase()))) return true;
  const lat = Number(listing.lat);
  const lng = Number(listing.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 12.72 && lat <= 13.22 && lng >= 77.38 && lng <= 77.82;
}

function areaMatchScore(listing, areas) {
  if (!areas?.length || areas.includes("Flexible")) return 0.5;
  const blob = `${localityFromListing(listing)} ${listingSearchBlob(listing)}`.toLowerCase();
  const hits = areas.filter((a) => blob.includes(String(a).toLowerCase()));
  if (hits.length === 0) return 0;
  return Math.min(1, 0.6 + hits.length * 0.2);
}

function budgetMatchScore(listing, min, max) {
  const rent = listingRent(listing);
  if (!rent) return 0.2;
  if (min == null && max == null) return 0.5;
  const lo = min ?? 0;
  const hi = max ?? 500000;
  if (rent >= lo && rent <= hi) return 1;
  const margin = Math.max(5000, hi * 0.15);
  if (rent >= lo - margin && rent <= hi + margin) return 0.55;
  return 0;
}

function bhkMatchScore(listing, preferredBhk) {
  if (!preferredBhk || preferredBhk === "Any") return 0.5;
  const listingBhk = normalizeBhkValue(listing.bhk || listing.bedroom_count);
  if (listingBhk === preferredBhk) return 1;
  if (preferredBhk === "3+ BHK" && listingBhk.includes("3")) return 0.85;
  return 0.15;
}

function furnishingMatchScore(listing, pref) {
  if (!pref || pref === "Any") return 0.5;
  const f = String(listing.furnishing || listing.is_furnished ? "Full" : "").toLowerCase();
  if (f.includes(pref.toLowerCase())) return 1;
  if (pref === "Semi" && (f.includes("semi") || f.includes("partial"))) return 0.9;
  return 0.2;
}

function timelineMatchScore(listing, timeline) {
  if (!timeline || timeline === "Flexible") return 0.5;
  const avail = String(listing.availability || "Immediate").toLowerCase();
  if (avail.includes(timeline.toLowerCase())) return 1;
  if (timeline === "Immediate" && avail.includes("immediate")) return 1;
  return 0.35;
}

function mustHaveScore(listing, mustHaves) {
  const text = String(mustHaves || "").trim().toLowerCase();
  if (!text) return 0.5;
  const blob = listingSearchBlob(listing);
  const tokens = text.split(/[,;]+|\band\b|\bor\b/).map((x) => x.trim()).filter((x) => x.length > 2);
  if (!tokens.length) return 0.5;
  const hits = tokens.filter((tok) => blob.includes(tok));
  return hits.length / tokens.length;
}

export function scoreListing(listing, prefs) {
  const p = { ...EMPTY_PREFERENCES, ...prefs };
  const weights = {
    area: 0.28,
    budget: 0.28,
    bhk: 0.18,
    furnishing: 0.1,
    timeline: 0.08,
    mustHaves: 0.08,
  };
  const scores = {
    area: areaMatchScore(listing, p.areas),
    budget: budgetMatchScore(listing, p.budgetMin, p.budgetMax),
    bhk: bhkMatchScore(listing, p.bhk),
    furnishing: furnishingMatchScore(listing, p.furnishing),
    timeline: timelineMatchScore(listing, p.timeline),
    mustHaves: mustHaveScore(listing, p.mustHaves),
  };
  const total =
    scores.area * weights.area +
    scores.budget * weights.budget +
    scores.bhk * weights.bhk +
    scores.furnishing * weights.furnishing +
    scores.timeline * weights.timeline +
    scores.mustHaves * weights.mustHaves;
  return { score: total, breakdown: scores };
}

export function recommendListings(listings, prefs, { limit = 8, minScore = 0.35 } = {}) {
  const rows = (Array.isArray(listings) ? listings : [])
    .filter(isBangaloreListing)
    .map((listing) => {
      const { score, breakdown } = scoreListing(listing, prefs);
      return { listing, score, breakdown };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

/** Map agent prefs → `/new-listings` query string. */
export function buildRecommendationMapHref(prefs) {
  const params = new URLSearchParams();
  const area = prefs.areas?.[0];
  if (area && area !== "Flexible") params.set("locality", area);
  if (prefs.budgetMin != null) params.set("minRent", String(prefs.budgetMin));
  if (prefs.budgetMax != null) params.set("maxRent", String(prefs.budgetMax));
  if (prefs.bhk) params.set("bhk", prefs.bhk);
  if (prefs.timeline && prefs.timeline !== "Flexible") params.set("availability", prefs.timeline);
  const qs = params.toString();
  return qs ? `/new-listings?${qs}` : "/new-listings";
}
