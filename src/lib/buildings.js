/**
 * Owner buildings — a property with many flats, its QR, and the visits it
 * brings. The page the QR opens is moveazy.co.in/building/<code>.
 *
 * The authority is MovEazy-BE/supabase/owner_buildings.sql: who may see a
 * number, move a visit or book a flat is decided there. This file only calls it.
 */
import { trackPixel } from "./metaPixel";
import { supabase, isSupabaseConfigured } from "./supabase";
import { PUBLIC_ORIGIN } from "./partners";
import { visitorId } from "./storefront";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** The public page for a code, always on moveazy.co.in. `qr` marks it as scanned from a poster. */
export const buildingUrl = (code, { qr = false } = {}) => `${PUBLIC_ORIGIN}/building/${code}${qr ? "?s=qr" : ""}`;
export const buildingDisplay = (code) => `moveazy.co.in/building/${code}`;

/* ── The public page ─────────────────────────────────────────────────────── */

export const fetchBuildingPage = (code) => rpc("building_page", { p_code: String(code || "") });

export function recordBuildingView(code, source) {
  return rpc("building_view", {
    p_code: code, p_visitor: visitorId() || "anonymous-visitor", p_source: source === "qr" ? "qr" : "link",
  }).catch(() => {});
}

/**
 * Call Caretaker (building_call_desk.sql): "contacts" logs the tenant and
 * resolves to { caretaker: { name, phone }, manager: { name, phone } }; "call"
 * (target caretaker | manager) and "feedback" (one of CALL_FEEDBACK, with a
 * note) are logged for MovEazy and the owner.
 */
export const buildingCallDesk = (code, { phone, name = "", kind = "contacts", target = "", feedback = "", note = "" }) =>
  rpc("building_call_desk", {
    p_code: code, p_visitor: visitorId() || "", p_phone: phone, p_name: name,
    p_kind: kind, p_target: target, p_feedback: feedback, p_note: note,
  });

/** What a tenant can say after the call. */
export const CALL_FEEDBACK = [
  { id: "pay_token", label: "Pay Token" },
  { id: "issues", label: "Have some issues" },
  { id: "flat_small", label: "Flat is small" },
  { id: "ventilation", label: "Ventilation issue" },
  { id: "call_not_picked", label: "Call not picked" },
  { id: "other", label: "Any other issue" },
];
export const callFeedbackLabel = (id) => CALL_FEEDBACK.find((f) => f.id === id)?.label || id;

/* Where a tenant the MovEazy team brought stands (building_tenant_tracks.sql). */
export const LIKED_STATUSES = [
  { id: "negotiate", label: "Negotiate on rent" },
  { id: "exploring", label: "Exploring other options" },
  { id: "will_pay_token", label: "Will pay token" },
  { id: "paid_token", label: "Paid token" },
];
export const DISLIKE_REASONS = [
  { id: "size_small", label: "Size is small" },
  { id: "office_distance", label: "Distance from office" },
  { id: "location", label: "Location issue" },
  { id: "ventilation", label: "Ventilation issue" },
  { id: "amenities", label: "Amenities issue" },
];
/** A built-in reason's words; a typed one is its own words. */
export const reasonLabel = (r) => DISLIKE_REASONS.find((x) => x.id === r)?.label || r;

/**
 * The numbers on a building's tenants page, from its board
 * (building_tenants_board.sql: rows of { phone, name, track, qr, views, status, via }).
 * Where a tenant stands is the team's card, else the latest answer on one of
 * the building's flats (tenant_views.sql).
 */
export function tenantBoardStats(tenants = [], today = new Date()) {
  const day = today.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const n = (f) => tenants.filter(f).length;
  const t = (x) => x.track || x.status;
  const reasons = {};
  for (const x of tenants) if (t(x)?.liked === "disliked") for (const r of t(x).reasons ?? []) reasons[r] = (reasons[r] || 0) + 1;
  return {
    total: tenants.length,
    fromQr: n((x) => x.qr), called: n((x) => (x.qr?.called ?? []).length > 0), noStatus: n((x) => !t(x)),
    viaMoveazy: n((x) => x.via === "moveazy"),
    visitDone: n((x) => t(x)?.visit === "done"), visitPending: n((x) => t(x) && t(x).visit !== "done"),
    liked: n((x) => t(x)?.liked === "liked"), disliked: n((x) => t(x)?.liked === "disliked"),
    ...Object.fromEntries(LIKED_STATUSES.map((s) => [s.id, n((x) => t(x)?.liked === "liked" && t(x).liked_status === s.id)])),
    due: n((x) => t(x)?.follow_up_on && t(x).follow_up_on <= day),
    reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]),
  };
}

/** Where a tenant on a building's board stands: the team's card, else their latest flat answer. */
const st = (x) => x.track || x.status;

/** The filters on a tenants page: id, label, and who's in. */
export const TENANT_FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "due", label: "Follow-up due", test: (x, day) => Boolean(st(x)?.follow_up_on && st(x).follow_up_on <= day) },
  { id: "qr", label: "From QR", test: (x) => Boolean(x.qr) },
  { id: "moveazy", label: "Via MovEazy Website", test: (x) => x.via === "moveazy" },
  { id: "new", label: "No status yet", test: (x) => !st(x) },
  { id: "pending", label: "Visit pending", test: (x) => st(x) && st(x).visit !== "done" },
  { id: "liked", label: "Liked", test: (x) => st(x)?.liked === "liked" },
  { id: "will_pay_token", label: "Will pay token", test: (x) => st(x)?.liked_status === "will_pay_token" },
  { id: "paid_token", label: "Paid token", test: (x) => st(x)?.liked_status === "paid_token" },
  { id: "disliked", label: "Did not like", test: (x) => st(x)?.liked === "disliked" },
];

/** Where a tenant stands, in a few words: "Liked · Will pay token", "Did not like · Size is small". */
export function trackSummary(t) {
  if (!t) return "Visit pending";
  if (t.liked === "liked") return ["Liked", LIKED_STATUSES.find((s) => s.id === t.liked_status)?.label].filter(Boolean).join(" · ");
  if (t.liked === "disliked") return ["Did not like", (t.reasons ?? []).map(reasonLabel).join(", ")].filter(Boolean).join(" · ");
  return t.visit === "done" ? "Visit done" : "Visit pending";
}

/** A renter's visit request. `visitAt`: a Date, or null for "call me to fix a time". */
export const requestBuildingVisit = (code, { name, phone, propertyIds = [], visitAt = null, note = "" }) =>
  rpc("building_request_visit", {
    p_code: code, p_visitor: visitorId() || "", p_name: name, p_phone: phone, p_properties: propertyIds,
    p_visit_at: visitAt ? visitAt.toISOString() : null, p_note: note,
  }).then((r) => {
    trackPixel("Lead", { content_category: "tenant", content_name: "building_visit" }, { user: { phone } });
    trackPixel("Schedule", { content_ids: propertyIds, content_type: "home_listing" }, { user: { phone } });
    return r;
  });

/**
 * An instant visit: the signed-in renter is heading there now. Back come the
 * POC's name and number, the address and when they're expected
 * (building_instant_visit). No flats picked means every free flat.
 */
export const startInstantVisit = (code, { name, phone, propertyIds = [] }) =>
  rpc("building_instant_visit", {
    p_code: code, p_visitor: visitorId() || "", p_name: name, p_phone: phone, p_properties: propertyIds,
  });

/** A visit of kind 'instant' — on the way now, not booked for later. */
export const isInstant = (lead) => lead?.kind === "instant";

/* ── The owner's side ────────────────────────────────────────────────────── */

/** Every tenant of one of my buildings and where each stands (building_tenants_board.sql). */
export const fetchOwnerBuildingTenants = (id) => rpc("owner_building_tenants", { p_building: id });

export const fetchMyBuildings = () => rpc("owner_buildings_list").then((r) => r ?? []);
export const fetchBuildingDetail = (id) => rpc("owner_building_detail", { p_building: id });
export const saveBuilding = (patch) => rpc("owner_building_save", { p: patch });
export const setFlatBuilding = (propertyId, buildingId, floor = null) =>
  rpc("owner_building_set_flat", { p_property: propertyId, p_building: buildingId, p_floor: floor === "" ? null : floor });
export const markFlatBooked = (propertyId, on) => rpc("owner_building_mark_booked", { p_property: propertyId, p_on: Boolean(on) });
/** Instant visit on (with who shows the flats) or off — the building's owner, or CRM staff. */
export const setInstantVisit = (buildingId, { on, name = "", phone = "" }) =>
  rpc("building_set_instant_visit", { p_building: buildingId, p_on: Boolean(on), p_name: name, p_phone: phone });

/* ── Working a visit: partner, CRM, owner ────────────────────────────────── */

export const updateBuildingLead = (id, patch) => rpc("building_lead_update", { p_lead: id, p_patch: patch });
export const fetchPartnerBuildingLeads = () => rpc("partner_building_leads").then((r) => r ?? { buildings: [], leads: [] });
export const fetchCrmBuildings = () => rpc("crm_buildings");
export const assignBuildingBroker = (buildingId, brokerId) =>
  rpc("crm_building_assign_broker", { p_building: buildingId, p_broker: brokerId || null });

/** Where a visit stands, in words — the same for the partner, the CRM and the owner. */
export const VISIT_STATUS = {
  new: { label: "New request", tone: "amber" },
  confirmed: { label: "Visit confirmed", tone: "blue" },
  visited: { label: "Visited", tone: "green" },
  no_show: { label: "Didn't come", tone: "grey" },
  booked: { label: "Booked", tone: "champ" },
  cancelled: { label: "Cancelled", tone: "grey" },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** 0 → "Ground floor", 1 → "1st floor", -1 → "Basement", null → "Floor not set". */
export function floorLabel(n) {
  if (n === null || n === undefined || n === "") return "Floor not set";
  const f = Number(n);
  if (f === 0) return "Ground floor";
  if (f < 0) return f === -1 ? "Basement" : `Basement ${-f}`;
  const tens = f % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[f % 10] || "th");
  return `${f}${suffix} floor`;
}

/** Flats grouped by floor, lowest first, unknown floor last: [{ floor, label, flats }]. */
export function flatsByFloor(flats = []) {
  const groups = new Map();
  for (const f of flats) {
    const key = f.floor_number === null || f.floor_number === undefined ? "none" : Number(f.floor_number);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : a - b))
    .map(([floor, list]) => ({
      floor: floor === "none" ? null : floor,
      label: floorLabel(floor === "none" ? null : floor),
      // Available flats first, then by rent.
      flats: [...list].sort((x, y) => Number(y.available !== false) - Number(x.available !== false) || (Number(x.rent) || 0) - (Number(y.rent) || 0)),
    }));
}

/** How a tenant can sort a building's flats. "popular" is MovEazy's own order (set in the CRM). */
export const FLAT_SORTS = [
  { id: "popular", label: "Popularity" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "flat_no", label: "Flat no." },
];

const byFlatNo = (a, b) => {
  const x = String(a.unit_no || "").trim(), y = String(b.unit_no || "").trim();
  if (!x || !y) return Number(!x) - Number(!y) || (Number(a.floor_number) || 0) - (Number(b.floor_number) || 0);
  return x.localeCompare(y, "en", { numeric: true, sensitivity: "base" });
};

/**
 * `flats` in the order a tenant picked. They arrive in MovEazy's order, which
 * is what "popular" keeps; ties in rent or flat number keep it too.
 */
export function sortFlats(flats = [], how = "popular") {
  const rent = (f) => Number(f.rent) || 0;
  const list = [...flats];
  if (how === "price_asc") return list.sort((a, b) => (rent(a) || Infinity) - (rent(b) || Infinity));
  if (how === "price_desc") return list.sort((a, b) => rent(b) - rent(a));
  if (how === "flat_no") return list.sort(byFlatNo);
  return list;
}

/** The next `n` days from `from`, at midnight local time. */
export function nextDays(n = 14, from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Array.from({ length: n }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * Visit times for a day, every 30 minutes from 9 am to 8 pm, minus any that
 * start within the hour when the day is today. Each is { at: Date, label }.
 */
export function visitTimes(day, now = new Date()) {
  const out = [];
  for (let mins = 9 * 60; mins <= 20 * 60; mins += 30) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(mins / 60), mins % 60);
    if (at.getTime() < now.getTime() + 60 * 60 * 1000) continue;
    const h = at.getHours();
    const label = `${((h + 11) % 12) + 1}:${String(at.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    out.push({ at, label, part: h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening" });
  }
  return out;
}

/** "Sat 5 Oct, 4:30 PM" — how a visit time reads everywhere. */
export function visitWhen(at) {
  if (!at) return "Time to be fixed";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "Time to be fixed";
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

/** ₹22k, ₹1.2L — rent where space is tight. */
export function shortInr(n) {
  const v = Number(n) || 0;
  if (!v) return "";
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  return `₹${Math.round(v / 1000)}k`;
}

export const cleanMobile = (raw) => String(raw || "").replace(/\D/g, "").slice(-10);
export const isMobile = (raw) => /^[6-9]\d{9}$/.test(cleanMobile(raw));
