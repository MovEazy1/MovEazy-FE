/**
 * Live visits (MovEazy-BE/supabase/partner_live_visits.sql): the CRM gives a
 * tenant's visit to a partner; the partner shares where to meet; the tenant
 * taps "I am coming"; both phones share where they are until it's done; both
 * say how it went.
 *
 * Web pages can only share a location while they're open — a locked phone or
 * another app pauses it, so the other side sees "last seen 2 min ago".
 */
import { useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { haversineKm } from "./geo";
import { resolveMapsLink } from "./mapLink";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const VISIT_STATUS = {
  assigned: { label: "Partner assigned", tone: "#B45309" },
  shared: { label: "Meeting spot shared", tone: "#1D4ED8" },
  coming: { label: "Tenant on the way", tone: "#7C3AED" },
  done: { label: "Visit done", tone: "#059669" },
  cancelled: { label: "Cancelled", tone: "#6B7280" },
};

export const SPOT_WARNING = "Ensure that the marked location is at max 50m far from the flat. Offer the customer a cold drink to increase Hook chances.";

/* ── CRM ──────────────────────────────────────────────────────────────────── */

export const fetchCrmLiveVisits = (from = null) => rpc("crm_live_visits", { p_from: from });
export const saveCrmLiveVisit = (p) => rpc("crm_live_visit_save", { p });
export const cancelCrmLiveVisit = (id) => rpc("crm_live_visit_cancel", { p_id: id });
export const fetchPartnerPicker = () => rpc("crm_partner_picker").then((r) => r ?? []);

/* ── Partner ──────────────────────────────────────────────────────────────── */

export const fetchPartnerLiveVisits = () => rpc("partner_live_visits_mine").then((r) => r ?? []);
export const sharePartnerSpot = (id, lat, lng, link = "") => rpc("partner_live_visit_share", { p_id: id, p_lat: lat, p_lng: lng, p_link: link });
export const pingPartner = (id, s) => rpc("partner_live_visit_ping", { p_id: id, p_lat: s.lat, p_lng: s.lng, p_acc: s.acc ?? null });
export const setPartnerSharing = (id, on) => rpc("partner_live_visit_sharing", { p_id: id, p_on: on });
export const markPartnerVisitDone = (id) => rpc("partner_live_visit_done", { p_id: id });
export const partnerVisitAnswer = (id, f) => rpc("partner_live_visit_respond", { p_id: id, p: f });

/* ── Tenant ───────────────────────────────────────────────────────────────── */

export const fetchTenantLiveVisits = () => rpc("tenant_live_visits").then((r) => r ?? []);
export const tenantComing = (id) => rpc("tenant_live_visit_coming", { p_id: id });
export const pingTenant = (id, s) => rpc("tenant_live_visit_ping", { p_id: id, p_lat: s.lat, p_lng: s.lng, p_acc: s.acc ?? null });
export const setTenantSharing = (id, on) => rpc("tenant_live_visit_sharing", { p_id: id, p_on: on });
export const tenantVisitAnswer = (id, f) => rpc("tenant_live_visit_respond", { p_id: id, p: f });

/* ── Words and numbers ────────────────────────────────────────────────────── */

/** Metres between two { lat, lng }, or null. */
export function metresBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  return Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000);
}

/** "40 m", "1.2 km". */
export function distanceText(m) {
  if (m == null) return "";
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** "just now", "2 min ago" for a location's time. */
export function seenAgo(at, now = Date.now()) {
  if (!at) return "";
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/** "Sat 22 Nov, 4:30 pm". */
export function visitTime(at) {
  if (!at) return "Time to be fixed";
  return new Date(at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Google Maps directions to a spot. */
export const directionsUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
/** A spot as a Google Maps link (for the tenant to open). */
export const spotUrl = (s) => s?.link || `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;

/** Coordinates out of a pasted Google Maps link (short links resolved by /api/resolve-map). */
export async function spotFromLink(raw) {
  const c = await resolveMapsLink(raw);
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : null;
}

/** The WhatsApp message a partner sends the tenant once the spot is shared. */
export function tenantWhatsApp(visit, partnerName = "") {
  const digits = String(visit?.client?.phone || "").replace(/\D/g, "").slice(-10);
  const first = String(visit?.client?.name || "").trim().split(/\s+/)[0];
  const link = `https://www.moveazy.co.in/my-visit/${visit.id}`;
  const text = `Hi${first ? ` ${first}` : ""}, this is ${partnerName || "your MovEazy partner"} for your visit to ${visit?.flat?.title || "the flat"} (${visitTime(visit?.visit_at)}). `
    + `Here's where we'll meet — tap "I am coming" when you leave so we can find each other:\n${link}`;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * While a visit is live and this side is sharing: send where this phone is
 * every ~15 s (only while the page is open and visible). `ping(id, spot)`.
 */
export function useLivePing(visit, sharing, ping, onUpdate) {
  const last = useRef(0);
  const cb = useRef(onUpdate);
  useEffect(() => { cb.current = onUpdate; }, [onUpdate]);
  const id = visit?.id;
  const live = Boolean(visit?.live);
  useEffect(() => {
    if (!id || !live || !sharing || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (document.visibilityState !== "visible") return;
        if (Date.now() - last.current < 15000) return;
        last.current = Date.now();
        ping(id, { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }).then((v) => cb.current?.(v), () => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [id, live, sharing, ping]);
}
