/**
 * "Which city are you searching in?" — the seven cities (lib/cities.js).
 *
 *   <CitySwitch />      the header's city button; opens the picker.
 *   <CityPrompt />      on the pages that list flats: the picker on a first
 *                       visit, once the page has painted (it never holds the
 *                       page up), pre-selected from a rough guess of where
 *                       they are. Picking remembers the city on this device.
 *   <NcrTick />         "Also show Gurugram and Delhi" for a tenant in an NCR city.
 *
 * The question is where they want to LIVE: someone in Mumbai looking for a
 * flat in Bangalore picks Bangalore. Where they are now is kept apart, for the
 * team (rememberCurrentCity).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  CITIES, NCR_CITIES, cityLabel, citySlug, guessCity, isNcr, nearestCity, rememberCurrentCity, setIncludeNcr, setSiteCity, useSiteCity,
} from "../../lib/cities";

const CSS = `
.mzc-bg { position: fixed; inset: 0; z-index: 2000; background: rgba(2,16,14,.55); display: flex; align-items: flex-end; justify-content: center; }
@media (min-width: 640px) { .mzc-bg { align-items: center; } }
.mzc-sheet { width: min(520px, 100%); background: #fff; color: #0F1F1C; border-radius: 22px 22px 0 0; padding: 22px 18px calc(18px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -10px 40px rgba(0,0,0,.25); font-family: inherit; max-height: 92vh; overflow-y: auto; }
@media (min-width: 640px) { .mzc-sheet { border-radius: 22px; padding: 26px; } }
.mzc-sheet h2 { margin: 0 0 4px; font-size: 21px; font-weight: 800; letter-spacing: -.01em; }
.mzc-sub { margin: 0 0 16px; font-size: 13.5px; color: #4B5E59; line-height: 1.45; }
.mzc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
@media (min-width: 420px) { .mzc-grid { grid-template-columns: repeat(3, 1fr); } }
.mzc-city { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 13px 14px; border-radius: 14px;
  border: 1.5px solid #DCE5E2; background: #fff; text-align: left; cursor: pointer; font: inherit; color: inherit; min-height: 56px; }
.mzc-city b { font-size: 15px; }
.mzc-city span { font-size: 11.5px; color: #6B7E79; }
.mzc-city:hover { border-color: #0E7C68; }
.mzc-city.on { border-color: #0E7C68; background: #E8F6F2; }
.mzc-city:focus-visible { outline: 2px solid #0E7C68; outline-offset: 2px; }
.mzc-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.mzc-link { background: none; border: none; color: #0E7C68; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; padding: 6px 0; }
.mzc-go { border: none; border-radius: 100px; background: #0E7C68; color: #fff; font: inherit; font-weight: 700; font-size: 15px; padding: 12px 22px; cursor: pointer; }
.mzc-go:disabled { opacity: .45; cursor: default; }
.mzc-note { font-size: 12px; color: #6B7E79; margin: 10px 0 0; }
.mzc-tick { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #24413B; margin-top: 12px; cursor: pointer; }
.mzc-switch { display: inline-flex; align-items: center; gap: 5px; border: 1px solid rgba(255,255,255,.20); background: rgba(255,255,255,.08);
  color: #F1F6F4; border-radius: 100px; padding: 7px 11px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; flex: none; }
.mzc-switch svg { flex: none; }
`;

const Pin = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

const HINT = {
  Bengaluru: "Koramangala, HSR, Whitefield", Mumbai: "Andheri, Powai, Bandra", Hyderabad: "Gachibowli, HITEC City",
  Pune: "Hinjewadi, Baner, Kharadi", Noida: "Sector 62, Sector 18", Gurugram: "Cyber City, Golf Course Rd", Delhi: "Saket, Hauz Khas, Dwarka",
};

/** The picker itself. `onDone(city)` after a pick; `onClose` to dismiss (only when a city is already chosen). */
export function CityPickerSheet({ onDone, onClose, dismissable = true }) {
  const { city, chosen, ncr } = useSiteCity();
  const [pick, setPick] = useState(chosen ? city : "");
  const [guessed, setGuessed] = useState("");
  const [wantNcr, setWantNcr] = useState(ncr);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let live = true;
    guessCity().then((g) => {
      if (!live || !g) return;
      rememberCurrentCity(g);
      setGuessed(g);
      setPick((p) => p || g);
    });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape" && dismissable) onClose?.(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [dismissable, onClose]);

  const useLocation_ = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = nearestCity(p.coords.latitude, p.coords.longitude);
        setLocating(false);
        if (c) { rememberCurrentCity(c); setPick(c); }
      },
      () => setLocating(false),
      { maximumAge: 600000, timeout: 8000 },
    );
  };
  const done = () => {
    if (!pick) return;
    setSiteCity(pick);
    setIncludeNcr(isNcr(pick) && wantNcr);
    onDone?.(pick);
  };
  const others = NCR_CITIES.filter((c) => c !== pick).map(cityLabel).join(" and ");

  return createPortal(
    <div className="mzc-bg" role="presentation" onClick={() => dismissable && onClose?.()}>
      <style>{CSS}</style>
      <div className="mzc-sheet" role="dialog" aria-modal="true" aria-labelledby="mzc-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="mzc-title">Which city are you searching in?</h2>
        <p className="mzc-sub">Pick the city you want to live in — even if you're somewhere else right now.</p>
        <div className="mzc-grid">
          {CITIES.map((c) => (
            <button key={c.name} type="button" className={`mzc-city${pick === c.name ? " on" : ""}`} aria-pressed={pick === c.name} onClick={() => setPick(c.name)}>
              <b>{c.label}</b>
              <span>{guessed === c.name ? "You seem to be here" : HINT[c.name]}</span>
            </button>
          ))}
        </div>
        {isNcr(pick) && (
          <label className="mzc-tick">
            <input type="checkbox" checked={wantNcr} onChange={(e) => setWantNcr(e.target.checked)} />
            Also show flats in {others}
          </label>
        )}
        <div className="mzc-row">
          <button type="button" className="mzc-link" onClick={useLocation_} disabled={locating}>{locating ? "Finding you…" : "Use my location"}</button>
          <button type="button" className="mzc-go" disabled={!pick} onClick={done}>Show {pick ? cityLabel(pick) : "flats"}</button>
        </div>
        <p className="mzc-note">You can switch cities any time from the top of the page.</p>
      </div>
    </div>,
    document.body,
  );
}

/** The header's city button. */
export function CitySwitch({ style }) {
  const { city, chosen } = useSiteCity();
  const [open, setOpen] = useState(false);
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="mzc-switch" style={style} onClick={() => setOpen(true)} aria-label={`City: ${cityLabel(city)}. Change city`}>
        <Pin /> {chosen ? cityLabel(city) : "Pick city"} <span aria-hidden style={{ fontSize: 9, opacity: 0.8 }}>▼</span>
      </button>
      {open && <CityPickerSheet onDone={() => setOpen(false)} onClose={() => setOpen(false)} />}
    </>
  );
}

// The pages that list flats: a first visit there gets the question.
const ASKS = [/^\/$/, /^\/tenant\/?$/, /^\/find(\/|$)/, /^\/matches\/?$/, /^\/map\/?$/];

/** A first visit to a page that lists flats: ask once, after the page is up. */
export function CityPrompt() {
  const { pathname } = useLocation();
  const { chosen } = useSiteCity();
  const [open, setOpen] = useState(false);
  const asks = !chosen && ASKS.some((r) => r.test(pathname));
  useEffect(() => {
    if (!asks) { setOpen(false); return undefined; }
    // After first paint and a breath: the page is never held up by the question.
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [asks]);
  if (!open || chosen) return null;
  return <CityPickerSheet dismissable={false} onDone={() => setOpen(false)} />;
}

/** "Also show Gurugram and Delhi" — only for an NCR city. */
export function NcrTick({ style }) {
  const { city, ncr } = useSiteCity();
  if (!isNcr(city)) return null;
  return (
    <label className="mzc-tick" style={style}>
      <style>{CSS}</style>
      <input type="checkbox" checked={ncr} onChange={(e) => setIncludeNcr(e.target.checked)} />
      Include {NCR_CITIES.filter((c) => c !== city).map(cityLabel).join(" & ")} (NCR)
    </label>
  );
}

/** For links: the city's own address (/mumbai). */
export const cityPath = (city) => `/${citySlug(city) || ""}`;
