/**
 * A property's page — moveazy.co.in/building/<code>, what its QR poster opens.
 *
 * The building's photos, then every flat floor by floor as the same small
 * card, and a visit booked in three taps: pick the flats, a day and a time,
 * then a name and mobile. No owner contact anywhere — the request goes to the
 * MovEazy partner assigned to the property and to MovEazy (owner_buildings.sql).
 *
 * Where the owner has turned on instant visit, a second sticky button offers
 * it: name, mobile, Google sign-in, and back come the name and number of the
 * person at the property and the address — the tenant walks in now.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BadgeCheck, Building2, CalendarCheck, Check, ChevronLeft, Clock, Film, Images, Layers, MapPin, Navigation, Phone, Sparkles, X, Zap } from "lucide-react";
import { MediaItem, listingCover, listingMedia } from "./partners/partnerMedia";
import { useSnapTrack } from "../hooks/useSnapTrack";
import { usePhotoViewer } from "../hooks/usePhotoViewer";
import { inr } from "../lib/partners";
import {
  cleanMobile, fetchBuildingPage, flatsByFloor, floorLabel, isMobile, nextDays, recordBuildingView, requestBuildingVisit,
  shortInr, startInstantVisit, visitTimes, visitWhen,
} from "../lib/buildings";
import logo from "../assets/logo/moveazy-logo-mint-light.png";

const ME_KEY = "mz_visitor_contact";
// A visit being booked when the renter went to Google to sign in: picked up when they come back.
const PENDING_VISIT_KEY = "mz_building_visit_pending";
function readPendingVisit(code) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_VISIT_KEY) || "null");
    return p && p.code === code && Date.now() - (p.savedAt || 0) < 30 * 60 * 1000 ? p : null;
  } catch { return null; }
}
function savePendingVisit(p) {
  try { sessionStorage.setItem(PENDING_VISIT_KEY, JSON.stringify({ ...p, savedAt: Date.now() })); } catch { /* private tab */ }
}
function clearPendingVisit() {
  try { sessionStorage.removeItem(PENDING_VISIT_KEY); } catch { /* ignore */ }
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
function readMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY) || "null") || {}; } catch { return {}; }
}
function saveMe(me) {
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* private tab */ }
}

const bhk = (f) => f.flat_type || (f.bedrooms ? `${f.bedrooms} BHK` : "Flat");
/** "Flat 302 · 2 BHK" when MovEazy set a house number, else "2 BHK". */
const flatName = (f) => (f.unit_no ? `Flat ${f.unit_no} · ${bhk(f)}` : bhk(f));
const dayLabel = (d, i) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short" }));

export default function BuildingPage() {
  const { code: raw = "" } = useParams();
  const code = raw.toUpperCase();
  const [params] = useSearchParams();
  const [b, setB] = useState(undefined); // undefined loading · null not found
  const [picked, setPicked] = useState(() => new Set());
  const [open, setOpen] = useState(null); // a flat, in the detail sheet
  const [booking, setBooking] = useState(false);
  const [instant, setInstant] = useState(false);
  const [floorOn, setFloorOn] = useState("all");
  const counted = useRef(false);
  const { user, loading: authLoading, loginWithGoogle, updateUserProfile } = useAuth();
  // Back from Google with a visit half-booked: reopen it and finish.
  const [resume, setResume] = useState(null);
  useEffect(() => {
    if (authLoading || !user || !b) return;
    const p = readPendingVisit(code);
    if (!p) return;
    clearPendingVisit();
    // The number they typed before signing in becomes their account's, so the
    // site doesn't ask for it a second time.
    if (p.phone && !String(user.phone || "").trim()) updateUserProfile?.(user.name || p.name, p.phone).catch?.(() => {});
    setPicked(new Set(p.picked || []));
    setResume(p);
    if (p.mode === "instant") setInstant(true); else setBooking(true);
  }, [authLoading, user, b, code, updateUserProfile]);

  useEffect(() => {
    let live = true;
    fetchBuildingPage(code).then((d) => live && setB(d || null)).catch(() => live && setB(null));
    return () => { live = false; };
  }, [code]);

  useEffect(() => {
    if (!b || counted.current) return;
    counted.current = true;
    recordBuildingView(code, params.get("s") === "qr" ? "qr" : "link");
  }, [b, code, params]);

  useEffect(() => {
    if (b?.name) document.title = `${b.name} · ${b.area || "Bengaluru"} | MovEazy`;
  }, [b]);

  const flats = useMemo(() => b?.flats ?? [], [b]);
  const available = useMemo(() => flats.filter((f) => f.available), [flats]);
  // Floors that have a free flat, for the filter chips. The list itself stays in MovEazy's order.
  const floors = useMemo(() => flatsByFloor(available), [available]);
  const shown = floorOn === "all" ? available : available.filter((f) => String(f.floor_number ?? "null") === floorOn);
  const occupied = flats.length - available.length;
  const photos = useMemo(() => {
    const own = (b?.photos ?? []).filter(Boolean);
    return own.length ? own : flats.flatMap((f) => listingMedia(f)).slice(0, 8);
  }, [b, flats]);
  const rents = available.map((f) => Number(f.rent) || 0).filter(Boolean);

  const toggle = useCallback((id) => {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const jump = (key) => {
    setFloorOn(key);
    const el = document.getElementById("bp-flats");
    if (el && el.getBoundingClientRect().top < 0) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  };

  if (b === undefined) return <Shell><div className="bp-skel"><i /><b /><b /><b /></div></Shell>;
  if (b === null) {
    return (
      <Shell>
        <div className="bp-empty">
          <Building2 size={34} />
          <h1>This property isn't taking visits right now</h1>
          <p>The code may be old, or the owner has paused it. Browse verified homes on MovEazy instead.</p>
          <a className="bp-btn bp-btn--primary" href="/">See homes on MovEazy</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {b.cover_video ? <VideoHero src={b.cover_video} photos={photos} name={b.name} /> : <Gallery photos={photos} name={b.name} />}

      <section className="bp-head">
        <div className="bp-verified"><BadgeCheck size={15} /> Listed with MovEazy</div>
        <h1>{b.name}</h1>
        <div className="bp-where"><MapPin size={15} /> {[b.area, b.landmark].filter(Boolean).join(" · ") || "Bengaluru"}</div>
        <div className="bp-facts">
          <div><b>{available.length}</b><span>of {flats.length} flat{flats.length === 1 ? "" : "s"} available</span></div>
          {rents.length > 0 && <div><b>{shortInr(Math.min(...rents))}{rents.length > 1 && Math.max(...rents) !== Math.min(...rents) ? "+" : ""}</b><span>{rents.length > 1 ? "rent from" : "rent"} / month</span></div>}
          {b.total_floors != null && <div><b>{b.total_floors === 0 ? "G" : `G+${b.total_floors}`}</b><span>floors</span></div>}
        </div>
        {(b.amenities ?? []).length > 0 && (
          <div className="bp-amen">{b.amenities.map((a) => <span key={a}><Check size={13} /> {a}</span>)}</div>
        )}
        {b.description && <p className="bp-desc">{b.description}</p>}
      </section>

      <section id="bp-flats" className="bp-flats">
        <div className="bp-flats-top">
          <h2><Layers size={18} /> Available flats · {available.length}</h2>
          <span>Tap <b>+</b> to add flats to your visit — see as many as you like in one trip</span>
        </div>
        {floors.length > 1 && (
          <div className="bp-floortabs" role="tablist">
            <button type="button" className={floorOn === "all" ? "on" : ""} onClick={() => jump("all")}>All floors</button>
            {floors.map((g) => (
              <button key={g.label} type="button" className={floorOn === String(g.floor ?? "null") ? "on" : ""} onClick={() => jump(String(g.floor ?? "null"))}>
                {g.floor === null ? "Other" : g.floor === 0 ? "Ground" : floorLabel(g.floor).replace(" floor", "")}
              </button>
            ))}
          </div>
        )}
        {available.length === 0 && <div className="bp-note">Every flat here is taken right now. Ask for a visit and we'll tell you the moment one frees up.</div>}
        <div className="bp-floor">
          {shown.map((f) => (
            <FlatCard key={f.property_id} flat={f} picked={picked.has(f.property_id)} onToggle={() => toggle(f.property_id)} onOpen={() => setOpen(f)} />
          ))}
        </div>
        {occupied > 0 && <div className="bp-occ">{occupied} more flat{occupied === 1 ? " is" : "s are"} occupied</div>}
      </section>

      <footer className="bp-foot">
        <img src={logo} alt="MovEazy" />
        <p>Verified homes, visits arranged by a MovEazy partner. Your number is only used to set up your visit.</p>
      </footer>

      {b.instant_visit && <div className="bp-cta-room" aria-hidden />}
      <div className="bp-cta">
        {b.instant_visit && (
          <button type="button" className="bp-instant" onClick={() => setInstant(true)}>
            <span className="bp-instant-ic"><Zap size={18} /></span>
            <span className="bp-instant-txt"><b>Instant visit is available on this property</b><small>Walk in now — someone's there to show you around</small></span>
            <span className="bp-instant-go">Visit now</span>
          </button>
        )}
        <button type="button" className="bp-btn bp-btn--primary bp-btn--block" onClick={() => setBooking(true)}>
          <CalendarCheck size={19} />
          {picked.size ? `Schedule visit · ${picked.size} flat${picked.size === 1 ? "" : "s"}` : "Schedule a visit"}
        </button>
      </div>

      {open && (
        <FlatSheet flat={open} picked={picked.has(open.property_id)} onClose={() => setOpen(null)}
          onToggle={() => toggle(open.property_id)}
          onVisit={() => { if (!picked.has(open.property_id)) toggle(open.property_id); setOpen(null); setBooking(true); }} />
      )}
      {booking && (
        <VisitSheet code={code} building={b} flats={flats} picked={picked} onToggle={toggle} onClose={() => { setBooking(false); setResume(null); }}
          user={user} loginWithGoogle={loginWithGoogle} resume={resume} />
      )}
      {instant && (
        <InstantSheet code={code} building={b} flats={flats} picked={picked} onToggle={toggle} onClose={() => { setInstant(false); setResume(null); }}
          user={user} loginWithGoogle={loginWithGoogle} resume={resume?.mode === "instant" ? resume : null} />
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="bp">
      <style>{CSS}</style>
      <header className="bp-top"><a href="/" aria-label="MovEazy"><img src={logo} alt="MovEazy" /></a></header>
      <main className="bp-col">{children}</main>
    </div>
  );
}

/** The building's walk-through video first, its photos a tap away. */
function VideoHero({ src, photos, name }) {
  const [showPhotos, setShowPhotos] = useState(false);
  if (showPhotos && photos.length) {
    return (
      <div className="bp-gwrap">
        <Gallery photos={photos} name={name} />
        <button type="button" className="bp-heroswitch" onClick={() => setShowPhotos(false)}><Film size={14} /> Video</button>
      </div>
    );
  }
  return (
    <div className="bp-gwrap">
      <div className="bp-gallery bp-video">
        <video src={src} autoPlay muted loop playsInline controls preload="metadata" poster={photos[0] || undefined} aria-label={`${name} — video`} />
      </div>
      {photos.length > 0 && (
        <button type="button" className="bp-heroswitch" onClick={() => setShowPhotos(true)}><Images size={14} /> Photos · {photos.length}</button>
      )}
    </div>
  );
}

function Gallery({ photos, name }) {
  const { index: i, trackProps } = useSnapTrack();
  const full = usePhotoViewer(photos, name);
  if (!photos.length) {
    return <div className="bp-gallery bp-gallery--none"><Building2 size={44} /></div>;
  }
  return (
    <div className="bp-gwrap">
      <div className="bp-gallery" {...trackProps}>
        {photos.map((src, k) => (
          <div key={src + k} style={{ cursor: "zoom-in" }} onClick={() => full.open(k)}><MediaItem src={src} alt={k === 0 ? name : ""} /></div>
        ))}
      </div>
      {full.viewer}
      {photos.length > 1 && (
        <>
          <span className="bp-gcount">{i + 1} / {photos.length}</span>
          <div className="bp-dots">{photos.slice(0, 10).map((s, k) => <i key={s + k} className={k === i ? "on" : ""} />)}</div>
        </>
      )}
    </div>
  );
}

function FlatCard({ flat, picked, onToggle, onOpen }) {
  const first = listingCover(flat);
  return (
    <div className={`bp-card${flat.available ? "" : " bp-card--off"}${picked ? " bp-card--on" : ""}`}>
      <button type="button" className="bp-card-main" onClick={onOpen}>
        <div className="bp-card-img">
          {first ? <MediaItem src={first} alt="" /> : <Building2 size={26} />}
          <span className={`bp-tag${flat.available ? "" : " bp-tag--off"}`}>{flat.available ? "Available" : "Occupied"}</span>
        </div>
        <div className="bp-card-body">
          <b className="bp-card-title">{flatName(flat)}{flat.furnishing && !flat.unit_no ? <span> · {flat.furnishing}</span> : null}</b>
          <div className="bp-card-rent">{flat.rent ? inr(flat.rent) : "Rent on request"}<small> / mo</small></div>
          <div className="bp-card-meta">
            {[flat.floor_number != null ? floorLabel(flat.floor_number) : "", flat.unit_no && flat.furnishing ? flat.furnishing : "",
              flat.area_sqft ? `${flat.area_sqft} sq ft` : "",
              flat.deposit ? `${shortInr(flat.deposit)} deposit` : ""].filter(Boolean).join(" · ") || "Details on visit"}
          </div>
        </div>
      </button>
      {flat.available && (
        <button type="button" className={`bp-add${picked ? " on" : ""}`} onClick={onToggle}
          aria-pressed={picked} aria-label={picked ? "Remove from visit" : "Add to visit"}>
          {picked ? <Check size={18} /> : "+"}
        </button>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children, back }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="bp-sheet-bg" onClick={onClose} role="presentation">
      <div className="bp-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="bp-sheet-grab" />
        <div className="bp-sheet-head">
          {back ? <button type="button" className="bp-icon" aria-label="Back" onClick={back}><ChevronLeft size={22} /></button> : null}
          <h3>{title}</h3>
          <button type="button" className="bp-icon" aria-label="Close" onClick={onClose}><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FlatSheet({ flat, picked, onClose, onToggle, onVisit }) {
  const media = useMemo(() => listingMedia(flat), [flat]);
  const full = usePhotoViewer(media, flatName(flat));
  const rows = [
    ["Floor", floorLabel(flat.floor_number)],
    ["Rent", flat.rent ? `${inr(flat.rent)} / month` : "On request"],
    ["Deposit", flat.deposit ? inr(flat.deposit) : "—"],
    ["Furnishing", flat.furnishing || "—"],
    ["Size", flat.area_sqft ? `${flat.area_sqft} sq ft` : "—"],
    ["Bathrooms", flat.bathrooms || "—"],
    ["Available from", flat.available_from ? new Date(flat.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Now"],
  ];
  return (
    <Sheet title={`${flatName(flat)} · ${floorLabel(flat.floor_number)}`} onClose={onClose}>
      {media.length > 0 && (
        <div className="bp-sgallery">
          {media.map((src, k) => <div key={src} style={{ cursor: "zoom-in" }} onClick={() => full.open(k)}><MediaItem src={src} alt="" /></div>)}
        </div>
      )}
      {full.viewer}
      <div className="bp-pad">
        <div className="bp-kv">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        {(flat.amenities ?? []).length > 0 && <div className="bp-amen" style={{ marginTop: 12 }}>{flat.amenities.map((a) => <span key={a}><Check size={13} /> {a}</span>)}</div>}
        {flat.description && <p className="bp-desc">{flat.description}</p>}
        {flat.available ? (
          <div className="bp-two">
            <button type="button" className="bp-btn" onClick={onToggle}>{picked ? <><Check size={16} /> Added</> : "+ Add to visit"}</button>
            <button type="button" className="bp-btn bp-btn--primary" onClick={onVisit}><CalendarCheck size={17} /> Visit this flat</button>
          </div>
        ) : <div className="bp-note">This flat is occupied. Ask for a visit to see the others.</div>}
      </div>
    </Sheet>
  );
}

function VisitSheet({ code, building, flats, picked, onToggle, onClose, user, loginWithGoogle, resume }) {
  const days = useMemo(() => nextDays(14), []);
  const [dayIdx, setDayIdx] = useState(() => (visitTimes(days[0]).length ? 0 : 1));
  const [at, setAt] = useState(() => (resume ? (resume.at === "call" ? "call" : new Date(resume.at)) : null)); // Date, or "call"
  const [step, setStep] = useState(resume ? "who" : "when"); // when | who | done
  const me = useMemo(readMe, []);
  const [name, setName] = useState(resume?.name || me.name || user?.name || "");
  const [phone, setPhone] = useState(resume?.phone || me.phone || user?.phone || "");
  const [note, setNote] = useState(resume?.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const times = useMemo(() => visitTimes(days[dayIdx]), [days, dayIdx]);
  const parts = ["Morning", "Afternoon", "Evening"].map((p) => [p, times.filter((t) => t.part === p)]).filter(([, l]) => l.length);
  const avail = flats.filter((f) => f.available);
  const timeChosen = at === "call" || at instanceof Date;

  const submit = async () => {
    setErr("");
    if (name.trim().length < 2) { setErr("Tell us your name."); return; }
    if (!isMobile(phone)) { setErr("Enter your 10-digit mobile number."); return; }
    // Visits are booked from a MovEazy account: sign in with Google, then we finish this for you.
    if (!user) {
      savePendingVisit({ code, picked: [...picked], at: at instanceof Date ? at.toISOString() : "call", name: name.trim(), phone: cleanMobile(phone), note: note.trim() });
      setBusy(true);
      const res = await loginWithGoogle();
      if (res && res.success === false) {
        clearPendingVisit();
        setErr(res.error || "Couldn't open Google sign-in. Please try again.");
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await requestBuildingVisit(code, {
        name: name.trim(), phone: cleanMobile(phone), propertyIds: [...picked], visitAt: at instanceof Date ? at : null, note: note.trim(),
      });
      saveMe({ name: name.trim(), phone: cleanMobile(phone) });
      setDone({ ...r, at: at instanceof Date ? at : null });
      setStep("done");
    } catch (e) {
      setErr(e?.message || "Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Back from Google: send the request straight away.
  const autoSend = useRef(Boolean(resume));
  useEffect(() => {
    if (!autoSend.current || !user) return;
    autoSend.current = false;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (step === "done") {
    return (
      <Sheet title="Visit requested" onClose={onClose}>
        <div className="bp-pad bp-done">
          <div className="bp-done-ic"><Check size={34} /></div>
          <h4>{done?.updated ? "We've updated your visit" : "You're on the list"}</h4>
          <p className="bp-done-when"><Clock size={16} /> {done?.at ? visitWhen(done.at) : "We'll call you to fix a time"}</p>
          <p>A MovEazy partner will call you on <b>{cleanMobile(phone).replace(/(\d{5})(\d{5})/, "$1 $2")}</b> to confirm
            {done?.at ? " this time" : " a time that suits you"} and share the exact address.</p>
          <div className="bp-done-what"><Building2 size={15} /> {building.name}{picked.size ? ` · ${picked.size} flat${picked.size === 1 ? "" : "s"}` : ""}</div>
          <button type="button" className="bp-btn bp-btn--primary bp-btn--block" onClick={onClose}>Done</button>
          <p className="bp-fine">Saved to your MovEazy account{user?.email ? ` (${user.email})` : ""} — <Link to="/visits">see your visits</Link>.</p>
        </div>
      </Sheet>
    );
  }

  if (step === "who") {
    return (
      <Sheet title="Your details" onClose={onClose} back={() => setStep("when")}>
        <div className="bp-pad">
          <div className="bp-summary"><CalendarCheck size={17} /> {at instanceof Date ? visitWhen(at) : "Any time — call me to fix it"}
            <button type="button" onClick={() => setStep("when")}>Change</button></div>
          <label className="bp-label" htmlFor="bp-name">Your name</label>
          <input id="bp-name" className="bp-input" autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="bp-label" htmlFor="bp-phone">Mobile number</label>
          <div className="bp-phone"><span>+91</span>
            <input id="bp-phone" className="bp-input" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} />
          </div>
          <label className="bp-label" htmlFor="bp-note">Anything we should know? <span>(optional)</span></label>
          <input id="bp-note" className="bp-input" placeholder="e.g. Moving in with family by 1 Nov" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} />
          {err && <div className="bp-err">{err}</div>}
          {user ? (
            <>
              <button type="button" className="bp-btn bp-btn--primary bp-btn--block" disabled={busy} onClick={submit} style={{ marginTop: 16 }}>
                {busy ? (resume ? "Confirming your visit…" : "Sending…") : <><Phone size={17} /> Request visit</>}
              </button>
              <p className="bp-fine">Booking as {user.email || user.name}. No spam — your number goes only to the MovEazy partner arranging this visit.</p>
            </>
          ) : (
            <>
              <button type="button" className="bp-btn bp-btn--google bp-btn--block" disabled={busy} onClick={submit} style={{ marginTop: 16 }}>
                {busy ? "Opening Google…" : <><GoogleG /> Continue with Google to book</>}
              </button>
              <p className="bp-fine">Sign in once so your visit is saved to your account — you can see or change it any time. We bring you straight back here.</p>
            </>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Schedule a visit" onClose={onClose}>
      <div className="bp-pad">
        {avail.length > 0 && (
          <>
            <div className="bp-label">Flats to see <span>{picked.size ? `${picked.size} selected` : "optional — we'll show you what's free"}</span></div>
            <div className="bp-flatchips">
              {avail.map((f) => (
                <button key={f.property_id} type="button" className={picked.has(f.property_id) ? "on" : ""} onClick={() => onToggle(f.property_id)}>
                  {picked.has(f.property_id) && <Check size={13} />}
                  {f.unit_no ? `#${f.unit_no} · ` : ""}{bhk(f)} · {f.unit_no || f.floor_number == null ? "" : f.floor_number === 0 ? "G · " : `F${f.floor_number} · `}{f.rent ? inr(f.rent) : ""}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="bp-label">Pick a day</div>
        <div className="bp-days">
          {days.map((d, i) => {
            const none = visitTimes(d).length === 0;
            return (
              <button key={d.toISOString()} type="button" disabled={none} className={i === dayIdx ? "on" : ""}
                onClick={() => { setDayIdx(i); if (at instanceof Date) setAt(null); }}>
                <small>{dayLabel(d, i)}</small><b>{d.getDate()}</b><small>{d.toLocaleDateString("en-IN", { month: "short" })}</small>
              </button>
            );
          })}
        </div>

        <div className="bp-label">Pick a time <span>the partner confirms it with you</span></div>
        {parts.map(([p, list]) => (
          <div key={p} className="bp-part">
            <small>{p}</small>
            <div className="bp-times">
              {list.map((t) => (
                <button key={t.label} type="button" className={at instanceof Date && at.getTime() === t.at.getTime() ? "on" : ""} onClick={() => setAt(t.at)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className={`bp-anytime${at === "call" ? " on" : ""}`} onClick={() => setAt("call")}>
          <Sparkles size={15} /> Not sure yet — call me to fix a time
        </button>

        <button type="button" className="bp-btn bp-btn--primary bp-btn--block" disabled={!timeChosen} onClick={() => setStep("who")} style={{ marginTop: 16 }}>
          {timeChosen ? (at === "call" ? "Continue" : `Continue · ${visitWhen(at)}`) : "Pick a time to continue"}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Instant visit: who's coming and which flats (none picked: every free flat),
 * Google sign-in, then the person at the property and the address.
 */
function InstantSheet({ code, building, flats, picked, onToggle, onClose, user, loginWithGoogle, resume }) {
  const me = useMemo(readMe, []);
  const [name, setName] = useState(resume?.name || me.name || user?.name || "");
  const [phone, setPhone] = useState(resume?.phone || me.phone || user?.phone || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const avail = flats.filter((f) => f.available);

  const submit = async () => {
    setErr("");
    if (name.trim().length < 2) { setErr("Tell us your name."); return; }
    if (!isMobile(phone)) { setErr("Enter your 10-digit mobile number."); return; }
    if (!user) {
      savePendingVisit({ code, mode: "instant", picked: [...picked], name: name.trim(), phone: cleanMobile(phone) });
      setBusy(true);
      const res = await loginWithGoogle();
      if (res && res.success === false) {
        clearPendingVisit();
        setErr(res.error || "Couldn't open Google sign-in. Please try again.");
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await startInstantVisit(code, { name: name.trim(), phone: cleanMobile(phone), propertyIds: [...picked] });
      saveMe({ name: name.trim(), phone: cleanMobile(phone) });
      setDone(r);
    } catch (e) {
      setErr(e?.message || "Could not start your visit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Back from Google: start it straight away.
  const autoSend = useRef(Boolean(resume));
  useEffect(() => {
    if (!autoSend.current || !user) return;
    autoSend.current = false;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (done) {
    const poc = String(done.poc_phone || "");
    const first = name.trim().split(/\s+/)[0];
    const wa = `https://wa.me/91${poc}?text=${encodeURIComponent(`Hi ${done.poc_name}, I'm ${first}. I'm coming now for an instant visit at ${done.name || building.name} (via MovEazy).`)}`;
    const place = [done.address, done.landmark, done.area].filter(Boolean).join(", ");
    const maps = done.latitude != null && done.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${done.latitude},${done.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place || building.name}, Bengaluru`)}`;
    return (
      <Sheet title="Instant visit" onClose={onClose}>
        <div className="bp-pad bp-done">
          <div className="bp-done-ic bp-done-ic--gold"><Zap size={32} /></div>
          <h4>You're expected!</h4>
          <p className="bp-done-when"><Clock size={16} /> Please reach by {new Date(done.arrive_by).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
          <div className="bp-poc">
            <span className="bp-poc-av">{String(done.poc_name || "?").trim().charAt(0).toUpperCase()}</span>
            <span className="bp-poc-who"><small>Meet at the property</small><b>{done.poc_name}</b><span>{poc.replace(/(\d{5})(\d{5})/, "$1 $2")}</span></span>
          </div>
          <div className="bp-two" style={{ marginTop: 10 }}>
            <a className="bp-btn" href={`tel:+91${poc}`}><Phone size={16} /> Call</a>
            <a className="bp-btn bp-btn--wa" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
          </div>
          {place && <div className="bp-addr"><MapPin size={16} /><span>{place}</span></div>}
          <a className="bp-btn bp-btn--primary bp-btn--block" href={maps} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
            <Navigation size={17} /> Get directions
          </a>
          <p className="bp-fine">Saved to your MovEazy account{user?.email ? ` (${user.email})` : ""} — <Link to="/visits">see your visits</Link>. {done.flats ? `${done.flats} flat${done.flats === 1 ? "" : "s"} to see.` : ""}</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Instant visit" onClose={onClose}>
      <div className="bp-pad">
        <div className="bp-instant-hero">
          <span className="bp-instant-ic"><Zap size={20} /></span>
          <div><b>See it right now</b><span>No appointment needed. Sign in and you'll get the name and number of the person at {building.name}, and the address.</span></div>
        </div>
        {avail.length > 0 && (
          <>
            <div className="bp-label">Flats to see <span>{picked.size ? `${picked.size} selected` : "all free flats"}</span></div>
            <div className="bp-flatchips">
              {avail.map((f) => (
                <button key={f.property_id} type="button" className={picked.has(f.property_id) ? "on" : ""} onClick={() => onToggle(f.property_id)}>
                  {picked.has(f.property_id) && <Check size={13} />}
                  {f.unit_no ? `#${f.unit_no} · ` : ""}{bhk(f)} · {f.rent ? inr(f.rent) : ""}
                </button>
              ))}
            </div>
          </>
        )}
        <label className="bp-label" htmlFor="iv-name">Your name</label>
        <input id="iv-name" className="bp-input" autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="bp-label" htmlFor="iv-phone">Mobile number</label>
        <div className="bp-phone"><span>+91</span>
          <input id="iv-phone" className="bp-input" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} />
        </div>
        {err && <div className="bp-err">{err}</div>}
        {user ? (
          <>
            <button type="button" className="bp-btn bp-btn--gold bp-btn--block" disabled={busy} onClick={submit} style={{ marginTop: 16 }}>
              {busy ? (resume ? "Starting your visit…" : "Starting…") : <><Zap size={17} /> Start instant visit</>}
            </button>
            <p className="bp-fine">Visiting as {user.email || user.name}. Your number goes only to the person showing you around and MovEazy.</p>
          </>
        ) : (
          <>
            <button type="button" className="bp-btn bp-btn--google bp-btn--block" disabled={busy} onClick={submit} style={{ marginTop: 16 }}>
              {busy ? "Opening Google…" : <><GoogleG /> Continue with Google to visit now</>}
            </button>
            <p className="bp-fine">Sign in once so your visit is saved to your account. We bring you straight back here with the contact.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

const CSS = `
.bp { --deep:#063B2D; --em:#0A6B4E; --emt:#E7F2EC; --champ:#D6B77C; --champ2:#F4EBD8; --champ3:#8A6A2F;
  --cream:#F7F4EC; --ink:#17211D; --dim:#5E6B66; --mute:#94A09B; --line:#E6E1D4; --line2:#EFEBE0;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--cream); min-height: 100dvh;
  -webkit-tap-highlight-color: transparent; }
.bp *, .bp *::before, .bp *::after { box-sizing: border-box; }
.bp-top { position: sticky; top: 0; z-index: 20; height: 56px; display: flex; align-items: center; justify-content: center;
  background: rgba(247,244,236,.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--line2); }
.bp-top img { height: 26px !important; width: auto; display: block; }
.bp-col { max-width: 560px; margin: 0 auto; padding: 0 0 calc(110px + env(safe-area-inset-bottom)); }
.bp-gwrap { position: relative; }
.bp-gallery { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; aspect-ratio: 4 / 3; background: #E9E4D6; }
.bp-gallery::-webkit-scrollbar { display: none; }
.bp-gallery > div { flex: 0 0 100%; scroll-snap-align: start; height: 100%; }
.bp-gallery img, .bp-gallery video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bp-gallery--none { display: grid; place-items: center; color: var(--mute); }
.bp-video { aspect-ratio: 4 / 3; background: #000; }
.bp-video video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bp-heroswitch { position: absolute; left: 12px; top: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 99px;
  background: rgba(0,0,0,.6); color: #fff; font: inherit; font-size: 12px; font-weight: 700; padding: 6px 11px; cursor: pointer; }
.bp-occ { text-align: center; color: var(--dim); font-size: 12.5px; margin: 4px 0 0; }
.bp-gcount { position: absolute; right: 12px; top: 12px; background: rgba(0,0,0,.55); color: #fff; font-size: 12px; font-weight: 600;
  border-radius: 99px; padding: 4px 10px; }
.bp-dots { position: absolute; left: 0; right: 0; bottom: 30px; display: flex; gap: 5px; justify-content: center; }
.bp-dots i { width: 6px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.55); transition: width .2s, background .2s; }
.bp-dots i.on { width: 18px; background: #fff; }
.bp-head { background: #fff; margin: -18px 12px 0; position: relative; border-radius: 20px; padding: 18px 16px 16px;
  box-shadow: 0 10px 30px rgba(6,59,45,.10); border: 1px solid var(--line2); }
.bp-verified { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--em); background: var(--emt);
  border-radius: 99px; padding: 4px 10px; }
.bp-head h1 { font-size: 24px; line-height: 1.2; margin: 10px 0 4px; letter-spacing: -0.02em; }
.bp-where { display: flex; align-items: center; gap: 5px; color: var(--dim); font-size: 14px; }
.bp-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.bp-facts > div { background: var(--cream); border-radius: 14px; padding: 10px; min-width: 0; }
.bp-facts b { display: block; font-size: 17px; font-weight: 800; color: var(--deep); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-facts span { font-size: 11.5px; color: var(--dim); }
.bp-amen { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.bp-amen span { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--deep); background: var(--champ2);
  border-radius: 99px; padding: 5px 10px; font-weight: 600; }
.bp-amen svg { color: var(--champ3); }
.bp-desc { color: var(--dim); font-size: 14px; line-height: 1.55; margin: 12px 0 0; white-space: pre-line; }
.bp-flats { padding: 22px 12px 0; }
.bp-flats-top h2 { font-size: 18px; margin: 0; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; }
.bp-flats-top h2 svg { color: var(--em); }
.bp-flats-top > span { display: block; font-size: 12.5px; color: var(--dim); margin: 3px 0 0 26px; }
.bp-floortabs { position: sticky; top: 56px; z-index: 10; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
  padding: 10px 0; margin: 4px 0 0; background: var(--cream); }
.bp-floortabs::-webkit-scrollbar { display: none; }
.bp-floortabs button { flex: none; border: 1px solid var(--line); background: #fff; border-radius: 99px; padding: 7px 14px; font: inherit;
  font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
.bp-floortabs button.on { background: var(--deep); border-color: var(--deep); color: #fff; }
.bp-floor { margin-top: 14px; scroll-margin-top: 110px; }
.bp-floor h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--champ3); margin: 0 4px 8px;
  display: flex; justify-content: space-between; }
.bp-floor h3 span { text-transform: none; letter-spacing: 0; color: var(--dim); font-weight: 500; }
.bp-card { position: relative; background: #fff; border: 1.5px solid var(--line2); border-radius: 16px; margin-bottom: 10px;
  transition: border-color .15s, box-shadow .15s, transform .1s; }
.bp-card--on { border-color: var(--em); box-shadow: 0 0 0 3px var(--emt); }
.bp-card--off { opacity: .62; }
.bp-card-main { display: grid; grid-template-columns: 112px 1fr; gap: 12px; height: 112px; width: 100%; padding: 8px 52px 8px 8px; border: 0;
  background: transparent; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.bp-card-main:active { transform: scale(.99); }
.bp-card-img { position: relative; border-radius: 12px; overflow: hidden; background: #E9E4D6; display: grid; place-items: center; color: var(--mute); height: 96px; }
.bp-card-img img, .bp-card-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bp-tag { position: absolute; left: 6px; top: 6px; background: var(--em); color: #fff; font-size: 10.5px; font-weight: 700; border-radius: 99px; padding: 2px 8px; }
.bp-tag--off { background: #6B7280; }
.bp-card-body { min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.bp-card-title { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-card-title span { font-weight: 500; color: var(--dim); font-size: 13px; }
.bp-card-rent { font-size: 17px; font-weight: 800; color: var(--deep); }
.bp-card-rent small { font-size: 12px; font-weight: 500; color: var(--dim); }
.bp-card-meta { font-size: 12px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-add { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 12px;
  border: 1.5px solid var(--em); background: #fff; color: var(--em); font-size: 22px; font-weight: 500; display: grid; place-items: center;
  cursor: pointer; transition: background .15s, color .15s; line-height: 1; }
.bp-add.on { background: var(--em); color: #fff; }
.bp-note { background: var(--champ2); color: var(--champ3); border-radius: 14px; padding: 12px 14px; font-size: 13.5px; margin-top: 12px; }
.bp-foot { text-align: center; padding: 28px 24px 0; color: var(--dim); font-size: 12.5px; line-height: 1.5; }
.bp-foot img { height: 22px !important; width: auto; opacity: .85; }
.bp-cta { position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; width: 100%; max-width: 560px; z-index: 30;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(247,244,236,0), var(--cream) 30%); }
.bp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 14px; border: 1px solid var(--line);
  background: #fff; color: var(--ink); font: inherit; font-weight: 700; font-size: 15px; padding: 12px 16px; cursor: pointer; text-decoration: none; min-height: 48px; }
.bp-btn:disabled { opacity: .5; cursor: default; }
.bp-btn--primary { background: linear-gradient(180deg, #0D7F5D, #0A6B4E); border-color: var(--em); color: #fff;
  box-shadow: 0 8px 20px rgba(10,107,78,.28); }
.bp-btn--block { width: 100%; min-height: 54px; font-size: 16px; }
.bp-btn--google { background: #fff; border: 1.5px solid #DADCE0; color: #1F1F1F; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.bp-btn--gold { background: linear-gradient(180deg, #E2B866, #B9853A); border-color: #B07D35; color: #2A1D06; box-shadow: 0 8px 20px rgba(176,125,53,.32); }
.bp-btn--wa { background: #25D366; border-color: #1FB457; color: #fff; }
.bp-cta-room { height: 74px; }
.bp-instant { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; margin-bottom: 8px; padding: 9px 10px 9px 9px; cursor: pointer;
  border: 1.5px solid #C9974A; border-radius: 16px; font: inherit; color: #2A1D06;
  background: linear-gradient(135deg, #FFF6E2 0%, #F4DFAF 100%); box-shadow: 0 8px 22px rgba(176,125,53,.25); animation: bpglow 2.4s ease-in-out infinite; }
.bp-instant-ic { width: 38px; height: 38px; border-radius: 12px; flex: none; display: grid; place-items: center; color: #fff;
  background: linear-gradient(135deg, #E2B866, #9C6B2C); }
.bp-instant-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bp-instant-txt b { font-size: 14px; line-height: 1.25; }
.bp-instant-txt small { font-size: 11.5px; color: #7A5A22; margin-top: 1px; }
.bp-instant-go { flex: none; background: #2A1D06; color: #F4DFAF; font-weight: 800; font-size: 12.5px; border-radius: 99px; padding: 7px 11px; }
@keyframes bpglow { 50% { box-shadow: 0 8px 28px rgba(201,151,74,.48); } }
.bp-instant-hero { display: flex; gap: 12px; align-items: flex-start; background: linear-gradient(135deg, #FFF6E2, #F7E8C4); border-radius: 16px;
  padding: 12px; margin-top: 4px; }
.bp-instant-hero b { display: block; font-size: 16px; color: #2A1D06; }
.bp-instant-hero span { display: block; font-size: 13px; color: #6E5220; line-height: 1.45; margin-top: 2px; }
.bp-done-ic--gold { background: radial-gradient(circle at 30% 30%, #E9C27A, #9C6B2C) !important; box-shadow: 0 0 0 10px #F7E8C4 !important; }
.bp-poc { display: flex; align-items: center; gap: 12px; text-align: left; background: var(--cream); border: 1px solid var(--line2); border-radius: 16px;
  padding: 12px; margin-top: 6px; }
.bp-poc-av { width: 44px; height: 44px; border-radius: 99px; flex: none; display: grid; place-items: center; font-weight: 800; font-size: 18px;
  background: var(--deep); color: var(--champ); }
.bp-poc-who { display: flex; flex-direction: column; min-width: 0; }
.bp-poc-who small { font-size: 11.5px; color: var(--dim); font-weight: 600; }
.bp-poc-who b { font-size: 17px; }
.bp-poc-who span { font-size: 14px; color: var(--deep); font-weight: 700; letter-spacing: .02em; }
.bp-addr { display: flex; gap: 8px; align-items: flex-start; text-align: left; font-size: 13.5px; color: var(--ink); line-height: 1.45;
  background: #fff; border: 1px dashed var(--line); border-radius: 14px; padding: 10px 12px; margin-top: 12px; }
.bp-addr svg { flex: none; color: var(--em); margin-top: 2px; }
.bp-fine a { color: var(--em); font-weight: 700; }
.bp-sheet-bg { position: fixed; inset: 0; background: rgba(4,31,23,.5); z-index: 60; display: flex; align-items: flex-end; justify-content: center;
  animation: bpfade .15s ease; }
.bp-sheet { background: #fff; width: 100%; max-width: 560px; border-radius: 24px 24px 0 0; max-height: 92dvh; overflow: auto;
  padding-bottom: calc(16px + env(safe-area-inset-bottom)); animation: bpup .24s cubic-bezier(.2,.8,.2,1); overscroll-behavior: contain; }
.bp-sheet-grab { width: 40px; height: 4px; border-radius: 99px; background: #DCD6C6; margin: 8px auto 0; }
.bp-sheet-head { position: sticky; top: 0; background: #fff; display: flex; align-items: center; gap: 6px; padding: 6px 8px 8px 16px; z-index: 2; }
.bp-sheet-head h3 { flex: 1; margin: 0; font-size: 18px; letter-spacing: -0.01em; }
.bp-icon { width: 40px; height: 40px; border: 0; background: transparent; border-radius: 12px; display: grid; place-items: center; cursor: pointer; color: var(--ink); }
.bp-icon:active { background: var(--emt); }
@keyframes bpup { from { transform: translateY(40px); opacity: .5; } to { transform: none; opacity: 1; } }
@keyframes bpfade { from { opacity: 0; } }
.bp-pad { padding: 4px 16px 8px; }
.bp-sgallery { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 8px; padding: 0 16px 12px; scrollbar-width: none; }
.bp-sgallery::-webkit-scrollbar { display: none; }
.bp-sgallery > div:only-child { flex-basis: 100%; }
.bp-sgallery > div { flex: 0 0 82%; aspect-ratio: 4/3; border-radius: 14px; overflow: hidden; scroll-snap-align: center; background: #E9E4D6; }
.bp-sgallery img, .bp-sgallery video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bp-kv > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line2); font-size: 14px; }
.bp-kv span { color: var(--dim); }
.bp-two { display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; margin-top: 16px; }
.bp-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 14px; font-weight: 700; margin: 16px 0 8px; }
.bp-label span { font-size: 12px; font-weight: 500; color: var(--dim); }
.bp-flatchips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.bp-flatchips::-webkit-scrollbar { display: none; }
.bp-flatchips button { flex: none; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); background: #fff;
  border-radius: 99px; padding: 7px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink); }
.bp-flatchips button.on { background: var(--emt); border-color: var(--em); color: var(--deep); }
.bp-days { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; padding-bottom: 2px; }
.bp-days::-webkit-scrollbar { display: none; }
.bp-days button { flex: none; width: 62px; scroll-snap-align: start; display: flex; flex-direction: column; align-items: center; gap: 1px;
  border: 1.5px solid var(--line); background: #fff; border-radius: 16px; padding: 8px 0; font: inherit; cursor: pointer; color: var(--ink);
  transition: background .15s, border-color .15s, transform .1s; }
.bp-days button:active { transform: scale(.96); }
.bp-days button b { font-size: 20px; line-height: 1.15; }
.bp-days button small { font-size: 11px; color: var(--dim); font-weight: 600; }
.bp-days button.on { background: var(--deep); border-color: var(--deep); color: #fff; }
.bp-days button.on small { color: var(--champ); }
.bp-days button:disabled { opacity: .35; cursor: default; }
.bp-part { margin-top: 8px; }
.bp-part > small { display: block; font-size: 11.5px; font-weight: 700; color: var(--mute); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.bp-times { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.bp-times button { border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 9px 0; font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; color: var(--ink); transition: background .12s, border-color .12s; }
.bp-times button.on { background: var(--em); border-color: var(--em); color: #fff; }
.bp-anytime { margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1.5px dashed var(--champ);
  background: var(--champ2); color: var(--champ3); border-radius: 14px; padding: 11px; font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; }
.bp-anytime.on { border-style: solid; border-color: var(--champ3); box-shadow: 0 0 0 3px rgba(214,183,124,.35); }
.bp-summary { display: flex; align-items: center; gap: 8px; background: var(--emt); color: var(--deep); border-radius: 14px; padding: 11px 12px;
  font-size: 14px; font-weight: 700; margin-top: 4px; }
.bp-summary button { margin-left: auto; border: 0; background: transparent; color: var(--em); font: inherit; font-weight: 700; cursor: pointer; }
.bp-input { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 12px; font: inherit; font-size: 16px; padding: 13px; color: var(--ink); outline: none; }
.bp-input:focus { border-color: var(--em); box-shadow: 0 0 0 3px var(--emt); }
.bp-phone { display: flex; align-items: stretch; gap: 8px; }
.bp-phone > span { display: grid; place-items: center; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; font-weight: 700; color: var(--dim); background: var(--cream); }
.bp-err { color: #B42318; font-size: 13px; margin-top: 10px; }
.bp-fine { font-size: 12px; color: var(--mute); text-align: center; margin: 10px 0 0; }
.bp-done { text-align: center; padding-top: 8px; }
.bp-done-ic { width: 76px; height: 76px; border-radius: 999px; margin: 6px auto 12px; display: grid; place-items: center; color: #fff;
  background: radial-gradient(circle at 30% 30%, #12936B, #063B2D); box-shadow: 0 0 0 10px var(--emt); animation: bppop .4s cubic-bezier(.2,1.4,.4,1); }
@keyframes bppop { from { transform: scale(.4); opacity: 0; } }
.bp-done h4 { font-size: 21px; margin: 6px 0 6px; }
.bp-done p { color: var(--dim); font-size: 14px; line-height: 1.55; margin: 0 0 10px; }
.bp-done-when { display: inline-flex; align-items: center; gap: 6px; background: var(--champ2); color: var(--champ3) !important; font-weight: 700;
  border-radius: 99px; padding: 6px 12px; }
.bp-done-what { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--deep); margin: 4px 0 16px; font-weight: 600; }
.bp-empty { text-align: center; padding: 70px 28px; color: var(--dim); }
.bp-empty svg { color: var(--em); }
.bp-empty h1 { color: var(--ink); font-size: 21px; margin: 12px 0 6px; }
.bp-empty p { font-size: 14px; line-height: 1.55; margin: 0 0 18px; }
.bp-skel { padding: 0 0 20px; }
.bp-skel i { display: block; aspect-ratio: 4/3; background: linear-gradient(90deg, #ECE7DA, #F4F0E6, #ECE7DA); background-size: 200% 100%; animation: bpsh 1.2s infinite; }
.bp-skel b { display: block; height: 96px; margin: 12px; border-radius: 16px; background: linear-gradient(90deg, #ECE7DA, #F4F0E6, #ECE7DA);
  background-size: 200% 100%; animation: bpsh 1.2s infinite; }
@keyframes bpsh { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .bp-sheet, .bp-sheet-bg, .bp-done-ic, .bp-instant { animation: none; } }
`;
