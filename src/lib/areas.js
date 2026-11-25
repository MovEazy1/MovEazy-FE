/**
 * The areas every picker offers, kept in the CRM (pages/crm/CrmAreasPage.jsx)
 * — table `areas`, MovEazy-BE/supabase/areas.sql.
 *
 *   chips   the tenant's quick chips, in the order the CRM arranged.
 *   names   every area on the list, A–Z: dropdowns and search.
 *   groups  { "HSR Extension": ["Kudlu Gate", …] } — asking for the wider
 *           area reaches the ones inside it (data/preferenceOptions.js
 *           expandAreas and friends read it).
 *
 * Removed areas are on no picker; flats and clients already in them keep the
 * name, and still count inside their wider area.
 *
 * Until the list loads — or if it can't — pickers show the last list this
 * device saw, else the list the app shipped with, so none ever opens empty.
 *
 * Each city has its own list (multi_city.sql). useAreas(city) gives one
 * city's; without a city, the city the site is showing (lib/cities.js).
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase, supabasePublic, isSupabaseConfigured } from "./supabase";
import { AREA_GROUPS, LOCALITIES, LOCALITIES_MORE, setAreaGroups } from "../data/preferenceOptions";
import { DEFAULT_CITY, normalizeCity, siteCity, useSiteCity } from "./cities";

const SAVED_KEY = "mz_areas_v2";
const norm = (s) => String(s || "").trim().toLowerCase();

/** The list the app shipped with, as rows. */
function defaultRows() {
  const rows = [...LOCALITIES, ...LOCALITIES_MORE].map((name, i) => ({
    id: `default-${i}`, city: DEFAULT_CITY, name, chip: i < LOCALITIES.length, parent_id: null, sort: (i + 1) * 10, active: true,
  }));
  for (const [parent, children] of Object.entries(AREA_GROUPS)) {
    const p = rows.find((r) => norm(r.name) === norm(parent));
    for (const c of children) {
      const row = rows.find((r) => norm(r.name) === norm(c));
      if (p && row) row.parent_id = p.id;
    }
  }
  return rows;
}

/** Everything the pickers need from the rows. */
export function deriveAreas(rows) {
  const sorted = [...rows].sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
  const live = sorted.filter((r) => r.active);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = {};
  for (const r of sorted) {
    const p = r.parent_id && byId.get(r.parent_id);
    if (p) (groups[p.name] ??= []).push(r.name);
  }
  return {
    rows: sorted,
    chips: live.filter((r) => r.chip).map((r) => r.name),
    names: live.map((r) => r.name).sort((a, b) => a.localeCompare(b)),
    groups,
  };
}

function readSaved() {
  try {
    const rows = JSON.parse(localStorage.getItem(SAVED_KEY) || "null");
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch {
    return null;
  }
}

const rowCity = (r) => normalizeCity(r.city) || DEFAULT_CITY;
/** One city's list. */
function forCity(all, city) {
  const c = normalizeCity(city) || DEFAULT_CITY;
  return deriveAreas(all.filter((r) => rowCity(r) === c));
}

let state = { all: readSaved() || defaultRows(), loaded: false };
// Wider-area groups from every city (names inside a group are that city's).
setAreaGroups(deriveAreas(state.all).groups);
const listeners = new Set();
const derived = new Map();
function publish(rows, loaded) {
  state = { all: rows, loaded };
  derived.clear();
  setAreaGroups(deriveAreas(rows).groups);
  listeners.forEach((fn) => fn());
}
function cityState(city) {
  const c = normalizeCity(city) || DEFAULT_CITY;
  if (!derived.has(c)) derived.set(c, forCity(state.all, c));
  return derived.get(c);
}

let inflight = null;
/** Load (once per page, unless `fresh`) the list from the database. Never throws. */
export function loadAreas({ fresh = false } = {}) {
  if (!isSupabaseConfigured || !supabasePublic) return Promise.resolve(state);
  if (inflight && !fresh) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabasePublic.from("areas").select("id,city,name,chip,parent_id,sort,active").order("sort").order("name");
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        publish(data, true);
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(data)); } catch { /* the list still shows */ }
      }
    } catch {
      inflight = null; // try again on the next picker
    }
    return state;
  })();
  return inflight;
}

/**
 * One city's areas, live: { chips, names, groups, rows, loaded, city }. Without
 * a city, the city the site is showing. Loads them on first use.
 */
export function useAreas(city) {
  const snap = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state, () => state);
  const site = useSiteCity().city;
  const c = normalizeCity(city) || site;
  useEffect(() => { loadAreas(); }, []);
  return useMemo(() => ({ ...cityState(c), loaded: snap.loaded, city: c }), [snap, c]);
}

/** Every city's rows (the CRM's Areas page). */
export const allAreaRows = () => state.all;

/** One city's names as they are now, outside React (e.g. reading areas out of pasted text). */
export const areaNames = (city) => cityState(city || siteCity()).names;

/** The city an area is in (the hint city if it has one by that name), or "". */
export function cityOfArea(area, hint = "") {
  const a = String(area || "").trim().toLowerCase();
  if (!a) return "";
  const hits = [...new Set(state.all.filter((r) => r.name.trim().toLowerCase() === a).map(rowCity))];
  const h = normalizeCity(hint);
  if (h && hits.includes(h)) return h;
  return hits.length === 1 ? hits[0] : "";
}

/** The city most of these areas are in, or "". */
export function cityOfAreas(areas = [], hint = "") {
  const n = {};
  for (const a of areas) { const c = cityOfArea(a, hint); if (c) n[c] = (n[c] || 0) + 1; }
  return Object.entries(n).sort((x, y) => y[1] - x[1] || (y[0] === normalizeCity(hint)) - (x[0] === normalizeCity(hint)))[0]?.[0] || "";
}

/**
 * The list's name for a place named elsewhere (Google's "HSR Layout" → "HSR"):
 * the same name, else the longest list name inside it, else "".
 */
export function closestArea(text, names = areaNames()) {
  const t = norm(text);
  if (!t) return "";
  const exact = names.find((n) => norm(n) === t);
  if (exact) return exact;
  // Whole words only: "HSR" is inside "HSR Layout", "BTM" isn't inside "BTMX".
  const words = (s) => ` ${norm(s).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const inside = names.filter((n) => words(t).includes(words(n)));
  return inside.sort((a, b) => b.length - a.length)[0] || "";
}

/** A dropdown's options: the list, plus `current` when a saved record is in an area no longer on it. */
export function withCurrent(names, current) {
  const c = String(current || "").trim();
  return c && !names.some((n) => norm(n) === norm(c)) ? [c, ...names] : names;
}

/* ── The CRM: only the super admin may change the list (areas.sql) ────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Add (no id) or change one area: { id?, city?, name?, chip?, parent_id?, active? }. The list reloads after. */
export async function saveArea(patch) {
  const row = await rpc("area_save", { p: patch });
  await loadAreas({ fresh: true });
  return row;
}

/** Put the areas in this order (their ids). */
export async function reorderAreas(ids) {
  await rpc("area_reorder", { p_ids: ids });
  await loadAreas({ fresh: true });
}
