/**
 * Visit ad pages — one page per property and building for Meta ads, with one
 * button: Schedule a visit (MovEazy-BE/supabase/visit_ad_pages.sql decides
 * what's shown and what a booking does; this file calls it).
 *
 *   moveazy.co.in/visit/MZ-XXXX     a property
 *   moveazy.co.in/visit/b/H33PSH    a building
 *
 * The CRM copies the link with Meta UTMs on it; whatever UTM a visitor
 * arrives with is kept on their visit.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { visitorId } from "./storefront";
import { defaultVisitSlots } from "./visits";
import { trackPixel } from "./metaPixel";
import { PUBLIC_ORIGIN } from "./partners";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ad_id", "adset_id", "campaign_id"];

/** The UTM on this page's address, kept for the visit. */
export function readAdUtm(search = typeof window !== "undefined" ? window.location.search : "") {
  const q = new URLSearchParams(search);
  const out = {};
  for (const k of UTM_KEYS) {
    const v = q.get(k);
    if (v) out[k] = v.slice(0, 120);
  }
  return out;
}

/** The ad page's address; `meta` adds the UTMs the CRM's "Meta ad link" copies. */
export function adPageUrl(kind, ref, { meta = false } = {}) {
  const path = kind === "building" ? `/visit/b/${encodeURIComponent(ref)}` : `/visit/${encodeURIComponent(ref)}`;
  if (!meta) return `${PUBLIC_ORIGIN}${path}`;
  const q = new URLSearchParams({ utm_source: "facebook", utm_medium: "paid_social", utm_campaign: String(ref) });
  return `${PUBLIC_ORIGIN}${path}?${q}`;
}

/** What the page shows (null: no such page). */
export const fetchAdPage = (kind, ref) => rpc("visit_ad_page", { p_kind: kind, p_ref: ref });

/** The times the page offers: the team's for the property, else every day 10 am – 6 pm for 7 days. */
export function adSlots(page, now = Date.now()) {
  const team = (page?.slots ?? []).filter((s) => new Date(s).getTime() > now);
  if (team.length) return team.map((s) => new Date(s).toISOString());
  return defaultVisitSlots({ days: 7, now }).map((s) => s.slot_at);
}

/** The slots grouped by India-time day: [{ day: "2026-11-02", slots: [iso, …] }]. */
export function slotsByDay(slots = []) {
  const m = new Map();
  for (const s of slots) {
    const day = new Date(s).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (!m.has(day)) m.set(day, []);
    m.get(day).push(s);
  }
  return [...m.entries()].map(([day, list]) => ({ day, slots: list.sort() })).sort((a, b) => a.day.localeCompare(b.day));
}

/** "11 AM – 12 PM" (India time). */
export function slotLabel(iso) {
  const t = new Date(iso).getTime();
  const f = (x) => new Date(x).toLocaleTimeString("en-IN", { hour: "numeric", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase().replace(/\s+/g, " ");
  return `${f(t)} – ${f(t + 3600000)}`;
}

/** "Today", "Tomorrow", "Wed 5 Nov". */
export function dayLabel(day, now = Date.now()) {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrow = new Date(now + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  return new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** Book (or move) the visit. → { id, slot_at, moved, title, area, landmark } */
export async function bookAdVisit({ kind, ref, phone, name = "", slotAt, utm = {} }) {
  const r = await rpc("visit_ad_book", {
    p_kind: kind, p_ref: ref, p_visitor: visitorId() || "", p_phone: phone, p_name: name, p_slot: slotAt, p_utm: utm,
  });
  trackPixel("Schedule", { content_ids: [String(ref)], content_type: kind === "building" ? "product_group" : "home_listing" }, { user: { phone } });
  return r;
}

/* ── The CRM ─────────────────────────────────────────────────────────────── */
/**
 * Ad visits as the CRM's Visits page reads a booking: { id: "ad:…", ad: true,
 * client_id, property_id (a building's code for a building), building, name,
 * phone, slot_at, status, utm, reminder/confirmation stamps }.
 */
export async function fetchAdVisits(days = 30) {
  try {
    const rows = await rpc("crm_ad_visits", { p_days: days });
    return (rows ?? []).map((r) => ({
      ...r, id: `ad:${r.id}`, adId: r.id, ad: true, user_id: null, kind: "ad",
      property_id: r.property_id || r.building?.code || "",
    }));
  } catch {
    return [];
  }
}

/** Mark the reminder / confirmation sent (or not) on an ad visit. */
export const stampAdVisit = (adId, what, clear = false) => rpc("crm_ad_visit_stamp", { p_id: adId, p_what: what, p_clear: clear });

/** "Meta ad · P1 · banner-a" — where an ad visit came from. */
export function adSourceLabel(utm = {}) {
  const src = /^(fb|facebook|ig|instagram|meta)$/i.test(utm.utm_source || "") ? "Meta ad" : utm.utm_source || "Ad page";
  return [src, utm.utm_campaign, utm.utm_content].filter(Boolean).join(" · ");
}

/** A Google Calendar link for the visit (an hour). */
export function calendarLink({ title, slotAt, where = "" }) {
  const fmt = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(slotAt).getTime();
  const q = new URLSearchParams({
    action: "TEMPLATE", text: `Flat visit · ${title}`, dates: `${fmt(start)}/${fmt(start + 3600000)}`,
    details: "MovEazy will call you to confirm and share the exact location on WhatsApp.", location: where,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
