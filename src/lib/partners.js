/**
 * MovEazy Partners — every read and write the broker app makes.
 *
 * The authority is MovEazy-BE/supabase/partner_schema.sql. What a broker may
 * see (their own, MovEazy's, the network's, their groups') is decided in
 * partner_inventory() and nowhere else; this file never filters for access,
 * only for the screen. The tables underneath grant a broker nothing directly,
 * so there is no query here that could widen what they see.
 *
 * WhatsApp is the communication layer and stays outside: every customer
 * action ends in a wa.me link carrying the public /p/:id page. Nothing here
 * stores a message.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { buildInventoryRow, generatePropertyId, isMissingColumn, withoutOptionalColumns } from "./inventory";
import { propertyLink } from "./crmSettings";
import { normalizeIndianMobile } from "./mobile";

/* ── Where the app lives ─────────────────────────────────────────────────── */

/** partners.moveazy.co.in serves the app at its root; everywhere else it is /partners. */
export function isPartnerHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return /^partners\./i.test(String(hostname || ""));
}

export const PARTNER_BASE = isPartnerHost() ? "" : "/partners";

/** An in-app path, spelled the same on either host. */
export const pp = (path = "/") => `${PARTNER_BASE}${path.startsWith("/") ? path : `/${path}`}` || "/";

/** The customer-facing site. Shared links always point here, never at the partner host. */
export const PUBLIC_ORIGIN = "https://www.moveazy.co.in";

/** The canonical public page for a flat, attributed to the partner app. */
export function partnerPropertyLink(propertyId, medium = "whatsapp") {
  const url = new URL(propertyLink(propertyId, { source: "partner_app", medium, campaign: "partner_share" }));
  if (isPartnerHost() || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    // Local and partner-host links would send a customer somewhere they cannot
    // open; the public page is the one every surface agrees on.
    return `${PUBLIC_ORIGIN}${url.pathname}${url.search}`;
  }
  return url.toString();
}

/** Short form for display: moveazy.co.in/p/MZ-ABC123 */
export const displayLink = (propertyId) => `moveazy.co.in/p/${propertyId}`;

export function waLink(phone, text = "") {
  const local = normalizeIndianMobile(phone);
  const digits = local ? `91${local}` : String(phone || "").replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return digits ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
}

export const telLink = (phone) => {
  const local = normalizeIndianMobile(phone);
  return local ? `tel:+91${local}` : `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
};

export const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

export const inrShort = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 100000 ? `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L` : `₹${Math.round(v / 1000)}k`;
};

/** "2 BHK" / "1 RK" / "Villa" — whatever the listing calls itself. */
export function bhkLabel(l) {
  if (l?.flat_type) return l.flat_type;
  const b = Number(l?.bedrooms);
  return Number.isFinite(b) && b > 0 ? `${b} BHK` : "Home";
}

export const listingHeadline = (l) => `${bhkLabel(l)} • ${l?.area || "Bengaluru"}`;

/** The message a customer receives. Short: WhatsApp previews the link itself. */
export function customerMessage(l, { leadName = "" } = {}) {
  const hi = leadName ? `Hi ${leadName.split(" ")[0]}, ` : "Hi, ";
  const rent = Number(l?.rent) > 0 ? ` for ${inr(l.rent)}/month` : "";
  return `${hi}sharing this ${bhkLabel(l)} in ${l?.area || "Bengaluru"}${rent}.\n\nYou can view the full property details here:\n${partnerPropertyLink(l.property_id)}`;
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

function need() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
}

/** Postgres messages from the functions are written for people; others are not. */
export function friendlyError(e, fallback = "Something went wrong. Please try again.") {
  const msg = String(e?.message || "");
  if (/function .* does not exist|could not find the function/i.test(msg)) {
    return "The partner app isn't set up on this database yet (run partner_schema.sql).";
  }
  if (e?.code === "22023" || (e?.code === "42501" && !/permission denied/i.test(msg))) return msg;
  return msg && msg.length < 140 && !/violates|syntax|relation/i.test(msg) ? msg : fallback;
}

async function rpc(name, args) {
  need();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

/* ── Me ──────────────────────────────────────────────────────────────────── */

/** { partner, staff, can_manage, tiers } — partner is null before sign-up. */
export const fetchPartnerMe = () => rpc("partner_me");

export const registerPartner = ({ name, agency } = {}) =>
  rpc("partner_register", { p_name: name || null, p_agency: agency || null });

/** Premium = the moveazy_inventory tier is active. */
export const hasPremium = (me) => Boolean(me?.tiers?.moveazy_inventory?.active);

/* ── Inventory ───────────────────────────────────────────────────────────── */

export const SOURCES = [
  { key: "mine", label: "My" },
  { key: "moveazy", label: "Moveazy" },
  { key: "broker", label: "Brokers" },
  { key: "group", label: "Groups" },
];

export async function fetchPartnerInventory() {
  const rows = await rpc("partner_inventory");
  return (rows ?? []).map((r) => ({ ...r, group_ids: r.group_ids ?? [] }));
}

/** Which tab(s) a row belongs to. A listing shared both ways shows in both. */
export function inSource(row, source) {
  switch (source) {
    case "mine": return row.source === "mine";
    case "moveazy": return row.source === "moveazy";
    case "broker": return row.source === "broker" && row.on_platform;
    case "group": return row.group_ids.length > 0;
    default: return true;
  }
}

export const fetchPropertyContacts = (propertyId) =>
  rpc("partner_property_contacts_for", { p_property: propertyId }).then((r) => r ?? []);

/**
 * Publish a flat from the partner app. An ordinary inventory row — live on
 * moveazy.co.in like every other, enquiries there reach the CRM — then claimed
 * as a partner listing with its sharing.
 */
export async function createPartnerListing(draft, user, sharing) {
  need();
  let row = {
    ...buildInventoryRow({ ...draft, postedBy: "broker", phone: user?.phone || draft.phone }, user),
    property_type: draft.propertyType || "",
  };
  let propertyId = row.property_id;
  for (let attempt = 0; attempt < 4; attempt++) {
    // `returning` only the id: the full row carries columns a broker may not read back.
    const { error } = await supabase.from("inventory").insert(row).select("property_id").single();
    if (!error) break;
    if (error.code === "23505") {
      propertyId = generatePropertyId();
      row = { ...row, property_id: propertyId };
      continue;
    }
    if (isMissingColumn(error) && "property_type" in row) {
      row = withoutOptionalColumns(row);
      delete row.property_type;
      continue;
    }
    throw error;
  }
  await saveSharing(propertyId, sharing);
  return propertyId;
}

/** Edit a partner's own listing (RLS: poster only). */
export async function updatePartnerListing(propertyId, patch) {
  need();
  const { error } = await supabase.from("inventory").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId).select("property_id").single();
  if (error) throw error;
}

/**
 * sharing = { platformPct: number|null, groups: [{ group_id, pct }] }.
 * "Only me" is platformPct null and no groups.
 */
export const saveSharing = (propertyId, sharing = {}) =>
  rpc("partner_set_sharing", {
    p_property: propertyId,
    p_platform_pct: sharing.platformPct ?? null,
    p_groups: (sharing.groups ?? []).map((g) => ({ group_id: g.group_id, pct: Number(g.pct) || 0 })),
  });

/** Owner / tenant contacts for your own listing. */
export async function saveOwnContacts(propertyId, contacts = []) {
  need();
  for (const c of contacts) {
    const phone = String(c.phone || "").trim();
    const name = String(c.name || "").trim();
    if (!phone && !name) {
      await supabase.from("partner_property_contacts").delete().eq("property_id", propertyId).eq("role", c.role);
      continue;
    }
    const { error } = await supabase.from("partner_property_contacts").upsert({
      property_id: propertyId, role: c.role, name, phone,
      availability: c.availability || "", updated_at: new Date().toISOString(),
    }, { onConflict: "property_id,role" });
    if (error) throw error;
  }
}

export async function setListingStatus(propertyId, status) {
  return updatePartnerListing(propertyId, { status });
}

/* ── Saved ───────────────────────────────────────────────────────────────── */

export async function fetchSavedIds() {
  if (!isSupabaseConfigured || !supabase) return new Set();
  const { data, error } = await supabase.from("partner_saved").select("property_id");
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.property_id));
}

export async function toggleSaved(propertyId, on) {
  need();
  const q = on
    ? supabase.from("partner_saved").upsert({ property_id: propertyId }, { onConflict: "user_id,property_id", ignoreDuplicates: true })
    : supabase.from("partner_saved").delete().eq("property_id", propertyId);
  const { error } = await q;
  if (error) throw error;
}

/* ── Groups ──────────────────────────────────────────────────────────────── */

export const fetchMyGroups = () => rpc("partner_my_groups").then((r) => r ?? []);
export const createGroup = (name, description = "") =>
  rpc("partner_create_group", { p_name: name, p_description: description });
export const fetchGroupMembers = (groupId) =>
  rpc("partner_group_members_list", { p_group: groupId }).then((r) => r ?? []);
export const createInvite = (groupId) => rpc("partner_create_invite", { p_group: groupId });
export const previewInvite = (token) => rpc("partner_invite_preview", { p_token: token });
export const acceptInvite = (token) => rpc("partner_accept_invite", { p_token: token });
export const removeMember = (groupId, userId) =>
  rpc("partner_remove_member", { p_group: groupId, p_user: userId });
export const setMemberRole = (groupId, userId, role) =>
  rpc("partner_set_member_role", { p_group: groupId, p_user: userId, p_role: role });

/**
 * The join link, on whichever host the inviter is using — partners.moveazy.co.in
 * or moveazy.co.in/partners both serve the app, so either opens it.
 */
export function inviteLink(token) {
  const origin = typeof window !== "undefined" ? window.location.origin : PUBLIC_ORIGIN;
  return `${origin}${PARTNER_BASE}/join/${token}`;
}

export function inviteMessage(groupName, token, fromName = "") {
  return `${fromName ? `${fromName} has` : "You've been"} invited you to join *${groupName}* on MovEazy Partners — shared rental inventory for brokers, with brokerage shown on every flat.\n\nJoin here (sign in with Google):\n${inviteLink(token)}\n\nThe link works once and expires in 7 days.`;
}

/* ── Leads ───────────────────────────────────────────────────────────────── */

const LEAD_COLS = "id,name,phone,status,flat_types,budget_min,budget_max,localities,furnishing,notes,last_contacted_at,created_at,updated_at";

export async function fetchLeads() {
  need();
  const { data, error } = await supabase.from("partner_leads").select(LEAD_COLS).order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function leadRow(f) {
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    name: String(f.name || "").trim().slice(0, 120),
    phone: normalizeIndianMobile(f.phone) || String(f.phone || "").trim().slice(0, 20),
    flat_types: f.flat_types ?? [],
    budget_min: num(f.budget_min),
    budget_max: num(f.budget_max),
    localities: f.localities ?? [],
    furnishing: f.furnishing || "",
    notes: String(f.notes || "").slice(0, 1000),
    status: f.status || "active",
    updated_at: new Date().toISOString(),
  };
}

export async function saveLead(f, id = null) {
  need();
  const row = leadRow(f);
  const q = id
    ? supabase.from("partner_leads").update(row).eq("id", id)
    : supabase.from("partner_leads").insert(row);
  const { data, error } = await q.select(LEAD_COLS).single();
  if (error) throw error;
  return data;
}

export async function patchLead(id, patch) {
  need();
  const { data, error } = await supabase.from("partner_leads")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(LEAD_COLS).single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id) {
  need();
  const { error } = await supabase.from("partner_leads").delete().eq("id", id);
  if (error) throw error;
}

/* ── CRM (staff) ─────────────────────────────────────────────────────────── */

export const adminListPartners = () => rpc("partner_admin_list").then((r) => r ?? []);
export const adminSetStatus = (userId, status) => rpc("partner_admin_set_status", { p_user: userId, p_status: status });
export const adminSetAutoApprove = (on) => rpc("partner_admin_set_auto_approve", { p_on: on });
export const adminGrantPremium = (userId, months) =>
  rpc("partner_admin_grant_tier", { p_user: userId, p_tier: "moveazy_inventory", p_months: months });

export async function fetchProgramSettings() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("partner_program_settings").select("auto_approve,updated_at,updated_by").eq("id", 1).maybeSingle();
  if (error) return null;
  return data;
}

/**
 * property_id → { broker, platformPct, groups: [{ name, pct }] } for the CRM
 * Properties table: which partner added a flat and how they chose to share it.
 * Staff-read policies only; an empty map for anyone else.
 */
export async function fetchPartnerListingMap(propertyIds = []) {
  if (!isSupabaseConfigured || !supabase || !propertyIds.length) return {};
  const [listings, platform, groupShares, partners, groups] = await Promise.all([
    supabase.from("partner_listings").select("property_id,broker_id"),
    supabase.from("partner_platform_shares").select("property_id,share_pct"),
    supabase.from("partner_group_shares").select("property_id,group_id,share_pct"),
    supabase.from("broker_partners").select("user_id,name,phone,agency"),
    supabase.from("partner_groups").select("id,name"),
  ]);
  if (listings.error) return {};
  const wanted = new Set(propertyIds);
  const byUser = new Map((partners.data ?? []).map((p) => [p.user_id, p]));
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const map = {};
  for (const l of listings.data ?? []) {
    if (!wanted.has(l.property_id)) continue;
    map[l.property_id] = { broker: byUser.get(l.broker_id) ?? null, platformPct: null, groups: [] };
  }
  for (const s of platform.data ?? []) if (map[s.property_id]) map[s.property_id].platformPct = Number(s.share_pct);
  for (const s of groupShares.data ?? []) {
    if (map[s.property_id]) map[s.property_id].groups.push({ name: groupName.get(s.group_id) || "Group", pct: Number(s.share_pct) });
  }
  return map;
}

/** "All brokers 30% · HSR Brokers 50%" or "Only them". */
export function describeSharing(info) {
  if (!info) return "";
  const parts = [];
  if (info.platformPct != null) parts.push(`All brokers ${info.platformPct}%`);
  for (const g of info.groups ?? []) parts.push(`${g.name} ${g.pct}%`);
  return parts.length ? parts.join(" · ") : "Only them (not shared)";
}
