/**
 * Society prospects — the gated societies around HSR the team means to bring
 * on (CRM → Society prospects; MovEazy-BE/supabase/society_prospects.sql).
 *
 * The import walks six corridors — HSR Layout, Sarjapur Road (Agara to
 * Dommasandra), Haralur Road, Silver County Road, Hosa Road, Kudlu Road — in
 * cells of about 650 m, asking Google (api/places.js ?sweep) for the apartment
 * complexes and the real-estate agencies in each. The roads' shapes are
 * OpenStreetMap's, sampled every 300 m; a cell is swept when its middle is
 * within a kilometre of a road, or inside HSR.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { haversineKm } from "./geo";

export const ROADS = [
  { key: "hsr", label: "HSR Layout", color: "#0E7C68" },
  { key: "sarjapur", label: "Sarjapur Road", color: "#CC3F28" },
  { key: "haralur", label: "Haralur Road", color: "#7C3AED" },
  { key: "silver", label: "Silver County Road", color: "#0369A1" },
  { key: "hosa", label: "Hosa Road", color: "#B45309" },
  { key: "kudlu", label: "Kudlu Road", color: "#BE185D" },
];
export const roadLabel = (key) => ROADS.find((r) => r.key === key)?.label ?? key;

export const STATUSES = [
  { key: "prospect", label: "Prospect", color: "#64748B" },
  { key: "contacted", label: "Contacted", color: "#D97706" },
  { key: "interested", label: "Interested", color: "#2563EB" },
  { key: "onboarded", label: "Onboarded", color: "#059669" },
];
export const statusOf = (key) => STATUSES.find((s) => s.key === key) ?? STATUSES[0];

export const CONTACT_KINDS = [
  { key: "office", label: "Society office" },
  { key: "manager", label: "Society manager" },
  { key: "guard", label: "Guard" },
  { key: "broker", label: "Broker" },
  { key: "tenant", label: "Tenant" },
];

const HSR = { s: 12.897, w: 77.628, n: 12.926, e: 77.662 };

/** Each road, a point every ~300 m (OpenStreetMap). */
export const CORRIDORS = {
  sarjapur: [[12.9245, 77.65], [12.9245, 77.6466], [12.8818, 77.7568], [12.9212, 77.6624], [12.9027, 77.7056], [12.9194, 77.6676], [12.9185, 77.6703], [12.9171, 77.6732], [12.9073, 77.695], [12.908, 77.6922], [12.9088, 77.6894], [12.9098, 77.6867], [12.8958, 77.7221], [12.8944, 77.7249], [12.8931, 77.7275], [12.8914, 77.7297], [12.8896, 77.732], [12.8882, 77.7344], [12.8876, 77.7373], [12.9122, 77.6812], [12.9137, 77.6782], [12.8833, 77.7524], [12.8969, 77.7195], [12.9067, 77.6977], [12.9055, 77.7004], [12.9041, 77.7029], [12.9109, 77.6841], [12.9014, 77.7081], [12.9004, 77.7107], [12.8991, 77.7132], [12.8981, 77.7164], [12.886, 77.7442], [12.8851, 77.7468], [12.8842, 77.7496], [12.9149, 77.6752], [12.924, 77.6531], [12.8872, 77.7404]],
  haralur: [[12.8896, 77.6565], [12.8864, 77.6561], [12.883, 77.6556], [12.8801, 77.655], [12.8773, 77.6548], [12.8746, 77.6544], [12.8709, 77.6541], [12.8941, 77.6571], [12.9183, 77.6685], [12.9157, 77.6675], [12.9127, 77.6657], [12.9105, 77.6634], [12.9074, 77.6636], [12.9049, 77.6625], [12.9025, 77.6608], [12.9, 77.6595], [12.8976, 77.6583]],
  silver: [[12.8941, 77.6571], [12.8947, 77.6598], [12.8945, 77.6626], [12.8925, 77.6655], [12.8908, 77.6681], [12.8889, 77.6719]],
  hosa: [[12.8699, 77.6534], [12.8758, 77.6714], [12.8737, 77.6663], [12.872, 77.663], [12.8706, 77.6562], [12.8707, 77.6595]],
  kudlu: [[12.8896, 77.6565], [12.889, 77.6533], [12.8891, 77.6505], [12.8919, 77.6496], [12.8941, 77.6516], [12.8944, 77.6544], [12.8892, 77.6401], [12.8902, 77.647], [12.8907, 77.644]],
};

const NEAR_ROAD_KM = 1;
const CELL = 0.006;
const inHsr = (lat, lng) => lat >= HSR.s && lat <= HSR.n && lng >= HSR.w && lng <= HSR.e;

/** How far (km) a spot is from each road. */
function roadDistances(lat, lng) {
  return Object.entries(CORRIDORS).map(([key, pts]) => [key, Math.min(...pts.map(([a, o]) => haversineKm(lat, lng, a, o)))]);
}

/** The cells the import sweeps: { s, w, n, e } rectangles of about 650 m. */
export function sweepCells() {
  const cells = [];
  for (let i = 0; 12.855 + i * CELL < 12.94; i++) {
    for (let j = 0; 77.62 + j * CELL < 77.765; j++) {
      const s = +(12.855 + i * CELL).toFixed(4);
      const w = +(77.62 + j * CELL).toFixed(4);
      const lat = s + CELL / 2;
      const lng = w + CELL / 2;
      if (inHsr(lat, lng) || roadDistances(lat, lng).some(([, km]) => km < NEAR_ROAD_KM)) {
        cells.push({ s, w, n: +(s + CELL).toFixed(4), e: +(w + CELL).toFixed(4) });
      }
    }
  }
  return cells;
}

/** Which road a society belongs to: HSR if inside it, else the nearest road (null past 1.5 km). */
export function roadFor(lat, lng) {
  if (inHsr(lat, lng)) return "hsr";
  const [key, km] = roadDistances(lat, lng).sort((a, b) => a[1] - b[1])[0];
  return km <= 1.5 ? key : null;
}

const SOCIETY_TYPES = new Set(["apartment_complex", "apartment_building", "condominium_complex", "housing_complex"]);
const NOT_A_SOCIETY = /\b(p\.?\s?g|paying guest|hostel|co-?living|coliving|stays?|homestay|guest ?house|service[ds]? apartments?|serviced|hotel|inn|lodge|oyo|for (rent|sale)|sales? (office|gallery)|site office|experience cent(er|re)|builders?|developers?|realty|properties|real estate|interiors?|office space|showroom)\b/i;

/** A gated society or apartment complex — not a PG, hotel, sales office or agency. */
export function isSociety(p) {
  return !!p?.name && (p.types || []).some((t) => SOCIETY_TYPES.has(t)) && !NOT_A_SOCIETY.test(p.name);
}

/** "Prestige Lakeside Habitat Tower 5 Gate" → "prestige lakeside habitat". */
export function baseName(name) {
  return String(name || "").toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\b(tower|block|wing|phase|building|bldg|villa|apartment|flat|gate|entrance|club ?house|main gate|back gate|security|lobby|no\.?)\s*[-#]?\s*[a-z0-9]{0,3}\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One row per society: Google often pins a society several times (towers,
 * gates, the clubhouse). Same place id, or the same name within 600 m, is one
 * society — kept under its shortest name, with a phone if any pin had one.
 */
export function mergeSocieties(places) {
  const seen = new Map();
  for (const p of places) if (p?.place_id && !seen.has(p.place_id)) seen.set(p.place_id, p);
  const out = [];
  for (const p of [...seen.values()].sort((a, b) => a.name.length - b.name.length)) {
    const base = baseName(p.name);
    // "Adarsh Palm Retreat Daffodils" beside "Adarsh Palm Retreat" is one of its phases.
    const same = (o) => {
      const b = baseName(o.name);
      return b === base || (b.length >= 6 && base.startsWith(`${b} `));
    };
    const twin = base && out.find((o) => same(o) && haversineKm(o.lat, o.lng, p.lat, p.lng) < 0.6);
    if (twin) {
      if (!twin.phone && p.phone) twin.phone = p.phone;
      continue;
    }
    out.push({ ...p });
  }
  return out;
}

/** The agencies nearest a society (within 2 km), up to `n`. */
export function nearestAgents(soc, agents, n = 5) {
  return agents
    .filter((a) => a.phone)
    .map((a) => ({ ...a, km: haversineKm(soc.lat, soc.lng, a.lat, a.lng) }))
    .filter((a) => a.km <= 2)
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map((a) => ({ name: a.name, phone: a.phone, note: `Agency ${a.km < 1 ? `${Math.round(a.km * 1000)} m` : `${a.km.toFixed(1)} km`} away (Google Maps)` }));
}

/** The locality out of Google's address: "…, Haralur, Bengaluru, Karnataka 560102" → "Haralur". */
export function areaFromAddress(address) {
  const parts = String(address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const i = parts.findIndex((s) => /^(bengaluru|bangalore)\b/i.test(s));
  return i > 0 ? parts[i - 1].replace(/\b\d{6}\b/, "").trim() : "";
}

/**
 * Turn the sweep's raw results into import rows: societies only, merged,
 * on a road, each with its nearest agencies.
 */
export function importRows(cellsResults) {
  const all = cellsResults.flatMap((r) => r?.societies ?? []);
  const agents = mergeAgents(cellsResults.flatMap((r) => r?.agents ?? []));
  return mergeSocieties(all.filter(isSociety))
    .map((s) => ({ ...s, road: roadFor(s.lat, s.lng) }))
    .filter((s) => s.road)
    .map((s) => ({
      place_id: s.place_id, name: s.name, road: s.road, area: areaFromAddress(s.address), address: s.address,
      lat: s.lat, lng: s.lng, maps_url: s.maps_url, phone: s.phone, agents: nearestAgents(s, agents),
    }));
}

/* ── OpenStreetMap: the free import ───────────────────────────────────────── */

// The corridors' box (the cells reach no further); places in it are kept only
// when they are near one of the six roads (roadFor).
const OSM_BOX = "12.855,77.62,12.94,77.765";
export const OSM_QUERY = `[out:json][timeout:120];
(
  nwr["name"]["landuse"="residential"](${OSM_BOX});
  nwr["name"]["building"~"^(apartments|residential)$"](${OSM_BOX});
  nwr["office"="estate_agent"](${OSM_BOX});
  nwr["shop"="estate_agent"](${OSM_BOX});
);
out bb tags;`;
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

// A named area that is a neighbourhood, a government campus or an empty plot, not a society.
const NOT_A_SOCIETY_AREA = /\b(layout|colony|quarters|nagar|village|extension|sector|stage|empty|site|police|slum|homestay|campus|battalion|cpwd|ksrp|kssidc|hostel|colive|plots?|arcade|tea|spice|cafe|restaurant|work)\b|\(u\/c\)|under construction/i;
// A building named like one tower of something bigger, or a house.
const ONE_TOWER = /\b(tower|block|wing|phase|club ?house|building|complex|house|nivas|nilaya|mansion|bhavan|bhavana)\b|^[\w\s./&,()-]{0,6}$|^\d/i;

const osmPhone = (t) => String(t.phone || t["contact:phone"] || t["contact:mobile"] || "").split(";")[0].trim();

/** OpenStreetMap's answer → import rows: societies near the six roads, with any agencies nearby. */
export function osmRows(elements) {
  // Ways and relations come with their bounding box ("out bb"); a node with its spot.
  const els = (elements || []).filter((e) => e?.tags && (e.bounds || e.center || e.lat != null));
  const at = (e) => (e.bounds
    ? { lat: (e.bounds.minlat + e.bounds.maxlat) / 2, lng: (e.bounds.minlon + e.bounds.maxlon) / 2 }
    : { lat: e.center?.lat ?? e.lat, lng: e.center?.lon ?? e.lon });
  const toPlace = (e) => {
    const t = e.tags;
    const addr = [t["addr:housename"], t["addr:street"], t["addr:suburb"] || t["addr:place"], t["addr:city"]].filter(Boolean).join(", ");
    return {
      place_id: `osm-${e.type}-${e.id}`, name: String(t.name || "").trim(), ...at(e), address: addr,
      area: t["addr:suburb"] || t["addr:place"] || "", maps_url: `https://www.openstreetmap.org/${e.type}/${e.id}`, phone: osmPhone(t),
    };
  };

  const areas = els.filter((e) => e.tags.landuse === "residential" && e.tags.name && !NOT_A_SOCIETY_AREA.test(e.tags.name) && !NOT_A_SOCIETY.test(e.tags.name));
  // A named block inside a society's outline is a tower of it, not another society.
  const inside = (p) => areas.some((a) => a.bounds && p.lat >= a.bounds.minlat && p.lat <= a.bounds.maxlat && p.lng >= a.bounds.minlon && p.lng <= a.bounds.maxlon);
  const buildings = els
    .filter((e) => /^(apartments|residential)$/.test(e.tags.building || "") && e.tags.landuse !== "residential" && e.tags.name
      && !ONE_TOWER.test(e.tags.name) && !NOT_A_SOCIETY.test(e.tags.name) && /[a-z]{3}/i.test(e.tags.name))
    .map(toPlace)
    .filter((p) => !inside(p));
  const agents = els.filter((e) => e.tags.office === "estate_agent" || e.tags.shop === "estate_agent")
    .map(toPlace).filter((a) => a.name && a.phone);

  return mergeSocieties([...areas.map(toPlace), ...buildings])
    .map((s) => ({ ...s, road: roadFor(s.lat, s.lng) }))
    .filter((s) => s.road)
    .map((s) => ({
      place_id: s.place_id, name: s.name, road: s.road, area: s.area, address: s.address,
      lat: s.lat, lng: s.lng, maps_url: s.maps_url, phone: s.phone, agents: nearestAgents(s, agents),
    }));
}

/** Ask OpenStreetMap (free, no key), trying a second server if the first is busy. */
export async function fetchOsm() {
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: OSM_QUERY }) });
      if (r.ok) return (await r.json()).elements || [];
    } catch { /* the next server */ }
  }
  throw new Error("OpenStreetMap didn't answer. Try again in a minute.");
}

function mergeAgents(list) {
  const m = new Map();
  for (const a of list) if (a?.place_id && !m.has(a.place_id)) m.set(a.place_id, a);
  return [...m.values()];
}

/* ── Calls ───────────────────────────────────────────────────────────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const fetchProspects = () => rpc("society_prospects_list");
export const fetchProspect = (id) => rpc("society_prospect_get", { p_id: id });
export const saveProspect = (p) => rpc("society_prospect_save", { p });
export const saveProspectContact = (p) => rpc("society_prospect_contact_save", { p });
export const removeProspectContact = (id) => rpc("society_prospect_contact_remove", { p_id: id });

/** Save the import in batches of 100. Returns { added, updated }. */
export async function importProspects(rows, onProgress) {
  let added = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const r = await rpc("society_prospects_import", { p_rows: rows.slice(i, i + 100) });
    added += r.added;
    updated += r.updated;
    onProgress?.(Math.min(rows.length, i + 100), rows.length);
  }
  return { added, updated };
}

async function authHeader() {
  const { data } = (await supabase?.auth.getSession()) ?? {};
  return data?.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {};
}

/**
 * Sweep every cell through Google, four at a time. Calls onProgress(done, total).
 * A cell that fails is tried once more; failures are counted, not fatal.
 */
export async function sweepGoogle(onProgress) {
  const cells = sweepCells();
  const headers = await authHeader();
  const results = [];
  let done = 0;
  let failed = 0;
  let next = 0;
  const one = async (c) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(`/api/places?sweep=${c.s},${c.w},${c.n},${c.e}`, { headers }).catch(() => null);
      if (r?.status === 403) throw new Error("Only the super admin can import.");
      if (r?.status === 503) throw new Error("Google isn't set up on the server (GOOGLE_MAPS_API_KEY).");
      if (r?.ok) return r.json();
    }
    failed += 1;
    return null;
  };
  const worker = async () => {
    while (next < cells.length) {
      const c = cells[next++];
      results.push(await one(c));
      onProgress?.(++done, cells.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { results, failed, cells: cells.length };
}

/* ── Prospect helpers ─────────────────────────────────────────────────────── */

export const prospectError = (e) => e?.message || "Something went wrong.";

/** "₹28k–35k" for a [min, max] rent pair. */
export function rentRange(pair) {
  if (!Array.isArray(pair) || !pair.length) return "";
  const k = (v) => (v >= 100000 ? `${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L` : `${Math.round(v / 1000)}k`);
  const [a, b] = pair.map(Number).filter((v) => v > 0);
  if (!a) return "";
  return !b || a === b ? `₹${k(a)}` : `₹${k(a)}–${k(b)}`;
}
