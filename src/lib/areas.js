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
 */
import { useEffect, useSyncExternalStore } from "react";
import { supabase, supabasePublic, isSupabaseConfigured } from "./supabase";
import { AREA_GROUPS, LOCALITIES, LOCALITIES_MORE, setAreaGroups } from "../data/preferenceOptions";

const SAVED_KEY = "mz_areas_v1";
const norm = (s) => String(s || "").trim().toLowerCase();

/** The list the app shipped with, as rows. */
function defaultRows() {
  const rows = [...LOCALITIES, ...LOCALITIES_MORE].map((name, i) => ({
    id: `default-${i}`, name, chip: i < LOCALITIES.length, parent_id: null, sort: (i + 1) * 10, active: true,
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

let state = { ...deriveAreas(readSaved() || defaultRows()), loaded: false };
setAreaGroups(state.groups);
const listeners = new Set();
function publish(rows, loaded) {
  state = { ...deriveAreas(rows), loaded };
  setAreaGroups(state.groups);
  listeners.forEach((fn) => fn());
}

let inflight = null;
/** Load (once per page, unless `fresh`) the list from the database. Never throws. */
export function loadAreas({ fresh = false } = {}) {
  if (!isSupabaseConfigured || !supabasePublic) return Promise.resolve(state);
  if (inflight && !fresh) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabasePublic.from("areas").select("id,name,chip,parent_id,sort,active").order("sort").order("name");
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

/** The areas, live: { chips, names, groups, rows, loaded }. Loads them on first use. */
export function useAreas() {
  const snap = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state, () => state);
  useEffect(() => { loadAreas(); }, []);
  return snap;
}

/** The list as it is now, outside React (e.g. reading areas out of pasted text). */
export const areaNames = () => state.names;

/**
 * The list's name for a place named elsewhere (Google's "HSR Layout" → "HSR"):
 * the same name, else the longest list name inside it, else "".
 */
export function closestArea(text, names = state.names) {
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

/** Add (no id) or change one area: { id?, name?, chip?, parent_id?, active? }. The list reloads after. */
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
