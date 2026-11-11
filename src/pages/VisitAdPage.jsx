/**
 * A Meta ad's landing page — moveazy.co.in/visit/<property id> and
 * /visit/b/<building code> (lib/visitAds.js, visit_ad_pages.sql).
 *
 * The photos, the key details, and one button: Schedule a visit. Nothing else
 * to tap away to. The tenant gives their mobile (the site's usual gate, not
 * verified), picks a day and an hour — the team's times, else every day
 * 10 am – 6 pm — adds their name if they like, and gets a confirmation with
 * a Google Calendar link. Booking again with the same number moves the visit.
 * The page never says a flat is rented: every visit is a lead.
 *
 * The same page is a building's WhatsApp share (?utm_source=whatsapp). A
 * building's page lists its available flats as cards (VisitAdExtras.jsx).
 * Once booked, this phone sees its visit at the top and, from the visit's
 * start until that day ends, the caretaker and property manager to call —
 * every open, flat, call and answer kept with where they came from.
 *
 * Top right, Explore more: the same mobile gate, then the find-a-home flow
 * (/tenant) for anyone this flat or building isn't right for.
 *
 * Meta pixel, so ads can optimise on any step (lib/metaPixel.js):
 *   ScheduleVisitClick  (custom) the Schedule a visit button
 *   ExploreMoreClick    (custom) the Explore more button
 *   PhoneSubmitted      (custom) a mobile given here, with which button asked
 *   Lead                the first mobile from this browser (RequirePhoneFirst → saveLead)
 *   Schedule            a visit booked (bookAdVisit)
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Bath, BedDouble, Building2, CalendarCheck, CalendarPlus, Check, ChevronLeft, Compass, MapPin, Phone, Ruler, Sofa, X } from "lucide-react";
import { MediaItem, listingMedia } from "./partners/partnerMedia";
import { useSnapTrack } from "../hooks/useSnapTrack";
import { usePhotoViewer } from "../hooks/usePhotoViewer";
import useViewEngagement from "../hooks/useViewEngagement";
import RequirePhoneFirst from "../components/RequirePhoneFirst";
import { leadSnapshot } from "../lib/leadIntake";
import { recordFlatView } from "../lib/flatInsights";
import { recordBuildingView } from "../lib/buildings";
import { trackPixel } from "../lib/metaPixel";
import { dropPrerender } from "../lib/prerender";
import { adSlots, bookAdVisit, calendarLink, dayLabel, fetchAdPage, readAdBooking, readAdUtm, recordAdEvent, slotLabel, slotsByDay } from "../lib/visitAds";
import { AvailableFlats, EXTRA_CSS, VisitCallCard } from "./VisitAdExtras";
// From public/, at a fixed address: the page drawn before the app (api/_adPrepaint.js) shows the same file.
const logo = "/moveazy-logo-mint-light.png";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const short = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return inr(v);
};

/** A building's code (H33PSH) rather than a property id (MZ-…): /visit/<code> was the building ad page first. */
const isBuildingCode = (s) => /^[A-HJ-NP-Z2-9]{6}$/.test(s);

export default function VisitAdPage({ kind: asked = "flat" }) {
  const { id, code } = useParams();
  const raw = String(asked === "building" ? code : id || "").trim().toUpperCase();
  const kind = asked === "flat" && isBuildingCode(raw) ? "building" : asked;
  const ref = raw;
  const [page, setPage] = useState(undefined);
  const [step, setStep] = useState(null); // null | phone | slot | done
  const [gateFor, setGateFor] = useState("schedule"); // which button asked for the mobile
  const navigate = useNavigate();
  const [done, setDone] = useState(null);
  const [booking, setBooking] = useState(() => readAdBooking(kind, ref));
  const { search } = useLocation();
  const utm = useMemo(() => readAdUtm(search), [search]);

  useEffect(() => {
    let live = true;
    fetchAdPage(kind, ref).then((p) => live && setPage(p || null), () => live && setPage(null));
    if (kind === "building") recordBuildingView(ref, "link"); else recordFlatView(ref, "link");
    return () => { live = false; };
  }, [kind, ref]);
  // The page drawn before the app (api/_adPrepaint.js) gives way once this one is drawn.
  useLayoutEffect(() => { if (page !== undefined) dropPrerender(); }, [page]);
  // Opening the page, with where they came from (WhatsApp, a Meta ad…).
  useEffect(() => { recordAdEvent(kind, ref, "open", { utm }); }, [kind, ref, utm]);
  useViewEngagement(kind === "flat" && page ? ref : null, 0);

  const title = !page ? "" : kind === "building" ? page.name
    : [page.flat_type, page.furnishing].filter(Boolean).join(" · ") || page.title || "Flat for rent";
  useEffect(() => { if (title) document.title = `${title} in ${page?.area || "Bengaluru"} · Schedule a visit · MovEazy`; }, [title, page]);

  const px = { content_ids: [ref], content_type: kind === "building" ? "product_group" : "home_listing", content_category: kind };
  const exploreUrl = `/tenant${search || ""}`;

  const schedule = () => {
    trackPixel("ScheduleVisitClick", px, { custom: true });
    setGateFor("schedule");
    setStep(leadSnapshot().phone ? "slot" : "phone");
  };
  const explore = () => {
    trackPixel("ExploreMoreClick", px, { custom: true });
    if (leadSnapshot().phone) { navigate(exploreUrl); return; }
    setGateFor("explore");
    setStep("phone");
  };
  const phoneGiven = (mobile) => {
    trackPixel("PhoneSubmitted", { ...px, content_name: gateFor }, { custom: true, user: { phone: mobile } });
    if (gateFor === "explore") { setStep(null); navigate(exploreUrl); } else setStep("slot");
  };

  if (page === undefined) return <Shell onExplore={explore}><div className="va-load" aria-busy="true"><span /><span /><span /></div></Shell>;
  if (!page) {
    return (
      <Shell onExplore={explore}>
        <div className="va-empty"><Building2 size={36} /><p>This page isn&apos;t available right now.</p></div>
      </Shell>
    );
  }

  const photos = kind === "building" ? (page.photos ?? []) : listingMedia(page);
  const where = [page.area, page.landmark].filter(Boolean).join(" · ");
  const facts = kind === "building"
    ? [
      page.flat_types?.length ? [BedDouble, page.flat_types.join(", ")] : null,
      page.total_floors ? [Building2, `${page.total_floors} floors`] : null,
    ]
    : [
      page.bedrooms ? [BedDouble, `${page.bedrooms} bed`] : null,
      page.bathrooms ? [Bath, `${page.bathrooms} bath`] : null,
      page.area_sqft ? [Ruler, `${page.area_sqft} sq ft`] : null,
      page.furnishing ? [Sofa, page.furnishing] : null,
    ];

  return (
    <Shell onExplore={explore}>
      <Gallery photos={photos} name={title} />
      <section className="va-head">
        <h1>{title}</h1>
        {where && <div className="va-where"><MapPin size={15} /> {where}</div>}
        <div className="va-rent">
          {kind === "building"
            ? page.rent_from ? <>From <b>{inr(page.rent_from)}</b><small> / month</small></> : <b>Rent on request</b>
            : page.rent ? <><b>{inr(page.rent)}</b><small> / month</small></> : <b>Rent on request</b>}
        </div>
        {kind === "flat" && (Number(page.deposit) > 0 || Number(page.maintenance) > 0) && (
          <div className="va-money">
            {Number(page.deposit) > 0 && <span><small>Deposit</small><b>{short(page.deposit)}</b></span>}
            {Number(page.maintenance) > 0 && <span><small>Maintenance</small><b>{inr(page.maintenance)}</b></span>}
          </div>
        )}
        {facts.filter(Boolean).length > 0 && (
          <div className="va-facts">
            {facts.filter(Boolean).map(([Icon, text]) => <span key={text}><Icon size={15} /> {text}</span>)}
          </div>
        )}
        <div className="va-trust"><BadgeCheck size={16} /> Verified by MovEazy · free visit</div>
      </section>

      {booking && <VisitCallCard key={booking.id + booking.slot_at} booking={booking} />}
      {kind === "building" && <AvailableFlats flats={page.available ?? []} code={ref} utm={utm} onSchedule={schedule} Sheet={Sheet} />}

      {(page.amenities ?? []).length > 0 && (
        <section className="va-card">
          <h2>Amenities</h2>
          <div className="va-chips">{page.amenities.slice(0, 12).map((a) => <span key={a}>{a}</span>)}</div>
        </section>
      )}
      {page.description && (
        <section className="va-card">
          <h2>About</h2>
          <p className="va-desc">{page.description}</p>
        </section>
      )}

      <div className="va-cta">
        <button type="button" className="va-btn" onClick={schedule}><CalendarCheck size={19} /> {booking ? "Change your visit" : "Schedule a visit"}</button>
      </div>

      <RequirePhoneFirst open={step === "phone"} onClose={() => setStep(null)}
        extra={{ leadType: "direct", propertyId: kind === "flat" ? ref : undefined }}
        onDone={phoneGiven} />
      {step === "slot" && (
        <SlotSheet kind={kind} refId={ref} page={page} title={title} utm={utm}
          onClose={() => setStep(null)} onChangePhone={() => setStep("phone")}
          onBooked={(r) => { setDone(r); setBooking(readAdBooking(kind, ref)); setStep("done"); }} />
      )}
      {step === "done" && done && (
        <DoneSheet done={done} title={title} where={where} onClose={() => setStep(null)} onChange={() => setStep("slot")} />
      )}
    </Shell>
  );
}

function Shell({ children, onExplore }) {
  return (
    <div className="va">
      <style>{CSS + EXTRA_CSS}</style>
      <header className="va-top">
        <img src={logo} alt="MovEazy" />
        {onExplore && <button type="button" className="va-explore" onClick={onExplore}><Compass size={14} /> Explore more</button>}
      </header>
      <main className="va-col">{children}</main>
    </div>
  );
}

function Gallery({ photos, name }) {
  const { index: i, trackProps } = useSnapTrack();
  const full = usePhotoViewer(photos, name);
  if (!photos.length) return <div className="va-gallery va-gallery--none"><Building2 size={44} /></div>;
  return (
    <div className="va-gwrap">
      <div className="va-gallery" {...trackProps}>
        {photos.map((src, k) => (
          <div key={src + k} onClick={() => full.open(k)}><MediaItem src={src} alt={k === 0 ? name : ""} priority={k === 0} /></div>
        ))}
      </div>
      {full.viewer}
      {photos.length > 1 && (
        <>
          <span className="va-gcount">{i + 1} / {photos.length}</span>
          <div className="va-dots">{photos.slice(0, 10).map((s, k) => <i key={s + k} className={k === i ? "on" : ""} />)}</div>
        </>
      )}
    </div>
  );
}

function Sheet({ title, onClose, onBack, children }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="va-sheet-bg" onClick={onClose} role="presentation">
      <div className="va-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="va-sheet-head">
          {onBack ? <button type="button" aria-label="Back" onClick={onBack}><ChevronLeft size={22} /></button> : <span />}
          <h3>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose}><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pick a day and an hour, add a name, book. */
export function SlotSheet({ kind, refId, page, title, utm, onClose, onChangePhone, onBooked }) {
  const days = useMemo(() => slotsByDay(adSlots(page)), [page]);
  const [day, setDay] = useState(days[0]?.day || "");
  const [slot, setSlot] = useState("");
  const lead = leadSnapshot();
  const [name, setName] = useState(lead.name || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = days.find((d) => d.day === day)?.slots ?? [];
  const book = async () => {
    if (!slot) { setErr("Pick a time."); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await bookAdVisit({ kind, ref: refId, phone: lead.phone, name: name.trim(), slotAt: slot, utm });
      onBooked(r);
    } catch (e) {
      setErr(e?.message || "Couldn't book. Please try again.");
      setBusy(false);
    }
  };
  return (
    <Sheet title="Schedule a visit" onClose={onClose}>
      <div className="va-pad">
        <div className="va-for">
          <span><Phone size={14} /> Visit for <b>{lead.phone}</b></span>
          <button type="button" onClick={onChangePhone}>Change</button>
        </div>
        <div className="va-label">Pick a day</div>
        <div className="va-days">
          {days.map((d) => (
            <button key={d.day} type="button" className={d.day === day ? "on" : ""} onClick={() => { setDay(d.day); setSlot(""); }}>
              {dayLabel(d.day)}
            </button>
          ))}
        </div>
        <div className="va-label">Pick a time</div>
        <div className="va-slots">
          {list.map((s) => (
            <button key={s} type="button" className={s === slot ? "on" : ""} onClick={() => setSlot(s)}>{slotLabel(s)}</button>
          ))}
        </div>
        <div className="va-label">Your name <span>(optional)</span></div>
        <input className="va-input" value={name} maxLength={80} placeholder="Your name" autoComplete="name" onChange={(e) => setName(e.target.value)} />
        {err && <div className="va-err">{err}</div>}
        <button type="button" className="va-btn" disabled={busy || !slot} onClick={book}>
          {busy ? "Booking…" : slot ? `Book · ${dayLabel(day)}, ${slotLabel(slot)}` : "Pick a time"}
        </button>
        <p className="va-small">Free visit for {title}. MovEazy will call you to confirm.</p>
      </div>
    </Sheet>
  );
}

function DoneSheet({ done, title, where, onClose, onChange }) {
  const day = new Date(done.slot_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return (
    <Sheet title="Visit booked" onClose={onClose}>
      <div className="va-pad va-done">
        <div className="va-done-ic"><Check size={30} /></div>
        <h4>{done.moved ? "Your visit is moved" : "Your visit is booked"}</h4>
        <div className="va-done-when">{dayLabel(day)}, {slotLabel(done.slot_at)}</div>
        <div className="va-done-what">{title}{where ? ` · ${where}` : ""}</div>
        <p>MovEazy will call you to confirm and share the exact location on WhatsApp. From the time of your visit, you can call the
          caretaker right on this page.</p>
        <a className="va-btn va-btn--ghost" href={calendarLink({ title, slotAt: done.slot_at, where })} target="_blank" rel="noreferrer">
          <CalendarPlus size={18} /> Add to Google Calendar
        </a>
        <button type="button" className="va-link" onClick={onChange}>Change the time</button>
      </div>
    </Sheet>
  );
}

const CSS = `
.va { --deep:#063B2D; --em:#0A6B4E; --emt:#E7F2EC; --champ:#D6B77C; --champ2:#F4EBD8; --champ3:#8A6A2F;
  --cream:#F7F4EC; --ink:#17211D; --dim:#5E6B66; --mute:#94A09B; --line:#E6E1D4; --line2:#EFEBE0;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--cream); min-height: 100dvh;
  -webkit-tap-highlight-color: transparent; }
.va *, .va *::before, .va *::after { box-sizing: border-box; }
.va-top { position: sticky; top: 0; z-index: 20; height: 56px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 16px;
  background: rgba(247,244,236,.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--line2); }
.va-top img { height: 26px !important; width: auto; display: block; }
.va-explore { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--em); background: #fff; color: var(--em);
  border-radius: 99px; padding: 6px 11px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.va-explore:active { background: var(--emt); }
.va-col { max-width: 560px; margin: 0 auto; padding: 0 0 calc(110px + env(safe-area-inset-bottom)); }
.va-gwrap { position: relative; }
.va-gallery { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; aspect-ratio: 4 / 3; background: #E9E4D6; }
.va-gallery::-webkit-scrollbar { display: none; }
.va-gallery > div { flex: 0 0 100%; scroll-snap-align: start; height: 100%; cursor: zoom-in; }
.va-gallery img, .va-gallery video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.va-gallery--none { display: grid; place-items: center; color: var(--mute); }
.va-gcount { position: absolute; right: 12px; top: 12px; background: rgba(0,0,0,.55); color: #fff; font-size: 12px; font-weight: 600; border-radius: 99px; padding: 4px 10px; }
.va-dots { position: absolute; left: 0; right: 0; bottom: 30px; display: flex; gap: 5px; justify-content: center; }
.va-dots i { width: 6px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.55); transition: width .2s, background .2s; }
.va-dots i.on { width: 18px; background: #fff; }
.va-head { background: #fff; margin: -18px 12px 0; position: relative; border-radius: 20px; padding: 18px 16px 16px; border: 1px solid var(--line2);
  box-shadow: 0 8px 24px rgba(6,59,45,.08); }
.va-head h1 { font-size: 22px; line-height: 1.2; margin: 0; letter-spacing: -.01em; }
.va-where { display: flex; align-items: center; gap: 5px; color: var(--dim); font-size: 14px; margin-top: 6px; }
.va-rent { margin-top: 12px; font-size: 14px; color: var(--dim); }
.va-rent b { font-size: 26px; color: var(--deep); letter-spacing: -.02em; }
.va-money { display: flex; gap: 8px; margin-top: 10px; }
.va-money span { flex: 1; display: flex; flex-direction: column; gap: 2px; background: var(--cream); border-radius: 12px; padding: 9px 11px; }
.va-money small { font-size: 11.5px; color: var(--dim); font-weight: 600; }
.va-money b { font-size: 16px; }
.va-facts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.va-facts span { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); border-radius: 99px; padding: 6px 10px; font-size: 13px; color: var(--ink); }
.va-facts svg { color: var(--em); }
.va-trust { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 12.5px; color: var(--em); font-weight: 700; }
.va-card { background: #fff; margin: 12px; border-radius: 18px; padding: 14px 16px; border: 1px solid var(--line2); }
.va-card h2 { font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); margin: 0 0 10px; }
.va-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.va-chips span { background: var(--emt); color: var(--deep); border-radius: 99px; padding: 5px 10px; font-size: 12.5px; font-weight: 600; }
.va-desc { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ink); white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.va-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(247,244,236,0), var(--cream) 30%); }
.va-cta .va-btn { max-width: 528px; margin: 0 auto; }
.va-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: 0; border-radius: 14px; padding: 15px 16px;
  font: inherit; font-size: 16px; font-weight: 800; color: #fff; background: var(--em); cursor: pointer; text-decoration: none;
  box-shadow: 0 8px 20px rgba(10,107,78,.28); }
.va-btn:disabled { opacity: .55; cursor: default; box-shadow: none; }
.va-btn--ghost { background: #fff; color: var(--deep); border: 1px solid var(--line); box-shadow: none; }
.va-sheet-bg { position: fixed; inset: 0; z-index: 60; background: rgba(10,20,16,.45); display: flex; align-items: flex-end; justify-content: center; }
.va-sheet { width: 100%; max-width: 560px; max-height: 92dvh; overflow-y: auto; background: var(--cream); border-radius: 22px 22px 0 0;
  padding-bottom: env(safe-area-inset-bottom); }
.va-sheet-head { position: sticky; top: 0; display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; padding: 10px 8px;
  background: var(--cream); border-bottom: 1px solid var(--line2); z-index: 1; }
.va-sheet-head h3 { margin: 0; text-align: center; font-size: 16px; }
.va-sheet-head button { border: 0; background: none; color: var(--dim); cursor: pointer; display: grid; place-items: center; height: 40px; }
.va-pad { padding: 14px 16px 18px; }
.va-for { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 10px 12px; font-size: 14px; }
.va-for span { display: inline-flex; align-items: center; gap: 6px; }
.va-for button { border: 0; background: none; color: var(--em); font: inherit; font-weight: 700; cursor: pointer; }
.va-label { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); margin: 16px 0 8px; }
.va-label span { text-transform: none; letter-spacing: 0; font-weight: 500; }
.va-days { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.va-days::-webkit-scrollbar { display: none; }
.va-days button, .va-slots button { flex: none; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 10px 13px;
  font: inherit; font-size: 14px; font-weight: 700; color: var(--ink); cursor: pointer; }
.va-days button.on, .va-slots button.on { border-color: var(--em); background: var(--emt); color: var(--deep); }
.va-slots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.va-input { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 12px; font: inherit; font-size: 15px; margin-bottom: 14px; }
.va-input:focus { outline: none; border-color: var(--em); box-shadow: 0 0 0 3px var(--emt); }
.va-err { color: #C0392B; font-size: 13.5px; font-weight: 600; margin: -4px 0 10px; }
.va-small { text-align: center; color: var(--dim); font-size: 12.5px; margin: 10px 0 0; }
.va-done { text-align: center; }
.va-done-ic { width: 64px; height: 64px; border-radius: 99px; margin: 6px auto 10px; display: grid; place-items: center; background: var(--emt); color: var(--em); }
.va-done h4 { margin: 0; font-size: 20px; }
.va-done-when { margin-top: 8px; font-size: 17px; font-weight: 800; color: var(--deep); }
.va-done-what { margin-top: 4px; color: var(--dim); font-size: 14px; }
.va-done p { color: var(--ink); font-size: 14px; line-height: 1.5; margin: 14px 0; }
.va-link { border: 0; background: none; color: var(--em); font: inherit; font-weight: 700; margin-top: 12px; cursor: pointer; }
.va-empty { padding: 80px 24px; text-align: center; color: var(--dim); }
.va-load { display: grid; gap: 12px; padding: 0 0 20px; }
.va-load span { display: block; background: #ECE7DA; border-radius: 16px; animation: va-pulse 1.2s ease-in-out infinite; }
.va-load span:nth-child(1) { aspect-ratio: 4 / 3; border-radius: 0; }
.va-load span:nth-child(2) { height: 120px; margin: 0 12px; }
.va-load span:nth-child(3) { height: 80px; margin: 0 12px; }
@keyframes va-pulse { 50% { opacity: .55; } }
`;
