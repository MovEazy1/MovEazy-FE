/**
 * AIBroker — a premium, guided "personal broker" experience.
 *
 * Not a chatbot. The user meets a dedicated consultant (an animated illustrated
 * broker) who asks one beautifully-tappable question at a time, keeps a live
 * "My Understanding" card, and finishes by personally revealing a handful of
 * real matches from the catalogue.
 *
 * Two panes: left (35%) = the broker + skyline + roadmap + understanding card;
 * right (65%) = the current question. Mostly tap-to-select chips; typing optional.
 *
 * Renders its own full-screen overlay. Mount as <AIBroker open onClose/>.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodePlace, searchPlaces, reverseGeocode } from "../lib/geocode";
import { useAuth } from "../context/AuthContext";
import { saveUserRequirement } from "../lib/userRequirements";
import { updateUserProfileFields } from "../lib/profileService";
import { fetchPublishedInventory } from "../lib/inventory";
import { matchRequirementToListings } from "../lib/inventoryMatch";
import {
  LOCALITIES, LOCALITIES_MORE, OCCUPANTS, FLAT_TYPES, MUST_HAVES,
  LIFESTYLE, DEALBREAKERS, OFFICE_CHIPS,
} from "../data/preferenceOptions";

const C = {
  ink: "#1C1A17", cream: "#FBF9F4", cream2: "#F3EEE4",
  coral: "#EF5A45", coralDeep: "#d8412b", gold: "#E0A83B",
  navy: "#243657", navyDark: "#1b2942", violet: "#7C6BF0", sage: "#3E9E86",
  line: "#E8E1D4", muted: "#8C8377", skin: "#C68A5E", skinShade: "#b07a50",
  hair: "#241d18",
};
const EASE = [0.22, 1, 0.36, 1];
const fmtINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/* Indian mobile validation — a bare 10-digit number starting 6-9, optionally
   prefixed with 91/+91. */
const phoneDigits = (v) => String(v || "").replace(/\D/g, "");
const isValidPhone = (v) => {
  const d = phoneDigits(v);
  if (d.length === 10) return /^[6-9]/.test(d);
  if (d.length === 12 && d.startsWith("91")) return /^[6-9]/.test(d.slice(2));
  return false;
};

/* ── Question data ─────────────────────────────────────────────────────────── */
/* Vocabulary now lives in ../data/preferenceOptions.js so the List my Flat
   supply side describes homes with the identical option strings. */

const ACKS =["Perfect.", "That's helpful.", "Got it.", "Noted — I'll keep that in mind.", "Great, that saves us time.", "Lovely choice.", "Understood."];

const ROADMAP = [
  { key: "location", label: "Location", icon: "📍" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "home", label: "Home type", icon: "🏡" },
  { key: "amenities", label: "Must-haves", icon: "✨" },
  { key: "lifestyle", label: "Lifestyle", icon: "🌆" },
  { key: "dealbreakers", label: "Deal-breakers", icon: "🚫" },
];

const NOTE_PLACEHOLDERS = [
  "I work night shifts.",
  "I have a Labrador.",
  "I need parking for two cars.",
  "I love natural light.",
  "I want a balcony for plants.",
  "I'd like to be near a metro station.",
];

/* ── The illustrated broker ────────────────────────────────────────────────── */
function Broker({ state }) {
  // gesture (right) arm poses
  const arm = {
    idle: { rotate: 4 },
    wave: { rotate: [4, 26, -6, 26, 4], transition: { duration: 1.5, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" } },
    speaking: { rotate: [4, -6, 4], transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" } },
    thinking: { rotate: 10 },
    point: { rotate: -46, transition: { type: "spring", stiffness: 120, damping: 12 } },
  }[state] || { rotate: 4 };

  const head = {
    idle: { rotate: 0, y: 0 },
    wave: { rotate: -2, y: 0 },
    speaking: { rotate: [0, -1.5, 1, 0], transition: { duration: 1.1, repeat: Infinity } },
    thinking: { rotate: 6, y: 1 },
    point: { rotate: -2, y: 0 },
  }[state] || { rotate: 0 };

  return (
    <div className="brk-figure">
      <svg viewBox="0 0 300 470" className="brk-svg" aria-hidden>
        <defs>
          <linearGradient id="brk-suit" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={C.navy} />
            <stop offset="1" stopColor={C.navyDark} />
          </linearGradient>
          <linearGradient id="brk-tab" x1="0" x2="1">
            <stop offset="0" stopColor="#2b3d5e" />
            <stop offset="1" stopColor="#3a4f76" />
          </linearGradient>
        </defs>

        {/* soft ground shadow */}
        <ellipse cx="150" cy="452" rx="96" ry="14" fill={C.ink} opacity="0.08" />

        {/* breathing torso group */}
        <g className="brk-breathe">
          {/* legs / lower */}
          <path d="M108 470 L112 372 H188 L192 470 H160 L150 402 L140 470 Z" fill="#20304c" />

          {/* gesture (right) arm — behind body, pivots at shoulder */}
          <motion.g style={{ transformBox: "fill-box", transformOrigin: "16% 8%" }} animate={arm}>
            <path d="M196 196 q40 10 46 66 q3 30 -6 58" fill="none" stroke="url(#brk-suit)" strokeWidth="26" strokeLinecap="round" />
            <circle cx="236" cy="322" r="12" fill={C.skin} />
          </motion.g>

          {/* jacket body */}
          <path d="M96 214 q54 -40 108 0 l8 168 H88 Z" fill="url(#brk-suit)" />
          {/* shirt V + tie */}
          <path d="M150 176 L128 210 L150 250 L172 210 Z" fill="#f6f4ef" />
          <path d="M150 198 l-9 16 l9 40 l9 -40 z" fill={C.coral} />
          <path d="M150 176 l-13 20 l13 10 l13 -10 z" fill="#ece7df" />
          {/* lapels */}
          <path d="M150 178 L120 208 L134 250 L150 210 Z" fill="#1f2f4a" />
          <path d="M150 178 L180 208 L166 250 L150 210 Z" fill="#1f2f4a" />

          {/* left arm holding tablet across body */}
          <path d="M104 200 q-34 20 -30 74" fill="none" stroke="url(#brk-suit)" strokeWidth="26" strokeLinecap="round" />
          <g transform="rotate(-9 96 300)">
            <rect x="60" y="270" width="96" height="66" rx="8" fill="url(#brk-tab)" stroke="#54688f" strokeWidth="2" />
            <rect x="68" y="278" width="80" height="50" rx="4" fill="#0f1726" />
            <rect x="74" y="286" width="42" height="6" rx="3" fill={C.coral} opacity="0.9" />
            <rect x="74" y="298" width="60" height="4" rx="2" fill="#40527a" />
            <rect x="74" y="307" width="52" height="4" rx="2" fill="#40527a" />
            <rect x="74" y="316" width="34" height="4" rx="2" fill="#40527a" />
          </g>
          <circle cx="78" cy="330" r="12" fill={C.skin} />

          {/* head group */}
          <motion.g animate={head} style={{ transformBox: "fill-box", transformOrigin: "50% 90%" }}>
            {/* neck */}
            <rect x="140" y="150" width="20" height="26" rx="8" fill={C.skinShade} />
            {/* face */}
            <path d="M120 108 q30 -34 60 0 q10 40 -6 62 q-24 24 -48 0 q-16 -22 -6 -62 Z" fill={C.skin} />
            {/* ears */}
            <circle cx="118" cy="128" r="7" fill={C.skinShade} />
            <circle cx="182" cy="128" r="7" fill={C.skinShade} />
            {/* hair */}
            <path d="M114 118 q-6 -46 36 -50 q42 4 36 50 q-10 -20 -36 -20 q-26 0 -36 20 Z" fill={C.hair} />
            {/* brows */}
            <rect className="brk-brow" x="128" y="126" width="18" height="4" rx="2" fill={C.hair} />
            <rect className="brk-brow" x="154" y="126" width="18" height="4" rx="2" fill={C.hair} />
            {/* eyes (blink) */}
            <g className="brk-eyes">
              <ellipse cx="137" cy="138" rx="4.4" ry="5.2" fill="#2a2018" />
              <ellipse cx="163" cy="138" rx="4.4" ry="5.2" fill="#2a2018" />
            </g>
            {/* nose */}
            <path d="M150 140 l-4 14 h8 z" fill={C.skinShade} opacity="0.5" />
            {/* smile */}
            <path d="M136 158 q14 12 28 0" fill="none" stroke="#7a4a30" strokeWidth="3" strokeLinecap="round" />
            {/* light beard */}
            <path d="M126 150 q24 30 48 0 q-6 20 -24 24 q-18 -4 -24 -24 Z" fill={C.hair} opacity="0.14" />
          </motion.g>
        </g>
      </svg>
    </div>
  );
}

/* ── Small UI atoms ────────────────────────────────────────────────────────── */
function Chip({ active, onClick, children, accent = C.coral }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`brk-chip ${active ? "on" : ""}`}
      style={active ? { background: accent, borderColor: accent, color: "#fff" } : undefined}
    >
      {active && <span className="brk-chip-tick">✓</span>}
      {children}
    </button>
  );
}

function PhoneField({ value, onChange }) {
  const touched = (value || "").length > 0;
  const ok = isValidPhone(value);
  return (
    <div className="brk-note">
      <label className="brk-note-label">
        Your mobile number <span className="brk-req">*</span>
      </label>
      <div className={`brk-phone-row ${touched && !ok ? "err" : ""}`}>
        <span className="brk-phone-prefix">+91</span>
        <input
          type="tel"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="98xxxxxxxx"
          className="brk-phone-input"
          autoComplete="tel"
        />
      </div>
      <p className="brk-phone-hint">
        {touched && !ok
          ? "Enter a valid 10-digit mobile number."
          : "I’ll use this to send you shortlisted homes and coordinate visits."}
      </p>
    </div>
  );
}

function NoteField({ value, onChange, placeholder }) {
  return (
    <div className="brk-note">
      <label className="brk-note-label">Anything else I should know?</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="brk-note-input"
      />
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */
const STEPS = [
  { id: "phone", group: "location", type: "phone", q: "First, what's your mobile number?", sub: "So I can send you shortlisted homes and coordinate visits directly." },
  { id: "office", group: "location", type: "location", q: "Where's your office?", sub: "Search it below. I'll centre the hunt around your commute." },
  { id: "localities", group: "location", type: "multi", q: "Which localities are you considering?", sub: "Pick as many as you like — I'll focus my search here.", options: LOCALITIES, more: LOCALITIES_MORE },
  { id: "budget", group: "budget", type: "budget", q: "What's your monthly rent range?", sub: "Drag both ends to set your range." },
  { id: "occupants", group: "home", type: "multi", q: "Who'll be living there?", sub: "Select everyone who applies.", options: OCCUPANTS },
  { id: "flatTypes", group: "home", type: "multi", q: "What kind of home works?", sub: "All are selected by default — untick anything that won't work for you.", options: FLAT_TYPES, defaultAll: true },
  { id: "mustHaves", group: "amenities", type: "multi", q: "Any must-haves?", sub: "The things you'd really rather not compromise on.", options: MUST_HAVES },
  { id: "lifestyle", group: "lifestyle", type: "multi", q: "What matters most for your lifestyle?", sub: "Choose up to five.", options: LIFESTYLE, max: 5 },
  { id: "dealBreakers", group: "dealbreakers", type: "multi", q: "What should I never recommend?", sub: "Your hard nos — I'll filter these out entirely.", options: DEALBREAKERS },
  { id: "priority", group: "dealbreakers", type: "rank", q: "Finally — rank these by what matters most.", sub: "Drag to reorder — top = most important." },
];

export default function AIBroker({ open, onClose }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState("intro"); // intro | q | reveal
  const [stepIdx, setStepIdx] = useState(0);
  const [brokerState, setBrokerState] = useState("wave");
  const [ack, setAck] = useState("");
  const [prefs, setPrefs] = useState({
    office: null, phone: "", localities: [], budgetMin: 20000, budgetMax: 45000, stretch: false,
    occupants: [], flatTypes: [...FLAT_TYPES], mustHaves: [], lifestyle: [], dealBreakers: [],
    priority: ["Near to Office", "Good locality", "Budget fit", "Apartment over standalone", "Flat size", "Ventilation"],
    notes: {},
  });
  const notePh = useMemo(() => NOTE_PLACEHOLDERS[Math.floor(Math.random() * NOTE_PLACEHOLDERS.length)], [stepIdx]);

  // reset when reopened
  useEffect(() => {
    if (open) {
      setPhase("intro");
      setStepIdx(0);
      setBrokerState("wave");
      setAck("");
    }
  }, [open]);

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
      const cur = p[key];
      const has = cur.includes(val);
      let next = has ? cur.filter((x) => x !== val) : [...cur, val];
      if (max && next.length > max) return p;
      return { ...p, [key]: next };
    });
  const setNote = (v) => setPrefs((p) => ({ ...p, notes: { ...p.notes, [step.id]: v } }));

  const doneGroups = useMemo(() => {
    const passed = STEPS.slice(0, stepIdx).map((s) => s.group);
    if (phase === "reveal") return new Set(ROADMAP.map((r) => r.key));
    return new Set(passed);
  }, [stepIdx, phase]);

  const advance = () => {
    if (step.type === "phone" && isValidPhone(prefs.phone)) {
      const uid = user?.uid || user?.id;
      if (uid) updateUserProfileFields(uid, { phone: prefs.phone }).catch(() => {});
    }
    setAck(ACKS[Math.floor(Math.random() * ACKS.length)]);
    setBrokerState("speaking");
    setTimeout(() => {
      setAck("");
      if (stepIdx + 1 >= STEPS.length) {
        // Questionnaire complete — persist the requirement (best-effort) and take
        // the user straight to the recommendations listings page (map + scored
        // listings), instead of the in-modal reveal.
        saveUserRequirement(user, prefs);
        onClose?.();
        navigate("/recommendations", { state: { prefs, justSubmitted: true } });
      } else {
        setStepIdx((i) => i + 1);
        setBrokerState("thinking");
        setTimeout(() => setBrokerState("idle"), 700);
      }
    }, 900);
  };

  const begin = () => {
    setPhase("q");
    setBrokerState("thinking");
    setTimeout(() => setBrokerState("idle"), 700);
  };

  const canContinue = () => {
    if (step.type === "phone") return isValidPhone(prefs.phone);
    if (step.type === "location") return !!prefs.office;
    if (step.type === "single") return !!prefs.age;
    if (step.type === "multi") {
      const map = { localities: "localities", occupants: "occupants", flatTypes: "flatTypes", mustHaves: "mustHaves", lifestyle: "lifestyle", dealBreakers: "dealBreakers" };
      const arr = prefs[map[step.id]] || [];
      // must-haves / lifestyle / deal-breakers optional; localities & occupants & flatTypes need ≥1
      if (["localities", "occupants", "flatTypes"].includes(step.id)) return arr.length > 0;
      return true;
    }
    return true;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="brk-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <Styles />
          <motion.div
            className="brk-shell"
            initial={{ opacity: 0, scale: 0.97, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 24 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="brk-close" onClick={onClose} aria-label="Close">✕</button>

            {/* ── LEFT: broker + skyline + roadmap + understanding ── */}
            <aside className="brk-left">
              <div className="brk-skyline" aria-hidden>
                <Skyline />
              </div>
              <div className="brk-broker-stage">
                <Broker state={brokerState} />
                <AnimatePresence>
                  {ack && (
                    <motion.div
                      className="brk-ack"
                      initial={{ opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6 }}
                    >
                      {ack}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="brk-left-cards">
                {phase !== "intro" && (
                  <>
                    <div className="brk-roadmap">
                      <div className="brk-roadmap-h">🏠 Understanding you</div>
                      <div className="brk-roadmap-bar">
                        <motion.div
                          className="brk-roadmap-fill"
                          animate={{ width: `${phase === "reveal" ? 100 : (stepIdx / STEPS.length) * 100}%` }}
                          transition={{ duration: 0.5, ease: EASE }}
                        />
                      </div>
                      <div className="brk-roadmap-list">
                        {ROADMAP.map((r) => {
                          const done = doneGroups.has(r.key);
                          const current = step?.group === r.key && phase === "q";
                          return (
                            <div key={r.key} className={`brk-rm-item ${done ? "done" : ""} ${current ? "current" : ""}`}>
                              <span className="brk-rm-mark">{done ? "✓" : current ? "◍" : "○"}</span>
                              {r.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <UnderstandingCard prefs={prefs} />
                  </>
                )}
              </div>
            </aside>

            {/* ── RIGHT: conversation ── */}
            <section className="brk-right">
              <AnimatePresence mode="wait">
                {phase === "intro" && (
                  <motion.div key="intro" className="brk-step" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.4, ease: EASE }}>
                    <div className="brk-intro">
                      <div className="brk-badge">💬 Your online agent</div>
                      <h2 className="brk-intro-h">Hi, I'm your online agent.</h2>
                      <p className="brk-intro-p">
                        I'll help you find a perfect, cozy home within 10 minutes.
                      </p>
                      <p className="brk-intro-p brk-intro-p2">
                        First, please help me with your mobile number — I'll use it to send you shortlisted homes.
                      </p>
                      <button type="button" className="brk-cta" onClick={begin}>
                        Let's begin
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </motion.div>
                )}

                {phase === "q" && (
                  <motion.div key={step.id} className="brk-step" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.42, ease: EASE }}>
                    <div className="brk-qhead">
                      <span className="brk-qcount">{stepIdx + 1} of {STEPS.length}</span>
                      <h2 className="brk-q">{step.q}</h2>
                      {step.sub && <p className="brk-qsub">{step.sub}</p>}
                    </div>

                    <div className="brk-qbody">
                      {step.type === "phone" && (
                        <PhoneField value={prefs.phone} onChange={(v) => set({ phone: v })} />
                      )}

                      {step.type === "location" && (
                        <OfficeSearch value={prefs.office} onPick={(o) => set({ office: o })} chips={OFFICE_CHIPS} />
                      )}

                      {step.type === "single" && (
                        <div className="brk-chips">
                          {step.options.map((o) => (
                            <Chip key={o} active={prefs.age === o} onClick={() => set({ age: o })}>{o}</Chip>
                          ))}
                        </div>
                      )}

                      {step.type === "multi" && (
                        <MultiSelect step={step} prefs={prefs} toggle={toggle} />
                      )}

                      {step.type === "budget" && (
                        <BudgetSlider
                          min={prefs.budgetMin} max={prefs.budgetMax} stretch={prefs.stretch}
                          onChange={(mn, mx) => set({ budgetMin: mn, budgetMax: mx })}
                          onStretch={(v) => set({ stretch: v })}
                        />
                      )}

                      {step.type === "rank" && (
                        <RankList
                          items={prefs.priority.map((p) => (p === "Budget fit" ? `Budget under ${fmtINR(prefs.budgetMax)}` : p))}
                          onReorder={(labels) => set({ priority: labels.map((l) => (l.startsWith("Budget under") ? "Budget fit" : l)) })}
                        />
                      )}

                      {step.id !== "priority" && (
                        <NoteField value={prefs.notes[step.id]} onChange={setNote} placeholder={`e.g. "${notePh}"`} />
                      )}
                    </div>

                    <div className="brk-actions">
                      <button type="button" className="brk-cta" disabled={!canContinue()} onClick={advance}>
                        {stepIdx + 1 >= STEPS.length ? "Find my homes" : "Continue"}
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      {stepIdx > 0 && (
                        <button type="button" className="brk-back" onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>Back</button>
                      )}
                    </div>
                  </motion.div>
                )}

                {phase === "reveal" && (
                  <motion.div key="reveal" className="brk-step" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                    <Reveal prefs={prefs} onBrokerPoint={() => setBrokerState("point")} navigate={navigate} onClose={onClose} />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Multi-select (with optional "more" expander) ──────────────────────────── */
function MultiSelect({ step, prefs, toggle }) {
  const [showMore, setShowMore] = useState(false);
  const key = step.id;
  const selected = prefs[key] || [];
  const atMax = step.max && selected.length >= step.max;
  const opts = showMore && step.more ? [...step.options, ...step.more] : step.options;
  return (
    <>
      {step.max && (
        <div className="brk-maxhint">{selected.length}/{step.max} selected</div>
      )}
      <div className="brk-chips">
        {opts.map((o) => {
          const on = selected.includes(o);
          return (
            <Chip
              key={o}
              active={on}
              accent={key === "dealBreakers" ? C.coralDeep : key === "lifestyle" ? C.violet : C.coral}
              onClick={() => {
                if (!on && atMax) return;
                toggle(key, o, step.max);
              }}
            >
              {o}
            </Chip>
          );
        })}
        {step.more && !showMore && (
          <button type="button" className="brk-chip brk-chip-more" onClick={() => setShowMore(true)}>+ More</button>
        )}
      </div>
    </>
  );
}

/* ── Office location search — live autocomplete + interactive map ──────────── */
const BLR = { lat: 12.9716, lng: 77.5946 };
const OFFICE_ICON = L.divIcon({
  className: "brk-lmarker",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 1C7.8 1 2 6.8 2 14c0 9.2 13 25 13 25s13-15.8 13-25C28 6.8 22.2 1 15 1z" fill="#EF5A45" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="14" r="4.6" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

function MapClicker({ onPoint }) {
  useMapEvents({ click(e) { onPoint(e.latlng.lat, e.latlng.lng); } });
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
          center={[pos?.lat ?? BLR.lat, pos?.lng ?? BLR.lng]}
          zoom={pos ? 15 : 11}
          className="brk-leaflet"
          zoomControl={false}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
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
            />
          )}
        </MapContainer>

        <div className="brk-search-row">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#948c83" strokeWidth="2.2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search your office, tech park or landmark…"
            className="brk-search-input"
            autoComplete="off"
          />
          {busy && <span className="brk-spinner" aria-hidden />}
        </div>

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

        {!open && (
          <div className="brk-map-hint">{pos ? "Drag the pin or tap the map to fine-tune" : "Search above, or tap the map to drop a pin"}</div>
        )}
      </div>

      <div className="brk-office-chips">
        <span className="brk-office-chips-h">Popular:</span>
        {chips.map((c) => (
          <button key={c} type="button" className={`brk-chip ${value?.label === c ? "on" : ""}`} style={value?.label === c ? { background: C.coral, borderColor: C.coral, color: "#fff" } : undefined} onClick={() => pickChip(c)}>
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
      <div className="brk-budget-vals">
        <div><span>Min</span><b>{fmtINR(min)}</b></div>
        <div className="brk-budget-max"><span>Max</span><b>{max >= MAX ? "₹2,00,000+" : fmtINR(max)}</b></div>
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
        <span className="brk-check-box">{stretch && "✓"}</span>
        I can stretch my budget for a really good property.
      </label>
    </div>
  );
}

/* ── Drag-to-rank ──────────────────────────────────────────────────────────── */
function RankList({ items, onReorder }) {
  return (
    <Reorder.Group axis="y" values={items} onReorder={onReorder} className="brk-rank">
      {items.map((item, i) => (
        <Reorder.Item key={item} value={item} className="brk-rank-item" whileDrag={{ scale: 1.03, boxShadow: "0 12px 30px rgba(28,26,23,0.18)" }}>
          <span className="brk-rank-num">{i + 1}</span>
          <span className="brk-rank-label">{item}</span>
          <span className="brk-rank-grip" aria-hidden>⋮⋮</span>
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

/* ── Live "My Understanding" card ──────────────────────────────────────────── */
function UnderstandingCard({ prefs }) {
  const rows = [];
  if (prefs.office) rows.push(["📍", prefs.office.label]);
  if (prefs.localities.length) rows.push(["🗺️", prefs.localities.slice(0, 3).join(", ") + (prefs.localities.length > 3 ? "…" : "")]);
  rows.push(["💰", `${fmtINR(prefs.budgetMin)} – ${prefs.budgetMax >= 200000 ? "₹2L+" : fmtINR(prefs.budgetMax)}`]);
  if (prefs.flatTypes.length && prefs.flatTypes.length < FLAT_TYPES.length) rows.push(["🏡", prefs.flatTypes.slice(0, 3).join(", ")]);
  if (prefs.occupants.includes("Pet Owner") || prefs.mustHaves.includes("Pet Friendly")) rows.push(["🐶", "Pet friendly"]);
  if (prefs.mustHaves.includes("Good Sunlight")) rows.push(["🌞", "Loves sunlight"]);
  if (prefs.mustHaves.includes("Near Metro")) rows.push(["🚇", "Near metro"]);
  if (prefs.occupants.includes("Working Professionals") || prefs.lifestyle.includes("Office Commute")) rows.push(["🧑‍💻", "Commute matters"]);

  return (
    <div className="brk-understand">
      <div className="brk-understand-h">My understanding</div>
      <AnimatePresence initial={false}>
        {rows.map(([icon, val]) => (
          <motion.div key={icon + val} className="brk-understand-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <span>{icon}</span>{val}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Final reveal ──────────────────────────────────────────────────────────── */
function Reveal({ prefs, onBrokerPoint, navigate, onClose }) {
  const [conf, setConf] = useState(0);
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState(true);
  const [matches, setMatches] = useState([]);

  // Rank the real inventory against this user's requirement, best score first.
  useEffect(() => {
    let alive = true;
    (async () => {
      let cards = [];
      try {
        const inventory = await fetchPublishedInventory();
        cards = matchRequirementToListings(prefs, inventory, { min: 30 })
          .slice(0, 6)
          .map((m) => ({
            key: m.listing.property_id,
            image: m.listing.cover_image_url || (m.listing.images && m.listing.images[0]) || "",
            pct: m.score,
            title: m.listing.title || `${m.listing.flat_type || "Home"} in ${m.listing.area || "Bengaluru"}`,
            bhk: m.listing.flat_type || "",
            addr: String(m.listing.area || "Bengaluru").split(",")[0].trim(),
            rent: Number(m.listing.rent) || 0,
            why: m.reasons && m.reasons.length ? m.reasons.slice(0, 2).join(" · ") : "",
          }));
      } catch { cards = []; }
      if (alive) setMatches(cards);
    })();
    return () => { alive = false; };
  }, [prefs]);

  useEffect(() => {
    const t0 = setTimeout(() => setThinking(false), 1400);
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1600);
      setConf(Math.round(94 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const t1 = setTimeout(() => { raf = requestAnimationFrame(tick); }, 1400);
    return () => { clearTimeout(t0); clearTimeout(t1); cancelAnimationFrame(raf); };
  }, []);

  // reveal cards one-by-one after confidence lands
  useEffect(() => {
    if (thinking) return;
    onBrokerPoint?.();
    if (shown >= matches.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [thinking, shown, matches.length, onBrokerPoint]);

  const toMap = () => {
    const p = new URLSearchParams();
    p.set("minRent", String(prefs.budgetMin));
    p.set("maxRent", String(prefs.stretch ? Math.round(prefs.budgetMax * 1.15) : prefs.budgetMax));
    if (prefs.localities[0]) p.set("locality", prefs.localities[0]);
    const bhk = prefs.flatTypes.find((f) => /BHK|RK/.test(f));
    if (bhk) p.set("bhk", bhk);
    navigate(`/map?${p.toString()}`);
    onClose?.();
  };

  if (thinking) {
    return (
      <div className="brk-thinking">
        <div className="brk-thinking-dots"><span /><span /><span /></div>
        <p>Reviewing everything you told me…</p>
      </div>
    );
  }

  return (
    <div className="brk-reveal">
      <div className="brk-reveal-head">
        <div className="brk-conf">
          <div className="brk-conf-num">{conf}%</div>
          <div className="brk-conf-label">confidence</div>
        </div>
        <div>
          <h2 className="brk-reveal-h">I think I understand exactly what you're looking for.</h2>
          <p className="brk-reveal-sub">Here's what I'd personally shortlist for you — not a search dump, just the ones worth your time.</p>
        </div>
      </div>

      <div className="brk-cards">
        {matches.length === 0 && (
          <div className="brk-empty">I'll widen the net on the map — your exact match isn't in today's shortlist, but I know where to look.</div>
        )}
        {matches.slice(0, shown).map((m) => (
          <motion.div key={m.key} className="brk-pcard" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}>
            <div className="brk-pcard-img">
              {m.image && (
                <img src={m.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              )}
              <span className="brk-pcard-match">{m.pct}% match</span>
            </div>
            <div className="brk-pcard-body">
              <div className="brk-pcard-title">{m.title}</div>
              <div className="brk-pcard-meta">{m.bhk}{m.bhk ? " · " : ""}{m.addr}</div>
              <div className="brk-pcard-foot">
                <span className="brk-pcard-rent">{fmtINR(m.rent)}<small>/mo</small></span>
                {m.why && <span className="brk-pcard-why">{m.why}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {shown >= matches.length && (
        <motion.div className="brk-reveal-cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <button type="button" className="brk-cta" onClick={toMap}>
            See all matches on the map
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="brk-back" onClick={onClose}>Maybe later</button>
        </motion.div>
      )}
    </div>
  );
}

/* ── Skyline ───────────────────────────────────────────────────────────────── */
function Skyline() {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" aria-hidden>
      {[[10, 110, 44, 90], [58, 70, 40, 130], [102, 130, 50, 70], [156, 90, 46, 110], [206, 50, 42, 150], [252, 120, 48, 80], [304, 80, 44, 120], [352, 140, 42, 60]].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="3" fill="#fff" opacity={0.5 + (i % 3) * 0.06} />
          {[0, 1, 2].map((c) => [0, 1, 2, 3].map((r) => (
            <rect key={`${c}-${r}`} x={x + 7 + c * (w / 3)} y={y + 12 + r * (h / 5)} width="6" height="8" fill={C.gold} opacity={(i + c + r) % 3 === 0 ? 0.5 : 0.16} />
          )))}
        </g>
      ))}
    </svg>
  );
}

/* ── Scoped styles ─────────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
      .brk-overlay { position:fixed; inset:0; z-index:1500; background:rgba(20,18,16,0.55); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; font-family:'Plus Jakarta Sans', system-ui, sans-serif; }
      .brk-shell { position:relative; width:min(1120px,100%); height:min(760px,92vh); background:${C.cream}; border-radius:30px; overflow:hidden; display:grid; grid-template-columns:35% 65%; box-shadow:0 50px 120px rgba(0,0,0,0.45); }
      .brk-close { position:absolute; top:16px; right:16px; z-index:20; width:38px; height:38px; border-radius:50%; border:none; background:rgba(255,255,255,0.9); color:${C.ink}; font-size:15px; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.12); }
      .brk-close:hover { background:#fff; }

      /* LEFT */
      .brk-left { position:relative; background:linear-gradient(180deg, #eef1f6 0%, #e7ebf2 42%, ${C.cream2} 100%); display:flex; flex-direction:column; overflow:hidden; }
      .brk-skyline { position:absolute; top:0; left:0; right:0; height:46%; opacity:0.85; }
      .brk-broker-stage { position:relative; flex:0 0 auto; height:52%; display:flex; align-items:flex-end; justify-content:center; z-index:1; }
      .brk-figure { width:82%; max-width:280px; }
      .brk-svg { width:100%; height:100%; display:block; filter:drop-shadow(0 20px 30px rgba(28,40,70,0.22)); }
      .brk-breathe { animation:brk-breathe 4.4s ease-in-out infinite; transform-origin:150px 260px; }
      @keyframes brk-breathe { 0%,100%{ transform:translateY(0) scaleY(1);} 50%{ transform:translateY(-2px) scaleY(1.006);} }
      .brk-eyes { animation:brk-blink 5.2s infinite; transform-box:fill-box; transform-origin:center; }
      @keyframes brk-blink { 0%,94%,100%{ transform:scaleY(1);} 97%{ transform:scaleY(0.1);} }
      .brk-ack { position:absolute; top:8%; left:50%; transform:translateX(-50%); background:${C.ink}; color:#fff; font-weight:700; font-size:14px; padding:9px 18px; border-radius:999px; white-space:nowrap; box-shadow:0 10px 24px rgba(0,0,0,0.25); z-index:3; }
      .brk-ack::after { content:""; position:absolute; bottom:-6px; left:24px; width:12px; height:12px; background:${C.ink}; transform:rotate(45deg); }

      .brk-left-cards { position:relative; z-index:2; flex:1 1 auto; min-height:0; overflow-y:auto; padding:14px 18px 18px; display:flex; flex-direction:column; gap:12px; }
      .brk-roadmap { background:rgba(255,255,255,0.72); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.9); border-radius:18px; padding:14px 16px; box-shadow:0 8px 24px rgba(28,40,70,0.08); }
      .brk-roadmap-h { font-size:13px; font-weight:800; color:${C.ink}; margin-bottom:10px; }
      .brk-roadmap-bar { height:7px; border-radius:999px; background:#e3e7ee; overflow:hidden; margin-bottom:12px; }
      .brk-roadmap-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,${C.coral},${C.gold}); }
      .brk-roadmap-list { display:flex; flex-direction:column; gap:7px; }
      .brk-rm-item { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#9a9186; }
      .brk-rm-item.done { color:${C.sage}; }
      .brk-rm-item.current { color:${C.ink}; }
      .brk-rm-mark { width:14px; text-align:center; font-weight:800; }

      .brk-understand { background:${C.ink}; border-radius:18px; padding:16px; box-shadow:0 12px 30px rgba(28,26,23,0.2); }
      .brk-understand-h { font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:${C.gold}; margin-bottom:12px; }
      .brk-understand-row { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; color:#f3efe7; padding:5px 0; }
      .brk-understand-row span { font-size:15px; }

      /* RIGHT */
      .brk-right { position:relative; overflow-y:auto; padding:clamp(28px,4vw,54px); display:flex; }
      .brk-step { width:100%; max-width:560px; margin:auto; display:flex; flex-direction:column; }
      .brk-badge { display:inline-block; align-self:flex-start; font-size:12.5px; font-weight:800; color:${C.coralDeep}; background:${C.coral}16; padding:7px 15px; border-radius:999px; margin-bottom:22px; }
      .brk-intro-h { font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:clamp(26px,3.6vw,38px); line-height:1.12; letter-spacing:-0.02em; color:${C.ink}; }
      .brk-intro-p { font-size:16.5px; line-height:1.62; color:#5f584e; margin:18px 0 0; }
      .brk-intro-p2 { color:#7a7266; font-size:15px; }
      .brk-cta { display:inline-flex; align-items:center; gap:9px; align-self:flex-start; margin-top:30px; border:none; border-radius:999px; background:${C.ink}; color:#fff; font-family:inherit; font-weight:700; font-size:15.5px; padding:15px 26px; cursor:pointer; box-shadow:0 14px 32px rgba(28,26,23,0.26); transition:transform .16s ease, box-shadow .16s ease; }
      .brk-cta:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 20px 42px rgba(28,26,23,0.32); }
      .brk-cta:disabled { opacity:0.4; cursor:not-allowed; }

      .brk-qhead { margin-bottom:24px; }
      .brk-qcount { font-size:12px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:${C.muted}; }
      .brk-q { font-family:'Playfair Display', Georgia, serif; font-weight:700; font-size:clamp(23px,3vw,32px); line-height:1.15; letter-spacing:-0.015em; color:${C.ink}; margin:8px 0 0; }
      .brk-qsub { font-size:15px; line-height:1.5; color:#6a6157; margin:10px 0 0; }
      .brk-qbody { display:flex; flex-direction:column; gap:18px; }

      .brk-chips { display:flex; flex-wrap:wrap; gap:10px; }
      .brk-chip { display:inline-flex; align-items:center; gap:6px; border:1.5px solid ${C.line}; background:#fff; color:${C.ink}; font-family:inherit; font-size:14px; font-weight:600; padding:11px 17px; border-radius:999px; cursor:pointer; transition:transform .12s ease, border-color .15s ease, background .15s ease; }
      .brk-chip:hover { transform:translateY(-1px); border-color:#cfc7b8; }
      .brk-chip.on { box-shadow:0 8px 20px rgba(239,90,69,0.24); }
      .brk-chip-tick { font-size:11px; }
      .brk-chip-more { border-style:dashed; color:${C.muted}; }
      .brk-maxhint { font-size:12.5px; font-weight:700; color:${C.violet}; }

      .brk-note { margin-top:4px; }
      .brk-note-label { display:block; font-size:12.5px; font-weight:700; color:${C.muted}; margin-bottom:7px; }
      .brk-note-input { width:100%; border:1.5px solid ${C.line}; background:#fff; border-radius:14px; padding:13px 16px; font-family:inherit; font-size:14.5px; color:${C.ink}; outline:none; transition:border-color .15s ease; }
      .brk-note-input:focus { border-color:${C.coral}; }
      .brk-req { color:${C.coral}; font-weight:900; }
      .brk-phone-row { display:flex; align-items:center; gap:8px; border:1.5px solid ${C.line}; background:#fff; border-radius:14px; padding:0 14px; transition:border-color .15s ease; }
      .brk-phone-row:focus-within { border-color:${C.coral}; }
      .brk-phone-row.err { border-color:${C.coralDeep}; }
      .brk-phone-prefix { font-size:14.5px; font-weight:800; color:${C.muted}; border-right:1.5px solid ${C.line}; padding-right:10px; }
      .brk-phone-input { flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:14.5px; color:${C.ink}; padding:13px 0; letter-spacing:0.02em; }
      .brk-phone-hint { font-size:12px; color:${C.muted}; margin:7px 2px 0; }
      .brk-phone-row.err + .brk-phone-hint { color:${C.coralDeep}; }

      .brk-actions { display:flex; align-items:center; gap:16px; margin-top:30px; }
      .brk-back { background:none; border:none; color:${C.muted}; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
      .brk-back:hover { color:${C.ink}; }

      /* office */
      .brk-mapbox { position:relative; height:300px; border-radius:20px; overflow:hidden; border:1px solid ${C.line}; background:linear-gradient(160deg,#eaeef3,#dfe4ec); }
      .brk-leaflet { position:absolute; inset:0; width:100%; height:100%; z-index:0; background:#e7ebf2; }
      .brk-lmarker { background:none; border:none; }
      .brk-lmarker svg { filter:drop-shadow(0 4px 6px rgba(216,65,43,0.4)); }
      .brk-map-hint { position:absolute; bottom:9px; right:10px; z-index:5; background:rgba(255,255,255,0.92); backdrop-filter:blur(4px); color:#5f584e; font-size:11.5px; font-weight:600; padding:5px 11px; border-radius:9px; box-shadow:0 4px 12px rgba(0,0,0,0.12); }
      .brk-search-row { position:absolute; z-index:5; top:16px; left:16px; right:16px; display:flex; align-items:center; gap:10px; background:#fff; border-radius:14px; padding:6px 6px 6px 14px; box-shadow:0 8px 24px rgba(28,40,70,0.16); }
      .brk-search-input { flex:1; border:none; outline:none; font-family:inherit; font-size:14.5px; padding:8px 0; background:transparent; color:${C.ink}; }
      .brk-spinner { width:16px; height:16px; border-radius:50%; border:2px solid ${C.line}; border-top-color:${C.coral}; animation:brk-spin 0.7s linear infinite; flex-shrink:0; margin-right:6px; }
      @keyframes brk-spin { to { transform:rotate(360deg); } }
      .brk-suggest { position:absolute; top:60px; left:16px; right:16px; z-index:6; background:#fff; border-radius:14px; box-shadow:0 20px 44px rgba(28,40,70,0.22); overflow:hidden; max-height:212px; overflow-y:auto; }
      .brk-suggest-item { display:flex; align-items:center; gap:12px; width:100%; text-align:left; padding:12px 15px; background:none; border:none; border-bottom:1px solid #f2ede5; cursor:pointer; font-family:inherit; }
      .brk-suggest-item:last-child { border-bottom:none; }
      .brk-suggest-item.active, .brk-suggest-item:hover { background:#f7f4ee; }
      .brk-suggest-pin { flex-shrink:0; color:${C.coral}; }
      .brk-suggest-txt { min-width:0; display:flex; flex-direction:column; }
      .brk-suggest-primary { font-size:14px; font-weight:700; color:${C.ink}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .brk-suggest-secondary { font-size:12px; color:${C.muted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
      .brk-pin { position:absolute; left:50%; top:56%; transform:translate(-50%,-100%); display:flex; flex-direction:column; align-items:center; gap:4px; }
      .brk-pin-dot { width:22px; height:22px; border-radius:50% 50% 50% 0; background:${C.coral}; transform:rotate(45deg); box-shadow:0 6px 14px rgba(216,65,43,0.5); }
      .brk-pin-label { background:${C.ink}; color:#fff; font-size:12px; font-weight:700; padding:5px 11px; border-radius:999px; white-space:nowrap; }
      .brk-office-chips { display:flex; flex-wrap:wrap; align-items:center; gap:9px; margin-top:14px; }
      .brk-office-chips-h { font-size:12.5px; font-weight:800; color:${C.muted}; letter-spacing:0.02em; }

      /* budget */
      .brk-budget-vals { display:flex; justify-content:space-between; margin-bottom:16px; }
      .brk-budget-vals > div { display:flex; flex-direction:column; }
      .brk-budget-vals span { font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:${C.muted}; }
      .brk-budget-vals b { font-family:'Playfair Display',serif; font-size:26px; color:${C.ink}; }
      .brk-budget-max { text-align:right; }
      .brk-range { position:relative; height:34px; }
      .brk-range-track { position:absolute; top:14px; left:0; right:0; height:6px; border-radius:999px; background:#e3e7ee; }
      .brk-range-fill { position:absolute; top:14px; height:6px; border-radius:999px; background:linear-gradient(90deg,${C.coral},${C.gold}); }
      .brk-range input[type=range] { position:absolute; top:0; left:0; width:100%; height:34px; margin:0; background:none; pointer-events:none; -webkit-appearance:none; appearance:none; }
      .brk-range input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; pointer-events:auto; width:24px; height:24px; border-radius:50%; background:#fff; border:3px solid ${C.coral}; box-shadow:0 3px 10px rgba(0,0,0,0.22); cursor:grab; }
      .brk-range input[type=range]::-moz-range-thumb { pointer-events:auto; width:22px; height:22px; border-radius:50%; background:#fff; border:3px solid ${C.coral}; box-shadow:0 3px 10px rgba(0,0,0,0.22); cursor:grab; }
      .brk-budget-scale { display:flex; justify-content:space-between; font-size:12px; color:${C.muted}; font-weight:600; margin-top:6px; }
      .brk-check { display:flex; align-items:center; gap:11px; margin-top:22px; font-size:14.5px; font-weight:600; color:${C.ink}; cursor:pointer; }
      .brk-check input { display:none; }
      .brk-check-box { width:24px; height:24px; border-radius:8px; border:2px solid ${C.line}; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:900; flex-shrink:0; transition:all .15s ease; }
      .brk-check input:checked + .brk-check-box { background:${C.coral}; border-color:${C.coral}; }

      /* rank */
      .brk-rank { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
      .brk-rank-item { display:flex; align-items:center; gap:14px; background:#fff; border:1.5px solid ${C.line}; border-radius:14px; padding:14px 16px; cursor:grab; }
      .brk-rank-num { width:26px; height:26px; border-radius:8px; background:${C.ink}; color:#fff; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .brk-rank-label { flex:1; font-size:14.5px; font-weight:600; color:${C.ink}; }
      .brk-rank-grip { color:#c4bcae; font-size:14px; letter-spacing:-2px; }

      /* reveal */
      .brk-thinking { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; margin:auto; }
      .brk-thinking-dots { display:flex; gap:9px; }
      .brk-thinking-dots span { width:12px; height:12px; border-radius:50%; background:${C.coral}; animation:brk-bounce 1.2s infinite ease-in-out; }
      .brk-thinking-dots span:nth-child(2){ animation-delay:0.16s; background:${C.gold}; }
      .brk-thinking-dots span:nth-child(3){ animation-delay:0.32s; background:${C.violet}; }
      @keyframes brk-bounce { 0%,80%,100%{ transform:scale(0.6); opacity:0.5;} 40%{ transform:scale(1); opacity:1;} }
      .brk-thinking p { font-size:15px; color:${C.muted}; font-weight:600; }
      .brk-reveal { width:100%; }
      .brk-reveal-head { display:flex; gap:20px; align-items:center; margin-bottom:24px; }
      .brk-conf { flex-shrink:0; width:92px; height:92px; border-radius:22px; background:${C.ink}; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 14px 30px rgba(28,26,23,0.24); }
      .brk-conf-num { font-family:'Playfair Display',serif; font-weight:700; font-size:30px; line-height:1; color:${C.gold}; }
      .brk-conf-label { font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#cfc8bc; margin-top:4px; }
      .brk-reveal-h { font-family:'Playfair Display',serif; font-weight:700; font-size:clamp(20px,2.6vw,27px); line-height:1.16; letter-spacing:-0.015em; color:${C.ink}; }
      .brk-reveal-sub { font-size:14px; line-height:1.5; color:#6a6157; margin:8px 0 0; }
      .brk-cards { display:flex; flex-direction:column; gap:14px; }
      .brk-empty { background:#fff; border:1px dashed ${C.line}; border-radius:16px; padding:22px; text-align:center; font-size:14px; color:${C.muted}; }
      .brk-pcard { display:flex; gap:14px; background:#fff; border:1px solid ${C.line}; border-radius:18px; padding:12px; box-shadow:0 12px 30px rgba(28,26,23,0.07); }
      .brk-pcard-img { flex-shrink:0; width:118px; height:96px; border-radius:12px; position:relative; overflow:hidden; background:linear-gradient(135deg, ${C.coral}2e, ${C.gold}2e); }
      .brk-pcard-img img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .brk-pcard-match { position:absolute; top:7px; left:7px; background:${C.sage}; color:#fff; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; }
      .brk-pcard-body { flex:1; min-width:0; display:flex; flex-direction:column; }
      .brk-pcard-title { font-family:'Playfair Display',serif; font-weight:700; font-size:17px; color:${C.ink}; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .brk-pcard-meta { font-size:12.5px; color:${C.muted}; margin-top:3px; }
      .brk-pcard-foot { display:flex; align-items:center; gap:10px; margin-top:auto; padding-top:8px; }
      .brk-pcard-rent { font-weight:800; font-size:16px; color:${C.ink}; }
      .brk-pcard-rent small { font-weight:600; font-size:11px; color:${C.muted}; }
      .brk-pcard-why { font-size:11.5px; font-weight:700; color:${C.coralDeep}; background:${C.coral}14; padding:3px 10px; border-radius:999px; }
      .brk-reveal-cta { display:flex; align-items:center; gap:16px; margin-top:22px; }

      @media (max-width:860px) {
        .brk-overlay { padding:0; }
        .brk-shell { grid-template-columns:1fr; grid-template-rows:auto 1fr; height:100vh; width:100vw; border-radius:0; }
        .brk-left { flex-direction:row; height:auto; padding:10px 12px; align-items:center; gap:12px; }
        .brk-skyline { display:none; }
        .brk-broker-stage { height:auto; flex:0 0 auto; width:76px; }
        .brk-figure { width:76px; }
        .brk-ack { top:auto; bottom:-4px; font-size:12px; padding:6px 12px; }
        .brk-ack::after { display:none; }
        .brk-left-cards { flex-direction:row; overflow-x:auto; overflow-y:hidden; padding:0; gap:10px; align-items:stretch; }
        .brk-roadmap { display:none; }
        .brk-understand { min-width:200px; padding:10px 14px; }
        .brk-understand-row { padding:3px 0; font-size:12px; }
        .brk-right { padding:22px 18px 30px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .brk-breathe, .brk-eyes { animation:none; }
      }
    `}</style>
  );
}
