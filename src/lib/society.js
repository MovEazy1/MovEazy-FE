/**
 * MovEazy Society — society.moveazy.co.in (pages/society/), and the CRM's
 * Societies page. The rules live in MovEazy-BE/supabase/society_app.sql.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { normalizeIndianMobile } from "./mobile";

/* ── Where the app lives ─────────────────────────────────────────────────── */

/** society.moveazy.co.in serves the app at its root; everywhere else it is /society. */
export function isSocietyHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return /^society\./i.test(String(hostname || ""));
}
export const SOCIETY_BASE = isSocietyHost() ? "" : "/society";
/** An in-app path, spelled the same on either host. */
export const sp = (path = "/") => `${SOCIETY_BASE}${path.startsWith("/") ? path : `/${path}`}` || "/";
export const SOCIETY_ORIGIN = "https://society.moveazy.co.in";
export const inviteUrl = (token) => `${SOCIETY_ORIGIN}/join/${token}`;

/* ── Calls ───────────────────────────────────────────────────────────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const fetchSocietyMe = () => rpc("society_me");
export const saveSocietySetup = (p) => rpc("society_setup_save", { p });
export const fetchSocietyHome = () => rpc("society_home");
export const fetchSocietyFlats = (filter = "all", q = "") => rpc("society_flats_list", { p_filter: filter, p_q: q });
export const fetchSocietyFlat = (id) => rpc("society_flat", { p_property: id });
export const saveSocietyFlat = (p) => rpc("society_flat_save", { p });
export const fetchSocietyMembers = () => rpc("society_members_list");
export const createSocietyInvite = (role) => rpc("society_invite_create", { p_role: role });
export const peekSocietyInvite = (token) => rpc("society_invite_peek", { p_token: token });
export const acceptSocietyInvite = (token, name = "") => rpc("society_invite_accept", { p_token: token, p_name: name });
export const updateSocietyMember = (id, { role = null, remove = false } = {}) =>
  rpc("society_member_update", { p_member: id, p_role: role, p_remove: remove });
export const setSocietySplit = (rows) => rpc("society_split_set", { p: rows });
export const fetchSocietyEarnings = () => rpc("society_earnings");
export const saveSocietyProfile = ({ name = null, upi = null } = {}) => rpc("society_profile_save", { p_name: name, p_upi: upi });
export const societyTick = () => rpc("society_tick").catch(() => 0);
export const fetchSocietyNotifications = () => rpc("society_notifications_list").then((r) => r ?? []);
export const markSocietyNotificationsRead = () => rpc("society_notifications_read").catch(() => {});

/* CRM */
export const fetchCrmSocieties = () => rpc("crm_societies");
export const fetchCrmSociety = (id) => rpc("crm_society", { p_building: id });
export const decideCrmSociety = (id, approve, reason = "") => rpc("crm_society_decide", { p_building: id, p_approve: approve, p_reason: reason });
export const setCrmSocietyPool = (id, pct) => rpc("crm_society_set_pool", { p_building: id, p_pct: pct });
export const setCrmSocietySettings = ({ live = null, defaultPool = null } = {}) =>
  rpc("crm_society_settings", { p_live: live, p_default_pool: defaultPool });
export const closeCrmSocietyDeal = (propertyId, { rent = null, closedOn = null, reference = "" } = {}) =>
  rpc("crm_society_deal_close", { p_property: propertyId, p_rent: rent, p_closed_on: closedOn, p_reference: reference });
export const cancelCrmSocietyDeal = (id, reason) => rpc("crm_society_deal_cancel", { p_deal: id, p_reason: reason });
export const markCrmSocietyPaid = (id, utr) => rpc("crm_society_payout_paid", { p_payout: id, p_utr: utr });

/* Tenants */
export const fetchExploreLive = () => rpc("societies_explore_live").catch(() => false);
export const fetchExploreSocieties = (lat = null, lng = null, km = 20) => rpc("societies_explore", { p_lat: lat, p_lng: lng, p_km: km });
export const fetchSocietyPublic = (code) => rpc("society_public", { p_code: code });

/* Google (api/places.js) */
async function authHeader() {
  const { data } = (await supabase?.auth.getSession()) ?? {};
  return data?.session?.access_token ? { authorization: `Bearer ${data.session.access_token}` } : {};
}
/** Details for a pasted Google Maps link: name, address, locality, spot, rating, photos. */
export async function lookupGooglePlace(link) {
  const r = await fetch(`/api/places?u=${encodeURIComponent(link)}`, { headers: await authHeader() });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Couldn't read that link.");
  return body;
}
/** A society's live Google rating and photos (cached a day at the edge). */
export async function fetchGooglePlace(placeId) {
  if (!placeId) return null;
  try {
    const r = await fetch(`/api/places?id=${encodeURIComponent(placeId)}`);
    const body = await r.json();
    return r.ok && body.configured ? body : null;
  } catch {
    return null;
  }
}
export const googlePhotoUrl = (name, w = 800) => `/api/places?photo=${encodeURIComponent(name)}&w=${w}`;
/** A Google photo's address while setting up (the place isn't one of ours yet, so it needs the session). */
export async function googlePhotoUri(name, w = 600) {
  try {
    const r = await fetch(`${googlePhotoUrl(name, w)}&json=1`, { headers: await authHeader() });
    return r.ok ? (await r.json()).uri || "" : "";
  } catch {
    return "";
  }
}

/* ── Words and numbers ───────────────────────────────────────────────────── */

export const BHK_TYPES = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK"];
export const FURNISHING = [
  { value: "Fully Furnished", label: "Furnished" },
  { value: "Semi Furnished", label: "Semi" },
  { value: "Unfurnished", label: "Unfurnished" },
];
export const ROLES = { manager: "Manager", guard: "Security Guard", staff: "Staff" };
export const SOCIETY_AMENITIES = [
  "Lift", "Power backup", "Gym", "Swimming pool", "Clubhouse", "Kids play area", "Garden", "Jogging track",
  "Indoor games", "Covered parking", "Visitor parking", "24×7 security", "CCTV", "Intercom", "Gated", "Water 24×7",
  "Gas pipeline", "Fire safety", "Rainwater harvesting", "Pet friendly", "Party hall", "Sports court",
];

/** ₹45,000 */
export const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
/** 2BHK (as on the cards) */
export const bhkShort = (b) => String(b || "").replace(/\s+/g, "");
export const initial = (n) => (String(n || "").trim()[0] || "M").toUpperCase();
export const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export const dayLabel = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** A UPI ID's shape (name@bank). MovEazy confirms it by paying into it. */
export const isUpiId = (v) => /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/.test(String(v || "").trim().toLowerCase());

/** Step one of Add Flat: what's missing, as one message per field. */
export function flatBasicsErrors(f, towers = []) {
  const e = {};
  if (towers.length && !towers.includes(f.block)) e.block = "Pick the building / block.";
  if (!/^[A-Za-z0-9/-]{1,12}$/.test(String(f.flat_no || "").replace(/\s+/g, ""))) e.flat_no = "Enter the flat number.";
  if (!BHK_TYPES.includes(f.bhk)) e.bhk = "Pick the BHK type.";
  const rent = Number(String(f.rent || "").replace(/[^\d]/g, ""));
  if (!rent || rent < 1000) e.rent = "Enter the expected rent.";
  else if (rent > 2000000) e.rent = "That rent looks too high.";
  if (!FURNISHING.some((x) => x.value === f.furnishing)) e.furnishing = "Pick the furnishing.";
  return e;
}

/** Step two: the owner. */
export function flatOwnerErrors(f) {
  const e = {};
  if (String(f.owner_name || "").trim().length < 2) e.owner_name = "Enter the owner's name.";
  if (!normalizeIndianMobile(f.owner_phone)) e.owner_phone = "Enter a 10-digit mobile number.";
  if (f.area_sqft && !(Number(f.area_sqft) >= 100 && Number(f.area_sqft) <= 20000)) e.area_sqft = "Size in sq ft (100–20,000).";
  return e;
}

/** The same block + flat number already in the list? */
export function findDuplicate(flats = [], block, flatNo, exceptId = "") {
  const fno = String(flatNo || "").replace(/\s+/g, "").toUpperCase();
  return flats.find((x) => x.property_id !== exceptId && String(x.block || "").toUpperCase() === String(block || "").toUpperCase()
    && String(x.flat_no || "").toUpperCase() === fno) || null;
}

/** "A-1203" the way the database labels it (society_flat_label). */
export function flatLabel(block, flatNo) {
  const b = String(block || "").replace(/(tower|block|wing|phase)/gi, "").replace(/\s+/g, "").replace(/^-+|-+$/g, "").toUpperCase();
  const f = String(flatNo || "").trim().toUpperCase();
  return b ? `${b}-${f}` : f;
}

/** Shares for the split editor: everyone, adding up to 100. */
export function splitTotal(rows = []) {
  return Math.round(rows.reduce((s, r) => s + (Number(r.pct) || 0), 0) * 100) / 100;
}
export function equalSplit(n) {
  if (!n) return [];
  const base = Math.floor(10000 / n) / 100;
  const out = Array(n).fill(base);
  out[0] = Math.round((100 - base * (n - 1)) * 100) / 100;
  return out;
}

/** Plain errors from the database. */
export function societyError(e, fallback = "Something went wrong. Please try again.") {
  const m = String(e?.message || "");
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "No internet connection. Check it and try again.";
  if (m && !/^(PGRST|JWT|permission denied for)/i.test(m) && m.length < 220) return m;
  return fallback;
}
