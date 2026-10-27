/**
 * Website leads — a tenant's interest in a partner's flat on moveazy.co.in
 * becomes that partner's MovEazy lead (MovEazy-BE/supabase/partner_website_leads.sql
 * decides who, when and what; this file only calls it).
 *
 * Most interest is caught where it's already saved (♥, visits, opens). From
 * the browser we add: "Ask the broker to call me" on a flat, and — once
 * someone signs in — the partner flats they opened on this phone before. A
 * requirement that merely fits a flat is never a lead. Plus the ranking boost: partners on
 * trial or Premium have their flats float up when they fit.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { visitorId } from "./storefront";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/* ── Ranking ───────────────────────────────────────────────────────────── */
let flatIdsPromise = null;
/** { partner: Set, boosted: Set } of property ids — fetched once per page load. */
export function fetchPartnerFlatIds() {
  if (!flatIdsPromise) {
    flatIdsPromise = rpc("partner_flat_ids")
      .then((r) => ({ partner: new Set(r?.partner ?? []), boosted: new Set(r?.boosted ?? []) }))
      .catch(() => { flatIdsPromise = null; return { partner: new Set(), boosted: new Set() }; });
  }
  return flatIdsPromise;
}

export const BOOST = 12;   // points added to a boosted flat's score…
export const BOOST_FIT = 60; // …only when it already fits this well

/** Sort scored rows ({ score, ...}) best first, boosted partner flats up when they fit. `idOf` reads a row's property id. */
export function rankBoosted(rows, boosted, idOf) {
  const key = (r) => Number(r.score || 0) + (boosted?.has(idOf(r)) && Number(r.score || 0) >= BOOST_FIT ? BOOST : 0);
  return [...rows].sort((a, b) => key(b) - key(a));
}

/* ── The tenant's side ─────────────────────────────────────────────────── */
export const reportContactTap = (propertyId, channel = "whatsapp") =>
  rpc("flat_contact_tap", { p_property: String(propertyId || ""), p_channel: channel === "call" ? "call" : "whatsapp" }).catch(() => {});

/**
 * Once per tab after signing in with a number: partner flats opened on this
 * phone before become leads, and every flat or building page opened become
 * theirs on the owner's QR scans (owner_qr_overview.sql).
 */
export function claimEarlierViews(uid) {
  const key = `mz_views_claimed:${uid}`;
  try { if (sessionStorage.getItem(key)) return Promise.resolve(0); sessionStorage.setItem(key, "1"); } catch { /* fine */ }
  const v = visitorId();
  if (!v) return Promise.resolve(0);
  rpc("owner_scans_claim", { p_visitor: v }).catch(() => {});
  return rpc("flat_claim_views", { p_visitor: v }).catch(() => 0);
}

/* ── The partner's side ────────────────────────────────────────────────── */
/** One of my flats: { views: { today, week }, held, tenants: [{ name, phone, slug, assignment_id, kinds, detail, at }] } */
export const fetchFlatLeads = (propertyId) => rpc("partner_flat_leads", { p_property: propertyId });
/** assignment_id → [{ property_id, kind, detail, at, flat_type, area, rent }] */
export const fetchMyWebsiteInterest = () =>
  rpc("partner_website_interest_mine").then((r) => new Map((r ?? []).map((x) => [x.assignment_id, x.flats])), () => new Map());

export const KIND_LABEL = { liked: "Liked", opened: "Viewed", visit: "Wants a visit", contact: "Messaged", match: "Matches" };

/* ── The CRM ───────────────────────────────────────────────────────────── */
export const fetchWebsiteLeads = () => rpc("crm_website_leads").then((r) => r ?? []);

/** CRM curation: partners with live flats → [{ broker_id, name, ids: [property_id], boosted }], boosted first. Staff-read policies. */
export async function fetchPartnersWithFlats() {
  if (!isSupabaseConfigured || !supabase) return [];
  const [listings, partners, ids] = await Promise.all([
    supabase.from("partner_listings").select("property_id,broker_id"),
    supabase.from("broker_partners").select("user_id,name,status"),
    fetchPartnerFlatIds(),
  ]);
  if (listings.error || partners.error) return [];
  const byBroker = new Map();
  for (const l of listings.data ?? []) {
    if (!ids.partner.has(l.property_id)) continue; // live flats only
    if (!byBroker.has(l.broker_id)) byBroker.set(l.broker_id, []);
    byBroker.get(l.broker_id).push(l.property_id);
  }
  const names = new Map((partners.data ?? []).map((p) => [p.user_id, p.name]));
  return [...byBroker.entries()]
    .map(([broker_id, list]) => ({ broker_id, name: names.get(broker_id) || "Partner", ids: list, boosted: list.some((x) => ids.boosted.has(x)) }))
    .sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.ids.length - a.ids.length || a.name.localeCompare(b.name));
}
