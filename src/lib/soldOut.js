/**
 * Sold out — a listing off the market because it was let (status 'rented'),
 * with the day it went (MovEazy-BE/supabase/inventory_sold_out.sql).
 *
 * Whatever marks a flat rented — the CRM's button, the edit form, an owner, a
 * partner's confirmed request — the database stamps the date, so the CRM can
 * say which flats sold out in which month. Flats let before that was recorded
 * have no date and are grouped under "Date not recorded".
 */
import { supabase, isSupabaseConfigured } from "./supabase";

export const NO_DATE = "none";

const TZ = "Asia/Kolkata";

/** "2026-10" for a listing sold out in October 2026 (in India), NO_DATE if undated, "" if not sold out. */
export function soldOutMonth(listing) {
  if (listing?.status !== "rented") return "";
  if (!listing.sold_out_at) return NO_DATE;
  const d = new Date(listing.sold_out_at);
  if (Number.isNaN(d.getTime())) return NO_DATE;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}`;
}

/** "Oct 2026" for "2026-10". */
export function monthLabel(key) {
  if (key === NO_DATE) return "Date not recorded";
  const [y, m] = String(key).split("-").map(Number);
  if (!y || !m) return "";
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Every month with a sale among these listings, newest first, with how many; undated last. */
export function soldOutMonths(listings) {
  const counts = new Map();
  for (const l of listings ?? []) {
    const k = soldOutMonth(l);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : b.localeCompare(a)))
    .map(([key, count]) => ({ key, count, label: monthLabel(key) }));
}

/** Newest sale first; undated after every dated one. */
export function bySoldOutDesc(a, b) {
  const ta = a.sold_out_at ? new Date(a.sold_out_at).getTime() : -Infinity;
  const tb = b.sold_out_at ? new Date(b.sold_out_at).getTime() : -Infinity;
  return tb - ta;
}

/** Today in India, as "2026-10-05" — the default (and the latest) day to mark. */
export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** "5 Oct 2026" for a sold_out_at. */
export function soldOutDate(at) {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Mark sold out — today, or on `day` ("YYYY-MM-DD", within the last year). */
export const markSoldOut = (propertyId, day) =>
  rpc("crm_mark_sold_out", { p_property: propertyId, p_on: day && day !== todayInIndia() ? day : null });

/** Back on the market. The sale stays in the history. */
export const relistProperty = (propertyId) => rpc("crm_relist", { p_property: propertyId });
