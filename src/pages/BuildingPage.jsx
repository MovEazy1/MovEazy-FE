/**
 * A property's page — moveazy.co.in/building/<code>, what its QR poster opens.
 *
 * The building's photos, then every flat floor by floor as the same small
 * card, and one button: Call Caretaker. The tenant gives their mobile (the
 * site's usual gate, not verified), and gets the building's caretaker — who
 * can show the flats right away — and its property manager, MovEazy's team
 * number where the CRM hasn't set one. Back from the call, they say how it
 * went; "call not picked" offers the manager at once (building_call_desk.sql).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowUpDown, BadgeCheck, Building2, Check, ChevronLeft, Film, Images, Layers, MapPin, MessageCircle, Phone, X, Zap } from "lucide-react";
import { MediaItem, listingCover, listingMedia } from "./partners/partnerMedia";
import { useSnapTrack } from "../hooks/useSnapTrack";
import { usePhotoViewer } from "../hooks/usePhotoViewer";
import { inr } from "../lib/partners";
import {
  CALL_FEEDBACK, FLAT_SORTS, buildingCallDesk, fetchBuildingPage, flatsByFloor, floorLabel, recordBuildingView, shortInr, sortFlats,
} from "../lib/buildings";
import { leadSnapshot } from "../lib/leadIntake";
import RequirePhoneFirst from "../components/RequirePhoneFirst";
import logo from "../assets/logo/moveazy-logo-mint-light.png";

// A call just made from this page: when the tenant comes back, ask how it went.
const CALLED_KEY = "mz_building_called";
function readCalled(code) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CALLED_KEY) || "null");
    return c && c.code === code && Date.now() - (c.at || 0) < 2 * 60 * 60 * 1000 ? c : null;
  } catch { return null; }
}
function saveCalled(c) {
  try { if (c) sessionStorage.setItem(CALLED_KEY, JSON.stringify(c)); else sessionStorage.removeItem(CALLED_KEY); } catch { /* private tab */ }
}

const bhk = (f) => f.flat_type || (f.bedrooms ? `${f.bedrooms} BHK` : "Flat");
/** "Flat 302 · 2 BHK" when MovEazy set a house number, else "2 BHK". */
const flatName = (f) => (f.unit_no ? `Flat ${f.unit_no} · ${bhk(f)}` : bhk(f));

export default function BuildingPage() {
  const { code: raw = "" } = useParams();
  const code = raw.toUpperCase();
  const [params] = useSearchParams();
  const [b, setB] = useState(undefined); // undefined loading · null not found
  const [open, setOpen] = useState(null); // a flat, in the detail sheet
  // The Call Caretaker sheet; open again on the feedback when a call was just made.
  const [calling, setCalling] = useState(() => Boolean(readCalled(code)));
  const [floorOn, setFloorOn] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const counted = useRef(false);
  const { user } = useAuth();

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
  const shown = useMemo(() => sortFlats(floorOn === "all" ? available : available.filter((f) => String(f.floor_number ?? "null") === floorOn), sortBy),
    [available, floorOn, sortBy]);
  // The building's own count, booked flats included, when the CRM has set one.
  const total = Math.max(Number(b?.total_flats) || 0, flats.length);
  const occupied = total - available.length;
  const photos = useMemo(() => {
    const own = (b?.photos ?? []).filter(Boolean);
    return own.length ? own : flats.flatMap((f) => listingMedia(f)).slice(0, 8);
  }, [b, flats]);
  const rents = available.map((f) => Number(f.rent) || 0).filter(Boolean);

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
          <div><b>{available.length}</b><span>of {total} flat{total === 1 ? "" : "s"} available</span></div>
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
          <div className="bp-flats-row">
            <h2><Layers size={18} /> Available flats · {available.length}</h2>
            {available.length > 1 && (
              <label className="bp-sort">
                <ArrowUpDown size={14} aria-hidden />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort flats">
                  {FLAT_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}
          </div>
          <span>Tap a flat for photos and details — call the caretaker to see any of them</span>
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
            <FlatCard key={f.property_id} flat={f} onOpen={() => setOpen(f)} />
          ))}
        </div>
        {occupied > 0 && <div className="bp-occ">{occupied} more flat{occupied === 1 ? " is" : "s are"} already booked</div>}
      </section>

      <footer className="bp-foot">
        <img src={logo} alt="MovEazy" />
        <p>Verified homes, visits arranged by a MovEazy partner. Your number is only used to set up your visit.</p>
      </footer>

      <div className="bp-cta">
        <button type="button" className="bp-btn bp-btn--primary bp-btn--block" onClick={() => setCalling(true)}>
          <Phone size={19} /> Call Caretaker
        </button>
      </div>

      {open && <FlatSheet flat={open} onClose={() => setOpen(null)} onCall={() => { setOpen(null); setCalling(true); }} />}
      {calling && <CallSheet code={code} building={b} user={user} onClose={() => setCalling(false)} />}
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
          <div key={src + k} style={{ cursor: "zoom-in" }} onClick={() => full.open(k)}><MediaItem src={src} alt={k === 0 ? name : ""} priority={k === 0} /></div>
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

function FlatCard({ flat, onOpen }) {
  const first = listingCover(flat);
  return (
    <div className={`bp-card${flat.available ? "" : " bp-card--off"}`}>
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
              Number(flat.maintenance) > 0 ? `${inr(flat.maintenance)} maintenance` : "",
              flat.deposit ? `${shortInr(flat.deposit)} deposit` : ""].filter(Boolean).join(" · ") || "Details on visit"}
          </div>
        </div>
      </button>
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

function FlatSheet({ flat, onClose, onCall }) {
  const media = useMemo(() => listingMedia(flat), [flat]);
  const full = usePhotoViewer(media, flatName(flat));
  const rows = [
    ["Floor", floorLabel(flat.floor_number)],
    ["Rent", flat.rent ? `${inr(flat.rent)} / month` : "On request"],
    ["Deposit", flat.deposit ? inr(flat.deposit) : "—"],
    ["Furnishing", flat.furnishing || "—"],
    ["Maintenance", Number(flat.maintenance) > 0 ? `${inr(flat.maintenance)} / month` : "—"],
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
          <button type="button" className="bp-btn bp-btn--primary bp-btn--block" style={{ marginTop: 14 }} onClick={onCall}>
            <Phone size={17} /> Call Caretaker to see it
          </button>
        ) : <div className="bp-note">This flat is booked. Call the caretaker to see the others.</div>}
      </div>
    </Sheet>
  );
}

/**
 * Call Caretaker: the tenant's mobile (asked once, on this phone), then the
 * building's caretaker and property manager to call. Back from a call, how it
 * went — "call not picked" puts the manager one tap away, "pay token" calls
 * them to arrange it, and the rest is noted for MovEazy and the owner.
 */
function CallSheet({ code, building, user, onClose }) {
  const name = String(user?.name || leadSnapshot().name || "").trim();
  const [phone, setPhone] = useState(() => String(user?.phone || leadSnapshot().phone || "").replace(/\D/g, "").slice(-10));
  const [contacts, setContacts] = useState(null);
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  // "contacts", or the feedback after a call; `called` is who they called.
  const [called, setCalled] = useState(() => readCalled(code));
  const [view, setView] = useState(() => (readCalled(code) ? "feedback" : "contacts"));
  const [picked, setPicked] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState("");
  const leftAt = useRef(0);

  const send = useCallback((kind, extra = {}) => buildingCallDesk(code, { phone, name, kind, ...extra }), [code, phone, name]);

  useEffect(() => {
    if (!phone || contacts) return;
    let live = true;
    send("contacts").then((c) => live && setContacts(c), (e) => live && setErr(e?.message || "Couldn't load the numbers. Please try again."));
    return () => { live = false; };
  }, [phone, contacts, send, tries]);

  // Back on the page after the phone app: how did it go?
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && leftAt.current && Date.now() - leftAt.current > 1500) {
        leftAt.current = 0;
        setView("feedback");
      }
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, []);

  const call = (target) => {
    const c = { code, target, at: Date.now() };
    saveCalled(c);
    setCalled(c);
    leftAt.current = Date.now();
    send("call", { target }).catch(() => {});
  };
  const close = () => { saveCalled(null); onClose(); };

  const say = async (fb) => {
    setPicked(fb);
    if (fb === "issues" || fb === "other") return; // they write it first
    send("feedback", { feedback: fb }).catch(() => {});
    setSent(fb);
    saveCalled(null);
  };
  const sendNote = () => {
    send("feedback", { feedback: picked, note }).catch(() => {});
    setSent(picked);
    saveCalled(null);
  };

  if (!phone) {
    return (
      <RequirePhoneFirst open onClose={onClose} onDone={(mobile) => setPhone(String(mobile || "").slice(-10))} />
    );
  }

  const manager = contacts?.manager;
  const caretaker = contacts?.caretaker;
  const fmt = (p) => String(p || "").replace(/(\d{5})(\d{5})/, "$1 $2");
  const managerCall = manager && (
    <a className="bp-call" href={`tel:+91${manager.phone}`} onClick={() => call("manager")}>
      <span className="bp-call-av"><Phone size={20} /></span>
      <span className="bp-call-who"><small>Property Manager</small><b>{manager.name || "MovEazy team"}</b><span>{fmt(manager.phone)}</span></span>
      <span className="bp-call-go"><Phone size={15} /> Call</span>
    </a>
  );

  if (view === "feedback") {
    const toManager = sent === "call_not_picked" || sent === "pay_token";
    return (
      <Sheet title="How did it go?" onClose={close} back={contacts ? () => { setView("contacts"); setSent(""); setPicked(""); } : undefined}>
        <div className="bp-pad">
          {sent ? (
            <>
              <p className="bp-fine" style={{ textAlign: "left", marginTop: 0 }}>
                {sent === "call_not_picked" ? "Sorry about that — the property manager will help you right away."
                  : sent === "pay_token" ? "Call the property manager to pay the token and hold the flat."
                    : "Thanks — we've noted it, and the MovEazy team will follow up."}
              </p>
              {toManager && managerCall}
              {toManager && manager && (
                <a className="bp-btn bp-btn--block" style={{ marginTop: 10 }} target="_blank" rel="noreferrer"
                  href={`https://wa.me/91${manager.phone}?text=${encodeURIComponent(`Hi, I'd like to ${sent === "pay_token" ? "pay the token for a flat" : "see the flats"} at ${building.name} (via MovEazy).`)}`}>
                  <MessageCircle size={16} /> WhatsApp the property manager
                </a>
              )}
              <button type="button" className="bp-btn bp-btn--block" style={{ marginTop: 10 }} onClick={close}>Done</button>
            </>
          ) : (
            <>
              <p className="bp-fine" style={{ textAlign: "left", marginTop: 0 }}>
                {called?.target === "manager" ? "Your call with the property manager" : "Your call with the caretaker"} — tell us how it went.
              </p>
              <div className="bp-fb">
                {CALL_FEEDBACK.map((f) => (
                  <button key={f.id} type="button" className={`${f.id === "pay_token" ? "bp-fb-token" : ""}${picked === f.id ? " on" : ""}`}
                    onClick={() => say(f.id)}>{f.label}</button>
                ))}
              </div>
              {(picked === "issues" || picked === "other") && (
                <>
                  <label className="bp-label" htmlFor="cd-note">{picked === "issues" ? "What's the issue?" : "Tell us more"}</label>
                  <textarea id="cd-note" className="bp-input" rows={3} maxLength={1000} value={note} autoFocus
                    placeholder="A line or two is enough" onChange={(e) => setNote(e.target.value)} />
                  <button type="button" className="bp-btn bp-btn--primary bp-btn--block" style={{ marginTop: 10 }} disabled={!note.trim()} onClick={sendNote}>
                    Send
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Call Caretaker" onClose={close}>
      <div className="bp-pad">
        {!contacts ? (
          err ? (
            <>
              <div className="bp-err">{err}</div>
              <button type="button" className="bp-btn bp-btn--block" style={{ marginTop: 10 }} onClick={() => { setErr(""); setTries((t) => t + 1); }}>Try again</button>
            </>
          ) : <div className="bp-note">Getting the numbers…</div>
        ) : (
          <>
            <p className="bp-fine" style={{ textAlign: "left", marginTop: 0 }}>
              Call to see the flats at {building.name}. The caretaker can show you around — often right away.
            </p>
            <a className="bp-call bp-call--care" href={`tel:+91${caretaker.phone}`} onClick={() => call("caretaker")}>
              <span className="bp-call-tag"><Zap size={11} /> Instant Visit</span>
              <span className="bp-call-av"><Phone size={20} /></span>
              <span className="bp-call-who"><small>Caretaker</small><b>{caretaker.name || "MovEazy team"}</b><span>{fmt(caretaker.phone)}</span></span>
              <span className="bp-call-go"><Phone size={15} /> Call</span>
            </a>
            {managerCall}
            {called && (
              <button type="button" className="bp-btn bp-btn--block" style={{ marginTop: 14 }} onClick={() => setView("feedback")}>
                How did the call go?
              </button>
            )}
            <p className="bp-fine">Calling from +91 {fmt(phone)}. Your number goes only to MovEazy and the people showing the flats.</p>
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
.bp-call { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; text-decoration: none; color: var(--ink);
  background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-top: 12px; }
.bp-call--care { border-color: #E2C68F; background: linear-gradient(180deg, #FFFCF4, #fff); padding-top: 18px; }
.bp-call-av { width: 44px; height: 44px; border-radius: 99px; flex: none; display: grid; place-items: center; background: var(--emt); color: var(--em); }
.bp-call--care .bp-call-av { background: var(--champ2); color: var(--champ3); }
.bp-call-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.bp-call-who small { font-size: 11px; color: var(--dim); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.bp-call-who b { font-size: 16px; }
.bp-call-who span { font-size: 13.5px; color: var(--deep); font-weight: 700; letter-spacing: .02em; }
.bp-call-go { flex: none; display: inline-flex; align-items: center; gap: 6px; background: var(--em); color: #fff; border-radius: 12px; padding: 9px 13px;
  font-weight: 800; font-size: 13.5px; }
.bp-call-tag { position: absolute; top: -10px; left: 14px; display: inline-flex; align-items: center; gap: 4px; border-radius: 99px; padding: 3px 9px;
  font-size: 11px; font-weight: 800; letter-spacing: .02em; color: #2A1D06; background: linear-gradient(180deg, #E9C27A, #C39245);
  box-shadow: 0 3px 10px rgba(176,125,53,.35); }
.bp-fb { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.bp-fb button { border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 12px 10px; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--ink); cursor: pointer; text-align: left; }
.bp-fb button.on { border-color: var(--em); background: var(--emt); color: var(--deep); }
.bp-fb button.bp-fb-token { grid-column: 1 / -1; background: linear-gradient(180deg, #E2B866, #B9853A); border-color: #B07D35; color: #2A1D06; }
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
.bp-flats-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.bp-sort { position: relative; display: inline-flex; align-items: center; color: var(--deep); }
.bp-sort svg { position: absolute; left: 10px; pointer-events: none; }
.bp-sort select { appearance: none; -webkit-appearance: none; border: 1px solid var(--line); background: #fff; border-radius: 99px;
  padding: 7px 12px 7px 29px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; }
.bp-sort select:focus-visible { outline: 2px solid var(--em); outline-offset: 2px; }
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
