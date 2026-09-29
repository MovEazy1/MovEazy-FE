/**
 * Inventory search and filters for the partner app (PRD screens 01–02).
 *
 * Pure functions over the rows partner_inventory() returned, so what a broker
 * may see is already settled before anything here runs; this only narrows it.
 */
import { bedroomsOf } from "./partnerMatch";

export const ROOM_LABEL = "Room in shared flat";
export const BHK_CHIPS = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4+ BHK", "Room"];
/** What a listing or a lead can say it is. */
export const BHK_OPTIONS = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK", ROOM_LABEL];
/** What a partner lists: one tap each, 1 BHK preselected. */
export const HOUSE_TYPES = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK", ROOM_LABEL];
export const BROKERAGE_CHIPS = [
  { label: "Any", min: 0 },
  { label: "100%", min: 100 },
  { label: "75%+", min: 75 },
  { label: "50%+", min: 50 },
  { label: "25%+", min: 25 },
];
export const PROPERTY_TYPES = ["Apartment", "Villa", "Independent House", "Builder Floor"];
export const FURNISHING_CHIPS = ["Fully Furnished", "Semi Furnished", "Unfurnished"];
export const POPULAR_LOCATIONS = ["HSR Layout", "Koramangala", "Bellandur", "Indiranagar", "Whitefield"];

export const EMPTY_FILTERS = {
  locations: [], bhk: [], rentMin: "", rentMax: "", brokerageMin: 0, types: [], furnishing: [],
};

const norm = (s) => String(s || "").trim().toLowerCase();
const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Which BHK chip a listing falls under. */
export function bhkChipOf(l) {
  const b = bedroomsOf(l.flat_type) ?? num(l.bedrooms);
  if (b == null) return "";
  if (b === 0.25) return "Room";
  if (b === 0.5) return "1 RK";
  if (b >= 4) return "4+ BHK";
  return `${b} BHK`;
}

export function activeFilterCount(f = EMPTY_FILTERS) {
  return (f.locations.length ? 1 : 0) + (f.bhk.length ? 1 : 0) +
    (num(f.rentMin) != null || num(f.rentMax) != null ? 1 : 0) +
    (f.brokerageMin > 0 ? 1 : 0) + (f.types.length ? 1 : 0) + (f.furnishing.length ? 1 : 0);
}

/**
 * Free-text search: every word must appear somewhere in the card. "2bhk hsr 30k"
 * reads the way brokers type it — numbers compare against rent (±15%).
 */
export function matchesSearch(l, q) {
  const words = norm(q).replace(/(\d)\s*bhk/g, "$1 bhk").split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm([
    l.property_id, l.title, l.area, ...(l.nearby_areas ?? []), l.landmark, l.flat_type, bhkChipOf(l),
    l.furnishing, l.property_type, l.lister_name, l.lister_agency,
  ].join(" "));
  const rent = num(l.rent);
  return words.every((w) => {
    const k = /^(\d+(?:\.\d+)?)k$/.exec(w);
    const n = k ? Number(k[1]) * 1000 : /^\d{4,6}$/.test(w) ? Number(w) : null;
    if (n != null && rent != null) return Math.abs(rent - n) <= n * 0.15;
    return hay.includes(w);
  });
}

export function applyFilters(rows, f = EMPTY_FILTERS, q = "") {
  const locs = f.locations.map(norm);
  const lo = num(f.rentMin);
  const hi = num(f.rentMax);
  return rows.filter((l) => {
    if (!matchesSearch(l, q)) return false;
    if (locs.length) {
      const where = [l.area, ...(l.nearby_areas ?? [])].map(norm);
      if (!where.some((w) => locs.includes(w))) return false;
    }
    if (f.bhk.length && !f.bhk.includes(bhkChipOf(l))) return false;
    const rent = num(l.rent);
    if (lo != null && (rent == null || rent < lo)) return false;
    if (hi != null && (rent == null || rent > hi)) return false;
    if (f.brokerageMin > 0 && !((Number(l.brokerage_pct) || 0) >= f.brokerageMin)) return false;
    if (f.types.length && !f.types.map(norm).includes(norm(l.property_type))) return false;
    if (f.furnishing.length && !f.furnishing.map(norm).includes(norm(l.furnishing))) return false;
    return true;
  });
}
