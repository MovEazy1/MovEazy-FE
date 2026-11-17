/**
 * Deals on /find: Steal Deals of the Week and Deal of the Day
 * (MovEazy-BE/supabase/find_deals.sql), for the site and for CRM → Deals.
 *
 * Deals are best-value picks at the flat's own rent; why each is a steal is
 * worked out by the database from our own listings. A deal flat rented
 * mid-week stays on the list, marked rented.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { mapInventoryToListing } from "./inventory";

/** Deal of the Day's four slots, in order. */
export const DAY_KINDS = [
  { id: "1rk", label: "1 RK" },
  { id: "1bhk", label: "1 BHK" },
  { id: "2bhk", label: "2 BHK" },
  { id: "3bhk", label: "3 BHK+" },
];
export const dayKindLabel = (id) => DAY_KINDS.find((k) => k.id === id)?.label ?? id;

/** The slot a flat type fills — the same rule as deal_kind() in SQL. */
export function dealKind(flatType) {
  const t = String(flatType || "");
  if (/(^|\s)(1\s*rk|studio)/i.test(t)) return "1rk";
  if (/^\s*1\s*bhk/i.test(t)) return "1bhk";
  if (/^\s*2\s*bhk/i.test(t)) return "2bhk";
  if (/^\s*([3-9]|1[0-9])\s*bhk/i.test(t) || /villa|penthouse/i.test(t)) return "3bhk";
  return null;
}

/** "10–16 Nov", or "28 Oct – 3 Nov" across months (dates as YYYY-MM-DD). */
export function weekLabel(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const mon = (d) => d.toLocaleDateString("en-IN", { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${mon(b)}`
    : `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`;
}

/** Monday of the week holding `d` (a Date or YYYY-MM-DD), as YYYY-MM-DD. */
export function mondayOf(d) {
  const x = typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d);
  const back = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - back);
  return ymd(x);
}
export function ymd(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function addDays(day, n) {
  const x = new Date(`${day}T00:00:00`);
  x.setDate(x.getDate() + n);
  return ymd(x);
}

/** Time left to midnight IST: "5h 12m". */
export function untilMidnightIst(now = Date.now()) {
  const ist = new Date(now + (330 + new Date(now).getTimezoneOffset()) * 60000);
  const left = (24 * 60) - (ist.getHours() * 60 + ist.getMinutes());
  const h = Math.floor(left / 60);
  const m = left % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** A flat's best facts, for a deal the database had no comparison for. */
export function dealFacts(listing) {
  return [
    listing.furnishing,
    listing.availableFrom && new Date(listing.availableFrom) > new Date() ? `Free from ${new Date(listing.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Ready to move in",
    listing.isVerified ? "Verified by MovEazy" : "",
  ].filter(Boolean).join(" · ");
}

function deal(row) {
  if (!row?.listing) return null;
  const listing = mapInventoryToListing(row.listing);
  if (!listing) return null;
  return { listing, reason: row.reason || "", rented: Boolean(row.rented), kind: row.kind || dealKind(listing.bhk), since: row.since || "" };
}

/** What /find shows: { weekStart, weekEnd, today, steal: [deal], day: [deal] }. */
export async function fetchDealsFeed() {
  if (!isSupabaseConfigured || !supabase) return { weekStart: "", weekEnd: "", today: "", steal: [], day: [] };
  const { data, error } = await supabase.rpc("deals_feed");
  if (error) throw error;
  return {
    weekStart: data?.week_start || "",
    weekEnd: data?.week_end || "",
    today: data?.today || "",
    steal: (data?.steal ?? []).map(deal).filter(Boolean),
    day: (data?.day ?? []).map(deal).filter(Boolean),
  };
}

/* ── CRM → Deals ──────────────────────────────────────────────────────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** A week's Steal Deals, the weeks that have any, and the Deal of the Day calendar from..to. */
export const fetchCrmDeals = (week, from, to) => rpc("crm_deals", { p_week: week || null, p_from: from || null, p_to: to || null });
export const setStealDeals = (week, ids) => rpc("crm_deal_steal_set", { p_week: week, p_ids: ids });
export const addStealDeal = (week, propertyId) => rpc("crm_deal_steal_add", { p_week: week || null, p_property: propertyId });
/** Every live flat of one type ("1rk" | "1bhk" | "2bhk" | "3bhk") into a week's Steal Deals. */
export const addStealKind = (week, kind) => rpc("crm_deal_steal_add_kind", { p_week: week || null, p_kind: kind });
export const setDayDeal = (day, kind, propertyId) => rpc("crm_deal_day_set", { p_day: day, p_kind: kind, p_property: propertyId || null });

/** WhatsApp text for sharing a deal. */
export function dealShareUrl(listing, what = "Steal Deal") {
  const link = `https://www.moveazy.co.in/property/${encodeURIComponent(listing.id)}`;
  const text = `${what} on MovEazy: ${listing.title} · ${listing.price}\n${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/* ── Who looks at the deals (find_deals_tracking.sql) ─────────────────────── */

/**
 * What a visitor did on a deals page — "page", "open", "like", "unlike" — from
 * this browser (lib/leadIntake.js key; the number it gave makes it a CRM
 * client). → { likes: [property ids] } or null. Never throws.
 */
export async function dealTrack(deal, kind, propertyId = null) {
  // Loaded here, not at the top: it reads the browser as it loads.
  const { leadKey } = await import("./leadIntake");
  const key = leadKey();
  if (!isSupabaseConfigured || !supabase || !key) return null;
  const { data, error } = await supabase.rpc("deal_track", { p_lead_key: key, p_deal: deal, p_kind: kind, p_property: propertyId });
  return error ? null : data;
}

/** The general links the team shares, with where they came from. */
export const DEAL_LINKS = {
  steal: "https://www.moveazy.co.in/find/steal-deals",
  day: "https://www.moveazy.co.in/find/deal-of-the-day",
};
export const dealLink = (deal, source = "crm") =>
  `${DEAL_LINKS[deal]}?utm_source=${encodeURIComponent(source)}&utm_medium=whatsapp&utm_campaign=${deal === "steal" ? "steal_deals" : "deal_of_the_day"}`;

/** The WhatsApp message a deals link goes out with; `name` greets a client. */
export function dealMessage(deal, name = "") {
  const hi = name ? `Hi ${String(name).trim().split(/\s+/)[0]},` : "Hi,";
  return deal === "steal"
    ? `${hi} this week's Steal Deals on MovEazy — hand-picked flats priced below what's around them. Tap ♥ on the ones you like and we'll set up the visits:\n${dealLink("steal")}`
    : `${hi} today's Deal of the Day on MovEazy — one standout flat for each type, today only. Tap ♥ if you like it and we'll set up a visit:\n${dealLink("day")}`;
}

/** CRM: numbers per period (Mondays / days) and per deal flat. */
export const fetchDealStats = (deal, from, to) => rpc("crm_deal_stats", { p_deal: deal, p_from: from, p_to: to });
/** CRM: who opened, liked or booked one deal flat in one period. */
export const fetchDealPeople = (deal, key, propertyId) => rpc("crm_deal_people", { p_deal: deal, p_key: key, p_property: propertyId });
