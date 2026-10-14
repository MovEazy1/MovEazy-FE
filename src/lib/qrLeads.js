/**
 * What happens after a tenant scans a broker's QR poster
 * (MovEazy-BE/supabase/partner_qr_leads.sql decides; this only calls it).
 *
 * On the broker's page (/b/<code>) we remember, for this tab, what the tenant
 * looked at — the size chips they tapped, the flats they opened or liked, the
 * ones they asked to visit. Once they're signed in with a mobile number, a
 * check-in sends that (and their location, if they allow it) and they become
 * the broker's lead with a tentative requirement built from it.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

const BROWSE_KEY = (code) => `mz_qr_browse:${String(code || "").toUpperCase()}`;
const EMPTY = { filters: [], opened: [], visits: [] };
const CAP = 40;

/** { filters, opened, visits } for this broker's page, this tab. */
export function readBrowse(code, store = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
  try {
    const b = JSON.parse(store?.getItem(BROWSE_KEY(code)) || "null");
    return {
      filters: Array.isArray(b?.filters) ? b.filters : [],
      opened: Array.isArray(b?.opened) ? b.opened : [],
      visits: Array.isArray(b?.visits) ? b.visits : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Add one thing they did: kind "filters" | "opened" | "visits". Newest last, no repeats, at most 40. */
export function addBrowse(browse, kind, value) {
  const v = String(value || "").trim();
  if (!v || !(kind in EMPTY) || (kind === "filters" && v.toLowerCase() === "all")) return browse;
  const list = [...(browse[kind] || []).filter((x) => x !== v), v].slice(-CAP);
  return { ...browse, [kind]: list };
}

export function noteBrowse(code, kind, value, store = typeof sessionStorage !== "undefined" ? sessionStorage : null) {
  const next = addBrowse(readBrowse(code, store), kind, value);
  try { store?.setItem(BROWSE_KEY(code), JSON.stringify(next)); } catch { /* private tab: fine */ }
  return next;
}

/** Where the tenant is, if they allow it within `ms`. → { lat, lng, accuracy } or null. */
export function currentPosition(ms = 9000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), ms + 1000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); finish({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) }); },
      () => { clearTimeout(timer); finish(null); },
      { enableHighAccuracy: true, timeout: ms, maximumAge: 120000 },
    );
  });
}

/** Signed in with a number on the broker's page: check in. → { lead: boolean } */
export const checkinStorefront = (code, { spot = "", source = "qr", position = null, browse = EMPTY } = {}) =>
  rpc("partner_storefront_checkin", {
    p_code: code, p_spot: String(spot || ""), p_source: source === "link" ? "link" : "qr",
    p_lat: position?.lat ?? null, p_lng: position?.lng ?? null, p_accuracy: position?.accuracy ?? null, p_browse: browse,
  });

/** "Schedule visit" on one of the broker's flats. → { broker: { name, phone }, home: { property_id, flat_type, area, rent } } */
export const requestStorefrontVisit = (code, propertyId, browse = EMPTY) =>
  rpc("partner_storefront_visit", { p_code: code, p_property: propertyId, p_browse: browse });

/* ── The broker's poster page ──────────────────────────────────────────── */
/** When they first downloaded a poster (null: not yet). `mark` records it now. */
export const posterDownloaded = (mark = false) => rpc("partner_poster_downloaded", { p_mark: Boolean(mark) });

/* ── The CRM ───────────────────────────────────────────────────────────── */
/** { since, totals, brokers, areas, points } for the last `days` (null: all time). */
export const fetchQrScans = (days = 30) => rpc("crm_qr_scans", { p_days: days });

/* ── The CRM map ───────────────────────────────────────────────────────── */
const CELL = 0.01; // degrees, about 1.1 km

/** Groups points into ~1 km cells. → [{ lat, lng, count, localities }] with count ≥ 2, biggest first. */
export function hotspotCells(points) {
  const cells = new Map();
  for (const p of points) {
    const k = `${Math.round(p.lat / CELL)}:${Math.round(p.lng / CELL)}`;
    const c = cells.get(k) || { lat: 0, lng: 0, count: 0, localities: new Set() };
    c.lat += p.lat; c.lng += p.lng; c.count += 1;
    if (p.locality) c.localities.add(p.locality);
    cells.set(k, c);
  }
  return [...cells.values()].filter((c) => c.count >= 2)
    .map((c) => ({ lat: c.lat / c.count, lng: c.lng / c.count, count: c.count, localities: [...c.localities] }))
    .sort((a, b) => b.count - a.count);
}

/** The WhatsApp text a tenant sends the broker about the flat they asked to see. */
export function visitMessage(brokerName, home, inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`) {
  const first = String(brokerName || "").trim().split(/\s+/)[0] || "there";
  const flat = [home?.flat_type, home?.area && `in ${home.area}`, Number(home?.rent) > 0 && `(${inr(home.rent)})`].filter(Boolean).join(" ");
  return `Hi ${first}, I requested a visit for the ${flat || "flat"} on MovEazy. When can I come and see it?`;
}
