/**
 * Owner buildings — a property with many flats, its QR, and the visits it
 * brings. The page the QR opens is moveazy.co.in/building/<code>.
 *
 * The authority is MovEazy-BE/supabase/owner_buildings.sql: who may see a
 * number, move a visit or book a flat is decided there. This file only calls it.
 */
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

/** A renter's visit request. `visitAt`: a Date, or null for "call me to fix a time". */
export const requestBuildingVisit = (code, { name, phone, propertyIds = [], visitAt = null, note = "" }) =>
  rpc("building_request_visit", {
    p_code: code, p_visitor: visitorId() || "", p_name: name, p_phone: phone, p_properties: propertyIds,
    p_visit_at: visitAt ? visitAt.toISOString() : null, p_note: note,
  });

/* ── The owner's side ────────────────────────────────────────────────────── */

export const fetchMyBuildings = () => rpc("owner_buildings_list").then((r) => r ?? []);
export const fetchBuildingDetail = (id) => rpc("owner_building_detail", { p_building: id });
export const saveBuilding = (patch) => rpc("owner_building_save", { p: patch });
export const setFlatBuilding = (propertyId, buildingId, floor = null) =>
  rpc("owner_building_set_flat", { p_property: propertyId, p_building: buildingId, p_floor: floor === "" ? null : floor });
export const markFlatBooked = (propertyId, on) => rpc("owner_building_mark_booked", { p_property: propertyId, p_on: Boolean(on) });

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
