/**
 * AIBroker — the guided "Find My Flat" preference wizard.
 *
 * A single-column, mobile-first step flow: one question per screen, a segmented
 * progress bar, and a sticky Back/Next footer. Renders its own full-screen
 * overlay. Mount as <AIBroker open onClose/>.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, ChevronLeft, ChevronRight, Search, Check, Info, Locate,
  User, Users, Home, Building2, TreePine, BedDouble, MoreHorizontal, GripVertical,
} from "lucide-react";
import { geocodePlace, searchPlaces, reverseGeocode } from "../lib/geocode";
import { useAuth } from "../context/AuthContext";
import { saveUserRequirement, fetchUserRequirement, rowToPrefs } from "../lib/userRequirements";
import { LOCALITIES, ALL_LOCALITIES, FLAT_TYPES, OFFICE_CHIPS } from "../data/preferenceOptions";
import MovEazyLogo from "./branding/MovEAZYLogo";

// MovEazy's own palette (ink + mint), the same pairing used on the nav/hero —
// not a generic blue theme.
const B = {
  ink: "#04211D", inkDeep: "#02140E", muted: "#64748B", line: "#E2E8F0",
  mint: "#5EEAD4", mintWash: "#E9FBF6", mintBorder: "#BEEFE2",
  bg: "#FFFFFF", track: "#E2E8F0",
};
const EASE = [0.22, 1, 0.36, 1];
const fmtINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/* ── Question-specific option data ─────────────────────────────────────────── */
const COMMUTE_OPTIONS = [
  { value: 15, label: "15 min", sub: "Very close" },
  { value: 30, label: "30 min", sub: "Recommended" },
  { value: 45, label: "45 min", sub: "Fairly flexible" },
  { value: 60, label: "1 hr", sub: "Not an issue" },
];
const OCCUPANT_CARDS = [
  { value: "Bachelor", label: "Bachelor", sub: "Just me", Icon: User },
  { value: "With Roommates", label: "With Roommates", sub: "Boys / Girls", Icon: Users },
  { value: "Family", label: "Family", sub: "Spouse / Kids", Icon: Home },
  { value: "Others", label: "Others", sub: "Let us know", Icon: MoreHorizontal },
];
const FLAT_TYPE_ICONS = { "1 RK": Home, "1 BHK": Home, "2 BHK": Building2, "3 BHK": Building2, "Villa": TreePine, "Room in Preoccupied flat": BedDouble };
const FLAT_TYPE_SHORT_LABEL = { "Room in Preoccupied flat": "Room" };
const FLAT_TYPE_CARDS = FLAT_TYPES.map((t) => ({ value: t, label: FLAT_TYPE_SHORT_LABEL[t] || t, Icon: FLAT_TYPE_ICONS[t] || Home }));

/** Budget defaults follow the biggest flat type still selected, so the slider
 * lands somewhere sane before the person has touched it at all. */
function computeBudgetDefaults(flatTypes = []) {
  if (flatTypes.includes("3 BHK")) return { budgetMin: 20000, budgetMax: 80000 };
  if (flatTypes.includes("2 BHK")) return { budgetMin: 20000, budgetMax: 70000 };
  if (flatTypes.includes("1 BHK")) return { budgetMin: 20000, budgetMax: 35000 };
  return { budgetMin: 20000, budgetMax: 45000 };
}

/* ── Question data ─────────────────────────────────────────────────────────── */
const STEPS = [
  { id: "office", type: "location", q: "Where's your office located?", sub: "We'll find homes that keep you close to work." },
  { id: "localities", type: "chips", q: "Which localities do you prefer?", sub: "Select multiple areas. We'll show you homes in and around these locations.", options: LOCALITIES },
  { id: "commuteMinutes", type: "cards", single: true, q: "How much time to office works for you?", sub: "Select your comfortable commute time (one-way, by bike).", options: COMMUTE_OPTIONS, note: "We'll show you homes within this commute time from your office." },
  { id: "occupants", type: "cards", single: true, q: "Who'll be living there?", sub: "This helps us find the right kind of homes and landlords.", options: OCCUPANT_CARDS },
  { id: "flatTypes", type: "cards", single: false, q: "What type of home are you looking for?", sub: "Select all that work for you.", options: FLAT_TYPE_CARDS },
  { id: "budget", type: "budget", q: "What's your monthly budget?", sub: "Select a range that works for you." },
  { id: "priority", type: "rank", q: "Finally — rank these by what matters most.", sub: "Drag to reorder — top = most important." },
];

const emptyPrefs = () => ({
  office: null,
  localities: [],
  commuteMinutes: 30,
  occupants: ["Bachelor"],
  flatTypes: [...FLAT_TYPES],
  ...computeBudgetDefaults([...FLAT_TYPES]),
  stretch: false,
  mustHaves: [], lifestyle: [], dealBreakers: [],
  priority: ["Near to Office", "Good locality", "Budget fit", "Apartment over standalone", "Flat size", "Ventilation"],
  notes: {},
});

/** The mandatory answers — same set gating "Continue" step-by-step, checked
 * all at once for the single-page review's "Save preferences" button. */
function prefsComplete(prefs) {
  return prefs.localities.length > 0 && prefs.occupants.length > 0 && prefs.flatTypes.length > 0;
}

export default function AIBroker({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // AuthContext hands back a new `user` object on practically every render
  // (its provider value isn't memoized), so depending on `user` itself here
  // would re-fire this effect — and wipe whatever the person just answered —
  // constantly instead of only on an actual sign-in/out. `uid` is stable.
  const uid = user?.uid || user?.id || null;
  const [phase, setPhase] = useState("q"); // q | review
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState(emptyPrefs);

  // Reset when reopened. If this user already has a saved requirement, skip
  // the questionnaire entirely and open straight into the single-page "Modify
  // my Preferences" review, pre-filled with what they told us last time.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPhase("q");
    setStepIdx(0);
    setSaving(false);
    setSaved(false);
    setPrefs(emptyPrefs());
    if (uid) {
      (async () => {
        const row = await fetchUserRequirement(uid);
        const savedPrefs = rowToPrefs(row);
        if (alive && savedPrefs) {
          setPrefs((p) => ({ ...p, ...savedPrefs }));
          setPhase("review");
        }
      })();
    }
    return () => { alive = false; };
  }, [open, uid]);

  // esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const step = STEPS[stepIdx];
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));
  const toggle = (key, val, max) =>
    setPrefs((p) => {
      const cur = p[key] || [];
      const has = cur.includes(val);
      let next = has ? cur.filter((x) => x !== val) : [...cur, val];
      if (max && next.length > max) return p;
      return { ...p, [key]: next };
    });
  const selectCard = (s, val) => {
    if (s.id === "commuteMinutes") { set({ commuteMinutes: val }); return; }
    if (s.single) { set({ [s.id]: [val] }); return; }
    toggle(s.id, val, s.max);
  };

  const canContinue = () => {
    if (step.type === "location") return !!prefs.office;
    if (step.type === "chips") return (prefs[step.id] || []).length > 0;
    if (step.type === "cards") return step.single ? true : (prefs[step.id] || []).length > 0;
    return true;
  };

  const advance = () => {
    // Leaving the flat-type step for the first time: seed the budget range
    // from whatever's still selected there, biggest type wins.
    if (step.id === "flatTypes") setPrefs((p) => ({ ...p, ...computeBudgetDefaults(p.flatTypes) }));
    if (stepIdx + 1 >= STEPS.length) {
      // Questionnaire complete — persist the requirement (best-effort) and take
      // the user to their top 5 swipeable matches.
      saveUserRequirement(user, prefs).then(() => {
        navigate("/matches", { state: { prefs, justSubmitted: true } });
      });
      onClose?.();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  // "Save preferences" on the single-page review: persist the requirement, then
  // take the user straight to their freshly-scored matches, same as finishing
  // the questionnaire does.
  const saveReview = async () => {
    if (!prefsComplete(prefs) || saving) return;
    setSaving(true);
    await saveUserRequirement(user, prefs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      onClose?.();
      navigate("/matches", { state: { prefs, justSubmitted: true } });
    }, 900);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="brk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <Styles />
          <motion.div
            className="brk-shell"
            initial={{ opacity: 0, scale: 0.97, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="brk-close" onClick={onClose} aria-label="Close"><X size={18} /></button>

            <div className="brk-header">
              <MovEazyLogo variant="light" size="sm" />
              <div className="brk-tagline">Finding a home,<br />made easy.</div>
            </div>

            {phase === "q" && (
              <div className="brk-progress-row">
                <div className="brk-progress-track">
                  {STEPS.map((s, i) => (
                    <span key={s.id} className={`brk-progress-seg ${i <= stepIdx ? "on" : ""}`} />
                  ))}
                </div>
                <span className="brk-progress-count">{stepIdx + 1} of {STEPS.length}</span>
              </div>
            )}

            <div className="brk-scroll">
              <AnimatePresence mode="wait">
                {phase === "q" && (
                  <motion.div key={step.id} className="brk-panel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.28, ease: EASE }}>
                    <h2 className="brk-q">{step.q}</h2>
                    {step.sub && <p className="brk-sub">{step.sub}</p>}
                    <div className="brk-content">
                      <StepBody step={step} prefs={prefs} set={set} toggle={toggle} selectCard={selectCard} />
                    </div>
                  </motion.div>
                )}

                {phase === "review" && (
                  <motion.div key="review" className="brk-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h2 className="brk-q">Modify my preferences</h2>
                    <p className="brk-sub">Everything I know about your search — change anything, then save.</p>
                    <div className="brk-review-list">
                      {STEPS.map((s) => (
                        <div key={s.id} className="brk-review-block">
                          <h3 className="brk-review-q">{s.q}</h3>
                          <StepBody step={s} prefs={prefs} set={set} toggle={toggle} selectCard={selectCard} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="brk-footer">
              {phase === "q" ? (
                <>
                  {stepIdx === 0 ? (
                    <button type="button" className="brk-link" onClick={advance}>Skip for now</button>
                  ) : (
                    <button type="button" className="brk-link" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}><ChevronLeft size={16} /> Back</button>
                  )}
                  <button type="button" className="brk-next" disabled={!canContinue()} onClick={advance}>
                    {stepIdx + 1 >= STEPS.length ? "Find my homes" : "Next"} <ChevronRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="brk-link" onClick={onClose}>Close</button>
                  <button type="button" className="brk-next" disabled={!prefsComplete(prefs) || saving} onClick={saveReview}>
                    {saving ? "Saving…" : saved ? "Saved ✓" : "Save preferences"} {!saving && !saved && <ChevronRight size={16} />}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The per-type answer control for one step — the single question view and
 * the "Modify my preferences" review both render this, so an edit made in
 * either place behaves identically. */
function StepBody({ step, prefs, set, toggle, selectCard }) {
  if (step.type === "location") {
    return <OfficeSearch value={prefs.office} onPick={(o) => set({ office: o })} chips={OFFICE_CHIPS} />;
  }
  if (step.type === "chips") {
    return <LocalityChips step={step} prefs={prefs} toggle={toggle} />;
  }
  if (step.type === "cards") {
    return (
      <>
        <CardGrid step={step} prefs={prefs} onSelect={(v) => selectCard(step, v)} />
        {step.note && <div className="brk-note-banner"><Info size={16} />{step.note}</div>}
      </>
    );
  }
  if (step.type === "budget") {
    return (
      <BudgetSlider
        min={prefs.budgetMin} max={prefs.budgetMax} stretch={prefs.stretch}
        onChange={(mn, mx) => set({ budgetMin: mn, budgetMax: mx })}
        onStretch={(v) => set({ stretch: v })}
      />
    );
  }
  if (step.type === "rank") {
    return (
      <RankList
        items={prefs.priority.map((p) => (p === "Budget fit" ? `Budget under ${fmtINR(prefs.budgetMax)}` : p))}
        onReorder={(labels) => set({ priority: labels.map((l) => (l.startsWith("Budget under") ? "Budget fit" : l)) })}
      />
    );
  }
  return null;
}

/* ── Icon-grid cards (commute time / occupants / flat type) ────────────────── */
function CardGrid({ step, prefs, onSelect }) {
  const isOn = (val) => (step.id === "commuteMinutes" ? prefs.commuteMinutes === val : (prefs[step.id] || []).includes(val));
  return (
    <div className="brk-cardgrid">
      {step.options.map((o) => {
        const on = isOn(o.value);
        const Icon = o.Icon;
        return (
          <button key={o.value} type="button" className={`brk-card ${on ? "on" : ""}`} onClick={() => onSelect(o.value)}>
            <span className="brk-card-checkbox">{on && <Check size={12} strokeWidth={3} />}</span>
            {Icon && <Icon size={24} className="brk-card-icon" strokeWidth={1.8} />}
            <span className="brk-card-label">{o.label}</span>
            {o.sub && <span className="brk-card-sub">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Locality chips (with a filter search box) ──────────────────────────────── */
function LocalityChips({ step, prefs, toggle }) {
  const [query, setQuery] = useState("");
  const selected = prefs.localities || [];
  const q = query.trim().toLowerCase();
  const list = q ? ALL_LOCALITIES.filter((l) => l.toLowerCase().includes(q)) : step.options;
  return (
    <>
      <div className="brk-search-box">
        <Search size={17} className="brk-search-icon" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search localities (e.g. HSR, Koramangala)" className="brk-search-plain" />
      </div>
      <div className="brk-chips-label">Popular nearby</div>
      <div className="brk-chip-wrap">
        {list.map((l) => {
          const on = selected.includes(l);
          return (
            <button key={l} type="button" className={`brk-pill ${on ? "on" : ""}`} onClick={() => toggle("localities", l)}>
              {on && <span className="brk-pill-check"><Check size={11} strokeWidth={3} /></span>}
              {l}
            </button>
          );
        })}
        {list.length === 0 && <div className="brk-empty-hint">No matches — try a different spelling.</div>}
      </div>
    </>
  );
}

/* ── Office location search — live autocomplete + interactive map ──────────── */
const BLR = { lat: 12.9716, lng: 77.5946 };
const OFFICE_ICON = L.divIcon({
  className: "brk-lmarker",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 1C7.8 1 2 6.8 2 14c0 9.2 13 25 13 25s13-15.8 13-25C28 6.8 22.2 1 15 1z" fill="#04211D" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="14" r="4.6" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

/** Tap-to-drop-a-pin. On some mobile browsers, Leaflet's own tap→click
 * synthesis silently fails to fire inside this modal (seen in testing: a real
 * tap does nothing, while a plain DOM click on the same spot works fine) — so
 * the pin never appears and the map looks unresponsive to touch. As a
 * fallback, track raw touchstart/touchend directly: if a touch ends close to
 * where it started and quickly (a tap, not a pan/drag), resolve the pin from
 * that point ourselves via Leaflet's own coordinate conversion. Guarded so it
 * can't double-fire if the native click event also happens to go through. */
function MapClicker({ onPoint }) {
  const lastFired = useRef(0);
  const fire = (lat, lng) => {
    lastFired.current = Date.now();
    onPoint(lat, lng);
  };
  const map = useMapEvents({ click(e) { fire(e.latlng.lat, e.latlng.lng); } });

  const touchStart = useRef(null);
  useEffect(() => {
    const el = map.getContainer();
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) { touchStart.current = null; return; }
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    };
    const onTouchEnd = (e) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || Date.now() - lastFired.current < 400) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      const dt = Date.now() - start.time;
      if (Math.hypot(dx, dy) > 12 || dt > 500) return; // moved/held too long — a pan, not a tap
      const rect = el.getBoundingClientRect();
      const point = L.point(t.clientX - rect.left, t.clientY - rect.top);
      const latlng = map.containerPointToLatLng(point);
      fire(latlng.lat, latlng.lng);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function Recenter({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 280);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function OfficeSearch({ value, onPick, chips }) {
  const [q, setQ] = useState(value?.label || "");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(value?.lat != null ? { lat: value.lat, lng: value.lng } : null);
  const abortRef = useRef(null);
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const justPicked = useRef(false);

  // Debounced live search as the user types.
  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    const query = q.trim();
    if (query.length < 3) { setResults([]); setOpen(false); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await searchPlaces(query, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResults(res);
      setOpen(res.length > 0);
      setActive(-1);
      setBusy(false);
    }, 320);
    return () => clearTimeout(t);
  }, [q]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (r) => {
    justPicked.current = true;
    setQ(r.primary);
    setResults([]);
    setOpen(false);
    setActive(-1);
    setPos({ lat: r.lat, lng: r.lng });
    onPick({ label: r.primary, lat: r.lat, lng: r.lng, display: r.display });
  };

  // Map click / marker drag → drop the pin there and reverse-geocode a label.
  const onMapPoint = async (lat, lng) => {
    justPicked.current = true;
    setPos({ lat, lng });
    setOpen(false);
    const rev = await reverseGeocode(lat, lng);
    const label = rev?.label || "Pinned location";
    justPicked.current = true;
    setQ(label);
    onPick({ label, lat, lng, display: rev?.display || label });
  };

  // Chip → run the search and select the best hit directly.
  const pickChip = async (c) => {
    justPicked.current = true;
    setQ(c);
    setBusy(true);
    const res = await searchPlaces(c, {});
    setBusy(false);
    if (res[0]) pick(res[0]);
    else {
      const g = await geocodePlace(c);
      const lat = g.ok ? g.lat : null, lng = g.ok ? g.lng : null;
      if (lat != null) setPos({ lat, lng });
      onPick({ label: c, lat, lng });
    }
  };

  const recenter = () => {
    if (!pos || !mapRef.current) return;
    mapRef.current.flyTo([pos.lat, pos.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(results[active >= 0 ? active : 0]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="brk-office">
      <div className="brk-mapbox" ref={boxRef}>
        <MapContainer
          ref={mapRef}
          center={[pos?.lat ?? BLR.lat, pos?.lng ?? BLR.lng]}
          zoom={pos ? 15 : 11}
          className="brk-leaflet"
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains="abc" maxZoom={19} />
          <ZoomControl position="bottomleft" />
          <MapClicker onPoint={onMapPoint} />
          <Recenter pos={pos} />
          <InvalidateSize />
          {pos && (
            <Marker
              position={[pos.lat, pos.lng]}
              icon={OFFICE_ICON}
              draggable
              eventHandlers={{ dragend: (e) => { const m = e.target.getLatLng(); onMapPoint(m.lat, m.lng); } }}
            >
              {q && <Tooltip permanent direction="top" offset={[0, -34]} className="brk-map-tooltip">{q}</Tooltip>}
            </Marker>
          )}
        </MapContainer>

        <div className="brk-search-row">
          <Search size={18} className="brk-search-icon" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search or drop a pin on the map"
            className="brk-search-input"
            autoComplete="off"
          />
          {busy && <span className="brk-spinner" aria-hidden />}
        </div>

        {pos && (
          <button type="button" className="brk-recenter" onClick={recenter} aria-label="Recenter map">
            <Locate size={18} />
          </button>
        )}

        {open && (
          <div className="brk-suggest">
            {results.map((r, i) => (
              <button
                type="button"
                key={r.id}
                className={`brk-suggest-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
              >
                <svg className="brk-suggest-pin" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11a2.5 2.5 0 0 0 0-5z" /></svg>
                <span className="brk-suggest-txt">
                  <span className="brk-suggest-primary">{r.primary}</span>
                  {r.secondary && <span className="brk-suggest-secondary">{r.secondary}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        {!open && !pos && (
          <div className="brk-map-hint">Search above, or tap the map to drop a pin</div>
        )}
      </div>

      <div className="brk-office-chips">
        <span className="brk-office-chips-h">Popular tech parks</span>
        {chips.map((c) => (
          <button key={c} type="button" className={`brk-pill ${value?.label === c ? "on" : ""}`} onClick={() => pickChip(c)}>
            {value?.label === c && <span className="brk-pill-check"><Check size={11} strokeWidth={3} /></span>}
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Dual-thumb budget slider ──────────────────────────────────────────────── */
function BudgetSlider({ min, max, stretch, onChange, onStretch }) {
  const MIN = 15000, MAX = 200000, STEP = 1000;
  const pct = (v) => ((v - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="brk-budget">
      <div className="brk-budget-value">
        {fmtINR(min)} – {max >= MAX ? "₹2,00,000+" : fmtINR(max)} <span>/ month</span>
      </div>
      <div className="brk-range">
        <div className="brk-range-track" />
        <div className="brk-range-fill" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
        <input
          type="range" min={MIN} max={MAX} step={STEP} value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max - STEP), max)}
        />
        <input
          type="range" min={MIN} max={MAX} step={STEP} value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min + STEP))}
        />
      </div>
      <div className="brk-budget-scale"><span>₹15k</span><span>₹2L+</span></div>
      <label className="brk-check">
        <input type="checkbox" checked={stretch} onChange={(e) => onStretch(e.target.checked)} />
        <span className="brk-check-box">{stretch && <Check size={13} strokeWidth={3} />}</span>
        I'm open to stretching my budget a bit for the right home
      </label>
    </div>
  );
}

/* ── Drag-to-rank ──────────────────────────────────────────────────────────── */
function RankList({ items, onReorder }) {
  return (
    <Reorder.Group axis="y" values={items} onReorder={onReorder} className="brk-rank">
      {items.map((item, i) => (
        <Reorder.Item key={item} value={item} className="brk-rank-item" whileDrag={{ scale: 1.02, boxShadow: "0 12px 26px rgba(4,33,29,0.16)" }}>
          <span className="brk-rank-num">{i + 1}</span>
          <span className="brk-rank-label">{item}</span>
          <GripVertical size={16} className="brk-rank-grip" />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

/* ── Scoped styles ─────────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
      .brk-overlay { position:fixed; inset:0; z-index:1500; background:rgba(4,33,29,0.5); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; font-family:'Inter', system-ui, sans-serif; }
      .brk-shell { position:relative; width:min(460px,100%); height:min(760px,92vh); background:${B.bg}; border-radius:28px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 40px 100px rgba(4,33,29,0.35); }
      .brk-close { position:absolute; top:14px; right:14px; z-index:20; width:34px; height:34px; border-radius:50%; border:none; background:#F1F5F9; color:${B.ink}; display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .brk-close:hover { background:#E2E8F0; }

      .brk-header { padding:22px 24px 0; display:flex; align-items:flex-start; justify-content:space-between; }
      .brk-tagline { font-size:11.5px; line-height:1.35; color:${B.muted}; text-align:right; padding-right:36px; }

      .brk-progress-row { display:flex; align-items:center; gap:10px; padding:14px 24px 0; }
      .brk-progress-track { flex:1; display:flex; gap:5px; }
      .brk-progress-seg { flex:1; height:4px; border-radius:999px; background:${B.track}; }
      .brk-progress-seg.on { background:${B.mint}; }
      .brk-progress-count { font-size:11.5px; font-weight:700; color:${B.muted}; white-space:nowrap; }

      .brk-scroll { flex:1; min-height:0; overflow-y:auto; padding:20px 24px 12px; }
      .brk-panel { display:flex; flex-direction:column; }
      .brk-q { font-weight:800; font-size:21px; line-height:1.28; letter-spacing:-0.01em; color:${B.ink}; margin:0; }
      .brk-sub { font-size:13.5px; line-height:1.5; color:${B.muted}; margin:7px 0 0; }
      .brk-content { margin-top:18px; display:flex; flex-direction:column; gap:14px; }

      .brk-footer { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 24px 20px; border-top:1px solid ${B.line}; }
      .brk-link { display:inline-flex; align-items:center; gap:4px; background:none; border:none; color:${B.ink}; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; padding:8px 2px; }
      .brk-next { display:inline-flex; align-items:center; gap:6px; border:none; border-radius:12px; background:${B.ink}; color:#fff; font-family:inherit; font-weight:700; font-size:14.5px; padding:12px 22px; cursor:pointer; transition:background .15s ease, transform .15s ease; margin-left:auto; }
      .brk-next:hover:not(:disabled) { background:${B.inkDeep}; }
      .brk-next:disabled { opacity:0.4; cursor:not-allowed; }

      /* card grid (commute / occupants / flat types) */
      .brk-cardgrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .brk-card { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:6px; text-align:left; background:#fff; border:1.5px solid ${B.line}; border-radius:16px; padding:16px 14px; cursor:pointer; font-family:inherit; transition:border-color .15s ease, background .15s ease; }
      .brk-card:hover { border-color:${B.mintBorder}; }
      .brk-card.on { border-color:${B.ink}; background:${B.mintWash}; }
      .brk-card-checkbox { position:absolute; top:10px; right:10px; width:20px; height:20px; border-radius:50%; border:1.5px solid ${B.line}; background:#fff; display:flex; align-items:center; justify-content:center; color:#fff; }
      .brk-card.on .brk-card-checkbox { background:${B.ink}; border-color:${B.ink}; }
      .brk-card-icon { color:${B.ink}; }
      .brk-card-label { font-size:14.5px; font-weight:700; color:${B.ink}; }
      .brk-card-sub { font-size:12px; color:${B.muted}; }
      .brk-card.on .brk-card-sub { color:${B.ink}; font-weight:600; }

      .brk-note-banner { display:flex; align-items:flex-start; gap:9px; background:${B.mintWash}; border-radius:12px; padding:12px 14px; font-size:12.5px; line-height:1.45; color:${B.ink}; }
      .brk-note-banner svg { flex-shrink:0; margin-top:1px; }

      /* localities */
      .brk-search-box { display:flex; align-items:center; gap:9px; border:1.5px solid ${B.line}; border-radius:12px; padding:11px 14px; background:#fff; }
      .brk-search-icon { color:${B.muted}; flex-shrink:0; }
      .brk-search-plain { flex:1; border:none; outline:none; font-family:inherit; font-size:14px; color:${B.ink}; background:transparent; }
      .brk-chips-label { font-size:12.5px; font-weight:700; color:${B.muted}; margin-top:2px; }
      .brk-chip-wrap { display:flex; flex-wrap:wrap; gap:9px; }
      .brk-pill { display:inline-flex; align-items:center; gap:6px; border:1.5px solid ${B.line}; background:#fff; color:${B.ink}; font-family:inherit; font-size:13.5px; font-weight:600; padding:9px 15px; border-radius:999px; cursor:pointer; transition:border-color .15s ease, color .15s ease; }
      .brk-pill.on { border-color:${B.ink}; color:${B.ink}; background:${B.mintWash}; }
      .brk-pill-check { width:15px; height:15px; border-radius:50%; background:${B.ink}; color:#fff; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
      .brk-empty-hint { font-size:13px; color:${B.muted}; }

      /* office */
      .brk-office { display:flex; flex-direction:column; gap:14px; }
      .brk-mapbox { position:relative; height:260px; border-radius:16px; overflow:hidden; border:1px solid ${B.line}; background:#EEF2F6; }
      .brk-leaflet { position:absolute; inset:0; width:100%; height:100%; z-index:0; background:#EEF2F6; }
      .brk-lmarker { background:none; border:none; }
      .brk-lmarker svg { filter:drop-shadow(0 4px 6px rgba(4,33,29,0.35)); }
      .brk-map-tooltip.leaflet-tooltip { background:${B.ink}; color:#fff; border:none; font-size:11.5px; font-weight:700; padding:5px 10px; border-radius:999px; box-shadow:none; }
      .brk-map-tooltip.leaflet-tooltip::before { display:none; }
      .brk-recenter { position:absolute; z-index:6; right:10px; bottom:10px; width:36px; height:36px; border-radius:50%; border:none; background:#fff; color:${B.ink}; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 6px 16px rgba(4,33,29,0.2); }
      .brk-map-hint { position:absolute; bottom:9px; left:10px; z-index:5; background:rgba(255,255,255,0.92); color:${B.muted}; font-size:11px; font-weight:600; padding:5px 10px; border-radius:8px; }
      .brk-search-row { position:absolute; z-index:5; top:12px; left:12px; right:12px; display:flex; align-items:center; gap:9px; background:#fff; border-radius:12px; padding:6px 6px 6px 13px; box-shadow:0 8px 22px rgba(4,33,29,0.16); }
      .brk-search-input { flex:1; border:none; outline:none; font-family:inherit; font-size:14px; padding:8px 0; background:transparent; color:${B.ink}; }
      .brk-spinner { width:15px; height:15px; border-radius:50%; border:2px solid ${B.line}; border-top-color:${B.ink}; animation:brk-spin 0.7s linear infinite; flex-shrink:0; margin-right:4px; }
      @keyframes brk-spin { to { transform:rotate(360deg); } }
      .brk-suggest { position:absolute; top:56px; left:12px; right:12px; z-index:6; background:#fff; border-radius:12px; box-shadow:0 18px 40px rgba(4,33,29,0.2); overflow:hidden; max-height:200px; overflow-y:auto; }
      .brk-suggest-item { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:11px 14px; background:none; border:none; border-bottom:1px solid #F1F5F9; cursor:pointer; font-family:inherit; }
      .brk-suggest-item:last-child { border-bottom:none; }
      .brk-suggest-item.active, .brk-suggest-item:hover { background:#F8FAFC; }
      .brk-suggest-pin { flex-shrink:0; color:${B.ink}; }
      .brk-suggest-txt { min-width:0; display:flex; flex-direction:column; }
      .brk-suggest-primary { font-size:13.5px; font-weight:700; color:${B.ink}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .brk-suggest-secondary { font-size:11.5px; color:${B.muted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
      .brk-office-chips { display:flex; flex-wrap:wrap; align-items:center; gap:9px; }
      .brk-office-chips-h { width:100%; font-size:12.5px; font-weight:700; color:${B.muted}; margin-bottom:2px; }

      /* budget */
      .brk-budget-value { font-weight:800; font-size:22px; color:${B.ink}; text-align:center; }
      .brk-budget-value span { font-weight:600; font-size:13px; color:${B.muted}; }
      .brk-range { position:relative; height:34px; margin-top:18px; }
      .brk-range-track { position:absolute; top:14px; left:0; right:0; height:5px; border-radius:999px; background:${B.track}; }
      .brk-range-fill { position:absolute; top:14px; height:5px; border-radius:999px; background:${B.ink}; }
      .brk-range input[type=range] { position:absolute; top:0; left:0; width:100%; height:34px; margin:0; background:none; pointer-events:none; -webkit-appearance:none; appearance:none; }
      .brk-range input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; pointer-events:auto; width:22px; height:22px; border-radius:50%; background:#fff; border:3px solid ${B.ink}; box-shadow:0 3px 8px rgba(4,33,29,0.25); cursor:grab; }
      .brk-range input[type=range]::-moz-range-thumb { pointer-events:auto; width:20px; height:20px; border-radius:50%; background:#fff; border:3px solid ${B.ink}; box-shadow:0 3px 8px rgba(4,33,29,0.25); cursor:grab; }
      .brk-budget-scale { display:flex; justify-content:space-between; font-size:11.5px; color:${B.muted}; font-weight:600; margin-top:6px; }
      .brk-check { display:flex; align-items:flex-start; gap:10px; margin-top:6px; font-size:13.5px; line-height:1.4; font-weight:600; color:${B.ink}; cursor:pointer; }
      .brk-check input { display:none; }
      .brk-check-box { width:21px; height:21px; border-radius:6px; border:1.5px solid ${B.line}; display:inline-flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; margin-top:1px; transition:all .15s ease; }
      .brk-check input:checked + .brk-check-box { background:${B.ink}; border-color:${B.ink}; }

      /* rank */
      .brk-rank { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:9px; }
      .brk-rank-item { display:flex; align-items:center; gap:12px; background:#fff; border:1.5px solid ${B.line}; border-radius:13px; padding:13px 14px; cursor:grab; }
      .brk-rank-num { width:24px; height:24px; border-radius:8px; background:${B.ink}; color:#fff; font-weight:800; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .brk-rank-label { flex:1; font-size:14px; font-weight:600; color:${B.ink}; }
      .brk-rank-grip { color:#CBD5E1; flex-shrink:0; }

      /* review */
      .brk-review-list { display:flex; flex-direction:column; gap:22px; margin-top:6px; }
      .brk-review-block { display:flex; flex-direction:column; gap:12px; padding-bottom:20px; border-bottom:1px solid ${B.line}; }
      .brk-review-block:last-child { border-bottom:none; padding-bottom:0; }
      .brk-review-q { font-weight:700; font-size:15px; color:${B.ink}; margin:0; }

      @media (max-width:520px) {
        .brk-overlay { padding:0; }
        .brk-shell { width:100vw; height:100vh; height:100dvh; border-radius:0; }
      }
    `}</style>
  );
}
