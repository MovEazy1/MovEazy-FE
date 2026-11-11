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
export const setDayDeal = (day, kind, propertyId) => rpc("crm_deal_day_set", { p_day: day, p_kind: kind, p_property: propertyId || null });

/** WhatsApp text for sharing a deal. */
export function dealShareUrl(listing, what = "Steal Deal") {
  const link = `https://www.moveazy.co.in/property/${encodeURIComponent(listing.id)}`;
  const text = `${what} on MovEazy: ${listing.title} · ${listing.price}\n${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
