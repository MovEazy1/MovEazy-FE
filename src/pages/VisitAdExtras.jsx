/**
 * The parts of an ad / WhatsApp page (pages/VisitAdPage.jsx) beyond the
 * button: a building's available flats as cards, a flat's photos and details,
 * and — once a visit is booked — the visit with its call desk: from the
 * visit's start until that day ends, the caretaker (Instant Visit) and the
 * property manager, a tap to call, and "How did it go?" on coming back
 * (visit_ad_desk in visit_ad_pages.sql keeps every tap and answer).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarClock, ChevronRight, Phone, UserRound, Zap } from "lucide-react";
import { MediaItem, listingCover, listingMedia } from "./partners/partnerMedia";
import { useSnapTrack } from "../hooks/useSnapTrack";
import { CALL_FEEDBACK, floorLabel } from "../lib/buildings";
import { recordFlatView } from "../lib/flatInsights";
import { adDesk, dayLabel, recordAdEvent, slotLabel } from "../lib/visitAds";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const short = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return inr(v);
};
export const flatName = (f) => [f.unit_no ? `Flat ${f.unit_no}` : "", f.flat_type].filter(Boolean).join(" · ") || f.title || "Flat";

/** A building's free flats as cards; tap one for its photos and details. */
export function AvailableFlats({ flats, code, utm, onSchedule, Sheet }) {
  const [open, setOpen] = useState(null);
  if (!flats.length) return null;
  return (
    <section className="va-card">
      <h2>Available flats · {flats.length}</h2>
      <div className="va-flats">
        {flats.map((f) => {
          const cover = listingCover(f);
          return (
            <button key={f.property_id} type="button" className="va-flat" onClick={() => setOpen(f)}>
              <span className="va-flat-img">{cover ? <MediaItem src={cover} alt="" thumb /> : <Building2 size={24} />}</span>
              <span className="va-flat-body">
                <b>{flatName(f)}</b>
                <span className="va-flat-rent">{f.rent ? inr(f.rent) : "Rent on request"}<small> / mo</small></span>
                <span className="va-flat-meta">
                  {[Number(f.maintenance) > 0 ? `${inr(f.maintenance)} maintenance` : "", f.furnishing, f.floor_number != null ? floorLabel(f.floor_number) : ""]
                    .filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight size={18} className="va-flat-go" />
            </button>
          );
        })}
      </div>
      {open && (
        <FlatSheet flat={open} code={code} utm={utm} Sheet={Sheet} onClose={() => setOpen(null)}
          onSchedule={() => { setOpen(null); onSchedule(); }} />
      )}
    </section>
  );
}

/** One flat: photos and details, and Schedule a visit. The time it was open is kept. */
function FlatSheet({ flat, code, utm, Sheet, onClose, onSchedule }) {
  const photos = useMemo(() => listingMedia(flat), [flat]);
  const { index: i, trackProps } = useSnapTrack();
  const since = useRef(0);
  useEffect(() => {
    recordFlatView(flat.property_id, "link");
    since.current = Date.now();
    return () => { recordAdEvent("building", code, "flat_open", { property: flat.property_id, seconds: (Date.now() - since.current) / 1000, utm }); };
  }, [flat.property_id, code, utm]);
  const facts = [
    flat.deposit ? ["Deposit", short(flat.deposit)] : null,
    Number(flat.maintenance) > 0 ? ["Maintenance", inr(flat.maintenance)] : null,
    flat.furnishing ? ["Furnishing", flat.furnishing] : null,
    flat.floor_number != null ? ["Floor", floorLabel(flat.floor_number)] : null,
    flat.area_sqft ? ["Size", `${flat.area_sqft} sq ft`] : null,
    flat.bathrooms ? ["Bathrooms", flat.bathrooms] : null,
  ].filter(Boolean);
  return (
    <Sheet title={flatName(flat)} onClose={onClose}>
      {photos.length > 0 && (
        <div className="va-gwrap">
          <div className="va-gallery" {...trackProps}>
            {photos.map((src, k) => <div key={src + k}><MediaItem src={src} alt={k === 0 ? flatName(flat) : ""} priority={k === 0} /></div>)}
          </div>
          {photos.length > 1 && <span className="va-gcount">{i + 1} / {photos.length}</span>}
        </div>
      )}
      <div className="va-pad">
        <div className="va-rent" style={{ marginTop: 0 }}>{flat.rent ? <><b>{inr(flat.rent)}</b><small> / month</small></> : <b>Rent on request</b>}</div>
        <div className="va-sheetfacts">
          {facts.map(([k, v]) => <span key={k}><small>{k}</small><b>{v}</b></span>)}
        </div>
        {(flat.amenities ?? []).length > 0 && (
          <div className="va-chips" style={{ marginTop: 12 }}>{flat.amenities.slice(0, 10).map((a) => <span key={a}>{a}</span>)}</div>
        )}
        <button type="button" className="va-btn" style={{ marginTop: 16 }} onClick={onSchedule}>Schedule a visit</button>
      </div>
    </Sheet>
  );
}

const calledKey = (id) => `mz_ad_called:${id}`;

/**
 * The visit they booked on this phone. Until its start: when the call
 * options open. From then till the day ends: the caretaker and the property
 * manager to call; back from a call, how it went. After: nothing.
 */
export function VisitCallCard({ booking }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const opens = new Date(booking.slot_at).getTime();
  const closes = new Date(booking.calls_until).getTime();
  const open = now >= opens && now < closes;
  const [desk, setDesk] = useState(null);
  const [ask, setAsk] = useState(false);
  const [picked, setPicked] = useState("");
  const [note, setNote] = useState("");
  const [said, setSaid] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || desk) return;
    adDesk(booking).then((d) => { if (d?.open) setDesk(d); }, (e) => setErr(e?.message || ""));
  }, [open, desk, booking]);

  // Back from a call made here: ask how it went.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const c = JSON.parse(sessionStorage.getItem(calledKey(booking.id)) || "null");
        if (c && Date.now() - c.at > 3000) { setAsk(true); sessionStorage.removeItem(calledKey(booking.id)); }
      } catch { /* fine */ }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [booking.id]);

  if (now >= closes) return null;
  const day = new Date(booking.slot_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const startsAt = new Date(booking.slot_at).toLocaleTimeString("en-IN", { hour: "numeric", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();

  const call = (target) => {
    try { sessionStorage.setItem(calledKey(booking.id), JSON.stringify({ target, at: Date.now() })); } catch { /* fine */ }
    adDesk(booking, { kind: "call", target }).catch(() => {});
  };
  const send = async (feedback, text = "") => {
    setErr("");
    try {
      await adDesk(booking, { kind: "feedback", feedback, note: text });
      setSaid(feedback);
      setAsk(false);
    } catch (e) {
      setErr(e?.message || "Couldn't save. Please try again.");
    }
  };
  const pick = (id) => {
    setPicked(id);
    if (id !== "issues" && id !== "other") send(id);
  };
  const manager = desk?.manager;

  return (
    <section className="va-visit">
      <div className="va-visit-head">
        <CalendarClock size={18} />
        <span><small>Your visit</small><b>{dayLabel(day)}, {slotLabel(booking.slot_at)}</b></span>
      </div>
      {!open && <p className="va-visit-note">From {startsAt} {dayLabel(day) === "Today" ? "today" : `on ${dayLabel(day)}`}, you can call the caretaker right here — they&apos;ll show you the flat.</p>}
      {open && !desk && !err && <p className="va-visit-note">Getting the caretaker&apos;s number…</p>}
      {err && <p className="va-visit-note">{err}</p>}
      {open && desk && !ask && (
        <>
          {desk.caretaker && (
            <a className="va-call va-call--care" href={`tel:+91${desk.caretaker.phone}`} onClick={() => call("caretaker")}>
              <span className="va-call-tag"><Zap size={11} /> Instant Visit</span>
              <span className="va-call-av"><UserRound size={20} /></span>
              <span className="va-call-who"><small>Caretaker</small><b>{desk.caretaker.name || "Caretaker"}</b><span>{desk.caretaker.phone}</span></span>
              <span className="va-call-go"><Phone size={15} /> Call</span>
            </a>
          )}
          <a className="va-call" href={`tel:+91${manager.phone}`} onClick={() => call("manager")}>
            <span className="va-call-av"><UserRound size={20} /></span>
            <span className="va-call-who"><small>Property manager</small><b>{manager.name || "MovEazy"}</b><span>{manager.phone}</span></span>
            <span className="va-call-go"><Phone size={15} /> Call</span>
          </a>
          {said && (
            <p className="va-visit-note">
              Thanks — noted. {said === "call_not_picked" || said === "pay_token" ? "" : "MovEazy will be in touch."}
            </p>
          )}
          {(said === "call_not_picked" || said === "pay_token") && (
            <a className="va-btn" href={`tel:+91${manager.phone}`} onClick={() => call("manager")} style={{ marginTop: 8 }}>
              <Phone size={17} /> {said === "pay_token" ? "Call the property manager to pay the token" : "Call the property manager now"}
            </a>
          )}
        </>
      )}
      {open && desk && ask && (
        <div>
          <p className="va-visit-q">How did it go?</p>
          <div className="va-fb">
            {CALL_FEEDBACK.map((f) => (
              <button key={f.id} type="button" className={`${picked === f.id ? "on" : ""}${f.id === "pay_token" ? " va-fb-token" : ""}`} onClick={() => pick(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {(picked === "issues" || picked === "other") && (
            <div style={{ marginTop: 10 }}>
              <textarea className="va-input" rows={3} maxLength={1000} placeholder="Tell us what's wrong" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="button" className="va-btn" disabled={note.trim().length < 2} onClick={() => send(picked, note.trim())}>Save</button>
            </div>
          )}
          <button type="button" className="va-link" onClick={() => setAsk(false)}>Skip</button>
        </div>
      )}
    </section>
  );
}

export const EXTRA_CSS = `
.va-flats { display: grid; gap: 8px; }
.va-flat { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 1px solid var(--line); background: #fff; border-radius: 14px;
  padding: 8px; font: inherit; color: var(--ink); cursor: pointer; }
.va-flat-img { flex: none; width: 84px; height: 72px; border-radius: 10px; overflow: hidden; background: #E9E4D6; display: grid; place-items: center; color: var(--mute); }
.va-flat-img img, .va-flat-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.va-flat-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.va-flat-body b { font-size: 14.5px; }
.va-flat-rent { font-size: 15px; font-weight: 800; color: var(--deep); }
.va-flat-rent small { font-size: 11.5px; color: var(--dim); font-weight: 600; }
.va-flat-meta { font-size: 12px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.va-flat-go { flex: none; color: var(--mute); }
.va-sheetfacts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
.va-sheetfacts span { display: flex; flex-direction: column; gap: 2px; background: #fff; border: 1px solid var(--line2); border-radius: 12px; padding: 9px 11px; }
.va-sheetfacts small { font-size: 11.5px; color: var(--dim); font-weight: 600; }
.va-sheetfacts b { font-size: 14.5px; }
.va-visit { background: #fff; margin: 12px; border-radius: 18px; padding: 14px 16px; border: 1.5px solid var(--em); box-shadow: 0 8px 22px rgba(10,107,78,.12); }
.va-visit-head { display: flex; align-items: center; gap: 10px; color: var(--em); }
.va-visit-head span { display: flex; flex-direction: column; }
.va-visit-head small { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
.va-visit-head b { font-size: 16px; color: var(--deep); }
.va-visit-note { font-size: 13.5px; color: var(--ink); line-height: 1.5; margin: 10px 0 0; }
.va-visit-q { font-size: 15px; font-weight: 800; margin: 12px 0 0; }
.va-call { position: relative; display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink); background: #fff; border: 1px solid var(--line);
  border-radius: 16px; padding: 14px; margin-top: 12px; }
.va-call--care { border-color: #E2C68F; background: linear-gradient(180deg, #FFFCF4, #fff); padding-top: 18px; margin-top: 18px; }
.va-call-av { width: 44px; height: 44px; border-radius: 99px; flex: none; display: grid; place-items: center; background: var(--emt); color: var(--em); }
.va-call--care .va-call-av { background: var(--champ2); color: var(--champ3); }
.va-call-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.va-call-who small { font-size: 11px; color: var(--dim); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.va-call-who b { font-size: 16px; }
.va-call-who span { font-size: 13.5px; color: var(--deep); font-weight: 700; letter-spacing: .02em; }
.va-call-go { flex: none; display: inline-flex; align-items: center; gap: 6px; background: var(--em); color: #fff; border-radius: 12px; padding: 9px 13px; font-weight: 800; font-size: 13.5px; }
.va-call-tag { position: absolute; top: -10px; left: 14px; display: inline-flex; align-items: center; gap: 4px; border-radius: 99px; padding: 3px 9px;
  font-size: 11px; font-weight: 800; color: #2A1D06; background: linear-gradient(180deg, #E9C27A, #C39245); box-shadow: 0 3px 10px rgba(176,125,53,.35); }
.va-fb { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.va-fb button { border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 12px 10px; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--ink); cursor: pointer; text-align: left; }
.va-fb button.on { border-color: var(--em); background: var(--emt); color: var(--deep); }
.va-fb button.va-fb-token { grid-column: 1 / -1; background: linear-gradient(180deg, #E2B866, #B9853A); border-color: #B07D35; color: #2A1D06; }
`;
