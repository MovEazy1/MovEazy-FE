/**
 * The seven cities (table `cities`, MovEazy-BE/supabase/multi_city.sql) and
 * the city the site is showing.
 *
 * A tenant's city is the city they are SEARCHING in — not where they are: a
 * person in Mumbai looking for a flat in Bangalore is a Bangalore tenant.
 * It is picked once ("Which city are you searching in?", pre-selected from a
 * rough guess of where they are), follows the areas they pick, and is
 * remembered on this device (and on their account, by the requirement form).
 * /bangalore, /mumbai… open that city and remember it.
 *
 * Noida, Gurugram and Delhi are separate cities; a tenant in one of them can
 * tick "Include NCR" to see the other two as well.
 */
import { useSyncExternalStore } from "react";

export const CITIES = [
  { name: "Bengaluru", slug: "bangalore", label: "Bangalore", ncr: false, lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", slug: "mumbai", label: "Mumbai", ncr: false, lat: 19.076, lng: 72.8777 },
  { name: "Hyderabad", slug: "hyderabad", label: "Hyderabad", ncr: false, lat: 17.385, lng: 78.4867 },
  { name: "Pune", slug: "pune", label: "Pune", ncr: false, lat: 18.5204, lng: 73.8567 },
  { name: "Noida", slug: "noida", label: "Noida", ncr: true, lat: 28.5355, lng: 77.391 },
  { name: "Gurugram", slug: "gurugram", label: "Gurugram", ncr: true, lat: 28.4595, lng: 77.0266 },
  { name: "Delhi", slug: "delhi", label: "Delhi", ncr: true, lat: 28.6139, lng: 77.209 },
];
export const CITY_NAMES = CITIES.map((c) => c.name);
export const DEFAULT_CITY = "Bengaluru";
export const NCR_CITIES = CITIES.filter((c) => c.ncr).map((c) => c.name);

const ALIASES = {
  bengaluru: "Bengaluru", bangalore: "Bengaluru", blr: "Bengaluru", "bengaluru urban": "Bengaluru", "bangalore urban": "Bengaluru",
  mumbai: "Mumbai", bombay: "Mumbai", "navi mumbai": "Mumbai", thane: "Mumbai", "mumbai suburban": "Mumbai",
  hyderabad: "Hyderabad", secunderabad: "Hyderabad", hyd: "Hyderabad", cyberabad: "Hyderabad",
  pune: "Pune", pimpri: "Pune", "pimpri-chinchwad": "Pune", "pimpri chinchwad": "Pune", chinchwad: "Pune",
  noida: "Noida", "greater noida": "Noida", "gautam buddha nagar": "Noida", "noida extension": "Noida",
  gurugram: "Gurugram", gurgaon: "Gurugram", ggn: "Gurugram",
  delhi: "Delhi", "new delhi": "Delhi", "ncr delhi": "Delhi", "national capital territory of delhi": "Delhi",
};

/** A city as people write it ("Bangalore", "gurgaon", "New Delhi") → its name here, or "". Same rule as normalize_city(). */
export function normalizeCity(s) {
  return ALIASES[String(s || "").trim().replace(/\s+/g, " ").toLowerCase()] || "";
}
export const cityInfo = (name) => CITIES.find((c) => c.name === normalizeCity(name)) || null;
export const cityLabel = (name) => cityInfo(name)?.label || name || "";
export const citySlug = (name) => cityInfo(name)?.slug || "";
export const cityBySlug = (slug) => CITIES.find((c) => c.slug === String(slug || "").toLowerCase()) || null;
export const isNcr = (name) => NCR_CITIES.includes(normalizeCity(name));

/** The nearest of the seven to a point (for "Use my location"), or "" if none is within 120 km. */
export function nearestCity(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const km = (c) => {
    const r = Math.PI / 180;
    const a = Math.sin(((c.lat - lat) * r) / 2) ** 2 + Math.cos(lat * r) * Math.cos(c.lat * r) * Math.sin(((c.lng - lng) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };
  const best = [...CITIES].sort((a, b) => km(a) - km(b))[0];
  return km(best) <= 120 ? best.name : "";
}

/* ── The city the site is showing ─────────────────────────────────────────── */

const CITY_KEY = "mz_city";
const NCR_KEY = "mz_city_ncr";
const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* private mode */ } };

let state = { city: normalizeCity(read(CITY_KEY)), ncr: read(NCR_KEY) === "1" };
const listeners = new Set();
const publish = (next) => { state = { ...state, ...next }; listeners.forEach((fn) => fn()); };

/** The city picked on this device, or "" when they haven't picked yet. */
export const chosenCity = () => state.city;
/** The city to show: the picked one, else Bengaluru. */
export const siteCity = () => state.city || DEFAULT_CITY;
export const includeNcr = () => state.ncr;

/** Pick a city (remembered on this device). Unknown names are ignored. */
export function setSiteCity(name) {
  const c = normalizeCity(name);
  if (!c || c === state.city) return c;
  write(CITY_KEY, c);
  publish({ city: c, ncr: isNcr(c) ? state.ncr : false });
  return c;
}
export function setIncludeNcr(on) {
  write(NCR_KEY, on ? "1" : "");
  publish({ ncr: Boolean(on) });
}

/** The cities whose flats to show: the city, plus the other NCR cities when ticked. */
export function searchCities(city = siteCity(), ncr = state.ncr) {
  const c = normalizeCity(city) || DEFAULT_CITY;
  return ncr && isNcr(c) ? [c, ...NCR_CITIES.filter((x) => x !== c)] : [c];
}

/** { city, chosen, ncr, cities } — live. */
export function useSiteCity() {
  const s = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state, () => state);
  return { city: s.city || DEFAULT_CITY, chosen: Boolean(s.city), ncr: s.ncr, cities: searchCities(s.city || DEFAULT_CITY, s.ncr) };
}

/* ── A rough guess of where they are (no permission popup) ────────────────── */

let guess = null;
/** The city their connection is in, if it is one of the seven: Vercel's IP geolocation (api/geo.js). "" otherwise. */
export function guessCity() {
  guess ??= fetch("/api/geo", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => normalizeCity(j?.city) || normalizeCity(j?.region) || "", () => "");
  return guess;
}

/** Where they are now, if we know it (for the CRM's "currently in"). */
export const CURRENT_CITY_KEY = "mz_current_city";
export function rememberCurrentCity(name) {
  const c = normalizeCity(name);
  if (c) write(CURRENT_CITY_KEY, c);
  return c;
}
export const currentCity = () => normalizeCity(read(CURRENT_CITY_KEY));
