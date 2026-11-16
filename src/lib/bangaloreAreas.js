/**
 * Bangalore's main renting areas, for the society prospects (CRM → Society
 * prospects). Each is a centre and a reach in km, or — for a road — points
 * along it and how far either side counts. The first six (HSR and the roads
 * around it) live in lib/societyProspects.js as corridors; these are the rest.
 *
 * A society belongs to the area it sits deepest inside (its distance over the
 * area's reach, smallest wins).
 */
import { haversineKm } from "./geo";

export const ZONES = [
  { key: "southeast", label: "South-East" },
  { key: "south", label: "South" },
  { key: "central", label: "Central" },
  { key: "east", label: "East" },
  { key: "northeast", label: "North-East" },
  { key: "north", label: "North" },
  { key: "west", label: "West" },
];

const ZONE_COLOR = {
  southeast: "#0E7C68", south: "#B45309", central: "#7C3AED", east: "#0369A1", northeast: "#BE185D", north: "#15803D", west: "#9F1239",
};

/** [key, label, zone, centre | null, reach km, road points?] */
const RAW = [
  ["btm", "BTM Layout", "south", [12.9166, 77.6101], 1.8],
  ["jpnagar", "JP Nagar", "south", [12.9063, 77.5857], 2.4],
  ["jayanagar", "Jayanagar", "south", [12.9299, 77.5826], 1.7],
  ["banashankari", "Banashankari", "south", [12.9255, 77.5468], 2.2],
  ["kanakapura", "Kanakapura Road", "south", [12.8800, 77.5560], 2.5],
  ["bannerghatta", "Bannerghatta Road", "south", null, 1.2,
    [[12.9385, 77.5998], [12.925, 77.6], [12.912, 77.6008], [12.899, 77.6], [12.888, 77.597], [12.873, 77.595], [12.858, 77.588], [12.843, 77.581]]],
  ["begur", "Begur & Bommanahalli", "south", [12.886, 77.626], 1.7],
  ["hosur", "Hosur Road", "south", null, 1.0,
    [[12.9177, 77.6238], [12.907, 77.627], [12.9003, 77.629], [12.8932, 77.6405], [12.8807, 77.645], [12.8726, 77.6487], [12.86, 77.655]]],
  ["ecity", "Electronic City", "south", [12.8452, 77.6602], 3.0],
  ["koramangala", "Koramangala", "central", [12.9352, 77.6245], 1.8],
  ["indiranagar", "Indiranagar", "central", [12.9719, 77.6412], 1.6],
  ["domlur", "Domlur", "central", [12.961, 77.6387], 1.0],
  ["oldairport", "Old Airport Road", "central", null, 1.0,
    [[12.96, 77.645], [12.959, 77.655], [12.9575, 77.665], [12.956, 77.678], [12.9555, 77.69]]],
  ["bellandur", "Bellandur", "southeast", [12.93, 77.678], 1.8],
  ["kadubeesanahalli", "Kadubeesanahalli", "east", [12.9372, 77.697], 1.2],
  ["panathur", "Panathur", "east", [12.931, 77.713], 1.1],
  ["varthur", "Varthur Road", "east", null, 1.2,
    [[12.9545, 77.712], [12.95, 77.725], [12.945, 77.735], [12.94, 77.747], [12.938, 77.758]]],
  ["marathahalli", "Marathahalli", "east", [12.9569, 77.7011], 1.6],
  ["brookfield", "Brookfield", "east", [12.966, 77.718], 1.3],
  ["whitefield", "Whitefield", "east", [12.9698, 77.75], 3.0],
  ["mahadevapura", "Mahadevapura", "east", [12.993, 77.695], 1.6],
  ["krpuram", "KR Puram", "east", [13.02, 77.705], 1.6],
  ["kaggadasapura", "Kaggadasapura", "east", [12.985, 77.682], 1.1],
  ["cvraman", "CV Raman Nagar", "east", [12.986, 77.663], 1.3],
  ["banaswadi", "Banaswadi", "northeast", [13.014, 77.651], 1.3],
  ["kalyannagar", "Kalyan Nagar", "northeast", [13.024, 77.641], 1.2],
  ["hbr", "HBR Layout", "northeast", [13.035, 77.63], 1.2],
  ["hennur", "Hennur Road", "northeast", null, 1.2,
    [[13.025, 77.638], [13.035, 77.64], [13.045, 77.642], [13.055, 77.645], [13.065, 77.648], [13.075, 77.65]]],
  ["thanisandra", "Thanisandra", "northeast", [13.06, 77.633], 1.6],
  ["hebbal", "Hebbal", "north", [13.04, 77.597], 1.8],
  ["rtnagar", "RT Nagar", "north", [13.023, 77.594], 1.2],
  ["airportrd", "Airport Road (Bellary Road)", "north", null, 1.2,
    [[13.06, 77.598], [13.075, 77.6], [13.09, 77.602], [13.12, 77.615], [13.145, 77.635], [13.17, 77.66]]],
  ["yelahanka", "Yelahanka", "north", [13.1007, 77.5963], 2.5],
  ["malleshwaram", "Malleshwaram", "west", [13.0035, 77.57], 1.4],
  ["rajajinagar", "Rajajinagar", "west", [12.991, 77.553], 1.8],
  ["yeshwanthpur", "Yeshwanthpur", "west", [13.028, 77.54], 1.8],
];

export const CITY_AREAS = RAW.map(([key, label, zone, centre, km, line]) => ({
  key, label, zone, color: ZONE_COLOR[zone], centre, km, line: line || null,
}));

/** How far (km) a spot is from an area's centre or road. */
function distanceTo(a, lat, lng) {
  if (a.line) return Math.min(...a.line.map(([x, y]) => haversineKm(lat, lng, x, y)));
  return haversineKm(lat, lng, a.centre[0], a.centre[1]);
}

/** The city area a spot is deepest inside, or null (outside them all). */
export function cityAreaFor(lat, lng) {
  let best = null;
  let bestScore = Infinity;
  for (const a of CITY_AREAS) {
    const score = distanceTo(a, lat, lng) / a.km;
    if (score <= 1 && score < bestScore) { best = a.key; bestScore = score; }
  }
  return best;
}

/** Each zone's box (s, w, n, e) holding all its areas — what's asked of OpenStreetMap. */
export function zoneBoxes() {
  const kmLat = 1 / 111;
  return ZONES.map((z) => {
    const pts = CITY_AREAS.filter((a) => a.zone === z.key).flatMap((a) => (a.line || [a.centre]).map((p) => [p, a.km]));
    if (!pts.length) return null;
    const s = Math.min(...pts.map(([[x], km]) => x - km * kmLat));
    const n = Math.max(...pts.map(([[x], km]) => x + km * kmLat));
    const w = Math.min(...pts.map(([[x, y], km]) => y - (km * kmLat) / Math.cos((x * Math.PI) / 180)));
    const e = Math.max(...pts.map(([[x, y], km]) => y + (km * kmLat) / Math.cos((x * Math.PI) / 180)));
    return { zone: z.key, label: z.label, box: [s, w, n, e].map((v) => +v.toFixed(4)) };
  }).filter(Boolean);
}
