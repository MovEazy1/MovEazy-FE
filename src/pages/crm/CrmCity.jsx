/**
 * The CRM's city: pick one of the seven, or All cities, and every screen shows
 * that city only (CrmShell filters the shared data; screens with their own
 * reads ask useCrm().city). Remembered per person on this device.
 *
 * Each teammate works the cities the super admin gave them in Team
 * (admin_roles.cities, multi_city.sql — empty means every city). "All cities"
 * is all of theirs; clients of other cities never reach them (the database
 * hides them, not just this picker).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { CITIES, CITY_NAMES, cityLabel, normalizeCity } from "../../lib/cities";
import { C } from "./crmUi";

export const ALL = "all";
const CODES = { Bengaluru: "BLR", Mumbai: "MUM", Hyderabad: "HYD", Pune: "PUN", Noida: "NOI", Gurugram: "GGN", Delhi: "DEL" };
export const cityCode = (c) => (c === ALL ? "ALL" : CODES[c] || String(c || "").slice(0, 3).toUpperCase());

const Ctx = createContext({ city: ALL, cities: CITY_NAMES, setCity: () => {}, inCity: () => true, allowsAll: true });
export const useCrmCity = () => useContext(Ctx);

/** The cities this teammate works (crm_my_cities); every city until known. */
async function fetchMyCities() {
  if (!isSupabaseConfigured || !supabase) return CITY_NAMES;
  const { data, error } = await supabase.rpc("crm_my_cities");
  // Before multi_city.sql is applied, the CRM is Bengaluru's alone and nothing filters.
  if (error || !Array.isArray(data) || !data.length) return CITY_NAMES;
  return data.map(normalizeCity).filter(Boolean);
}

/** The city state the shell keeps (and filters with); passed down through <CrmCityContext value>. */
export function useCrmCityState(email, enabled) {
  const key = `mz_crm_city:${String(email || "").toLowerCase()}`;
  const [cities, setCities] = useState(CITY_NAMES);
  const [picked, setPicked] = useState(() => { try { return localStorage.getItem(key) || ALL; } catch { return ALL; } });

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    fetchMyCities().then((c) => { if (live) setCities(c); });
    return () => { live = false; };
  }, [enabled, email]);

  // A city they no longer work: back to all of theirs.
  const city = picked !== ALL && !cities.includes(picked) ? ALL : picked;
  const setCity = useCallback((c) => {
    const next = c === ALL ? ALL : normalizeCity(c) || ALL;
    setPicked(next);
    try { localStorage.setItem(key, next); } catch { /* still applies this session */ }
  }, [key]);
  /** Is a row of this city on screen now? (Rows with no city are Bengaluru's.) */
  const inCity = useCallback((c) => {
    const n = normalizeCity(c) || "Bengaluru";
    return city === ALL ? cities.includes(n) : n === city;
  }, [city, cities]);
  return useMemo(() => ({ city, cities, setCity, inCity, allowsAll: cities.length === CITY_NAMES.length }), [city, cities, setCity, inCity]);
}
export const CrmCityContext = Ctx.Provider;

/**
 * The picker. `rail`: the narrow left rail on a laptop (a city code, with a
 * list that opens to the right). Otherwise a chip for the phone's top bar.
 */
export function CrmCityPicker({ rail = false }) {
  const { city, cities, setCity } = useCrmCity();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const options = [ALL, ...CITIES.map((c) => c.name).filter((c) => cities.includes(c))];
  const label = city === ALL ? (cities.length === CITY_NAMES.length ? "All cities" : `All my cities (${cities.length})`) : cityLabel(city);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} title={`City: ${label}`} aria-label={`City: ${label}. Change`}
        aria-expanded={open} aria-haspopup="listbox"
        style={rail ? {
          width: 44, height: 40, borderRadius: 10, border: `1px solid ${C.line}`, background: city === ALL ? C.surface : C.accentSoft || "#E8F6F2",
          color: C.text, fontSize: 10.5, fontWeight: 800, letterSpacing: ".03em", cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1.05, padding: 0,
        } : {
          display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${C.line}`, borderRadius: 999, background: "#fff",
          color: C.text, fontSize: 12, fontWeight: 700, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap",
        }}>
        {rail ? <><MapPin size={12} />{cityCode(city)}</> : <><MapPin size={13} /> {label}</>}
      </button>
      {open && (
        <div role="listbox" aria-label="City"
          style={{
            position: "absolute", zIndex: 90, top: rail ? 0 : "calc(100% + 6px)", left: rail ? "calc(100% + 8px)" : "auto", right: rail ? "auto" : 0,
            minWidth: 190, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(16,34,30,.18)", padding: 5,
          }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: ".05em", padding: "6px 9px 4px" }}>Show the CRM for</div>
          {options.map((c) => (
            <button key={c} type="button" role="option" aria-selected={city === c} onClick={() => { setCity(c); setOpen(false); }}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 9px", borderRadius: 8, border: 0,
                background: city === c ? "#E8F6F2" : "transparent", color: C.text, fontSize: 13, fontWeight: city === c ? 700 : 500, cursor: "pointer", textAlign: "left",
              }}>
              {c === ALL ? (cities.length === CITY_NAMES.length ? "All cities" : "All my cities") : cityLabel(c)}
              <span style={{ fontSize: 10.5, color: C.textMute, fontWeight: 700 }}>{cityCode(c)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
