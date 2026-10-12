/**
 * moveazy.co.in/c/<token> — a partner's curated list, as the tenant sees it.
 *
 * Mobile number first (name optional): the tenant becomes that partner's
 * tenant (unverified), never a MovEazy lead. Then a swipe deck — right or ♥ to
 * like, left or ✕ to dislike; tapping a card opens every photo and detail
 * right here (CuratedDetails), with only Like / Dislike: visits are fixed with
 * the partner, never booked on MovEazy. Every new like reaches the partner.
 *
 * At the end — and every time the link is opened again — "My homes": the
 * partner, the flats liked across every list they sent this tenant, a
 * WhatsApp message listing them, and a change of mind any time. Nothing here
 * leads to MovEazy's own pages. Separate from MovEazy's curated shortlists at
 * /curated/<token>.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Heart, Info, MapPin, Phone, RotateCcw, X } from "lucide-react";
import { SmartListingImage } from "./partners/partnerMedia";
import { WhatsAppIcon } from "./partners/partnerUi";
import { inr, waLink } from "../lib/partners";
import { actOnCurated, curatedUrl, fetchCuratedSiblings, giveCuratedContact, openCuratedList } from "../lib/partnerCurated";
import { formatForDisplay, normalizeIndianMobile } from "../lib/mobile";
import CuratedDetails from "./curated/CuratedDetails";
import { allHomes, firstName, flatLine, likedMessage } from "./curated/curatedText";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";

const seenKey = (t) => `mz_curated_${t}`;
const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";

function HomeRow({ h, onOpen }) {
  return (
    <button type="button" className="cs-row" onClick={onOpen}>
      <span className="cs-thumb"><SmartListingImage listing={h} thumb /></span>
      <span className="cs-row-main">
        <b>{inr(h.rent)}<small> / month</small></b>
        <span>{flatLine(h)}</span>
        {h.let_out && <em className="cs-tag cs-tag--warn">May be let out</em>}
      </span>
      <ChevronRight size={18} className="cs-row-go" />
    </button>
  );
}

export default function CuratedSwipe() {
  const { token = "" } = useParams();
  const [data, setData] = useState(undefined);
  const [lists, setLists] = useState([]);
  const [contact, setContact] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [open, setOpen] = useState(null); // { token, property_id }
  const [showNo, setShowNo] = useState(false);
  const start = useRef(null);

  useEffect(() => {
    openCuratedList(token).then((d) => {
      setData(d || null);
      if (!d) return;
      let local = false;
      try { local = localStorage.getItem(seenKey(token)) === "1"; } catch { /* private tab */ }
      // A MovEazy tenant's list (`known`) needs no number: MovEazy already has it.
      setContact(Boolean((d.has_contact && local) || d.known));
      const homes = d.homes || [];
      setLists([{ token, homes }]);
      const first = homes.findIndex((h) => !h.action);
      setIdx(first < 0 ? homes.length : first);
    }, () => setData(null));
  }, [token]);

  // Once we know who they are: the partner's other lists to them.
  useEffect(() => {
    if (!contact || !data) return undefined;
    let alive = true;
    fetchCuratedSiblings(token).then((more) => {
      if (alive && more.length) setLists((ls) => [ls[0], ...more.map((m) => ({ token: m.token, homes: m.homes ?? [] }))]);
    }, () => {});
    return () => { alive = false; };
  }, [contact, data, token]);

  const homes = useMemo(() => lists[0]?.homes ?? [], [lists]);
  const everything = useMemo(() => allHomes(lists), [lists]);
  const b = data?.broker || {};
  const partner = firstName(b.name) || "your partner";
  const Partner = firstName(b.name) || "Your partner";
  const liked = everything.filter((h) => h.action === "liked");
  const disliked = everything.filter((h) => h.action === "skipped");
  const pending = everything.filter((h) => !h.action && h.token !== token);

  const setAction = useCallback((tok, pid, action) => {
    setLists((ls) => ls.map((l) => (l.token !== tok ? l : { ...l, homes: l.homes.map((h) => (h.property_id === pid ? { ...h, action } : h)) })));
    actOnCurated(tok, pid, action).catch(() => {});
  }, []);

  const submitContact = async (e) => {
    e.preventDefault();
    if (!normalizeIndianMobile(phone)) { setErr("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    try {
      await giveCuratedContact(token, phone, name);
      try { localStorage.setItem(seenKey(token), "1"); } catch { /* fine */ }
      setContact(true);
    } catch (ex) {
      setErr(ex?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const decide = (action) => {
    const h = homes[idx];
    if (!h) return;
    setAction(token, h.property_id, action);
    setDrag(0);
    setIdx((i) => i + 1);
  };

  const onDown = (e) => { start.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (start.current != null) setDrag(e.clientX - start.current); };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (drag > 90) decide("liked");
    else if (drag < -90) decide("skipped");
    else {
      // A tap, not a swipe: open the flat.
      if (Math.abs(drag) < 6 && homes[idx]) setOpen({ token, property_id: homes[idx].property_id });
      setDrag(0);
    }
  };

  if (data === undefined) return <div className="cs"><style>{CSS}</style><div className="cs-load"><span /></div></div>;
  if (data === null) {
    return (
      <div className="cs"><style>{CSS}</style>
        <div className="cs-col cs-center">
          <h1>This list isn’t available.</h1>
          <p>The link may be old or mistyped. Ask your partner to send you a fresh one on WhatsApp.</p>
        </div>
      </div>
    );
  }

  const openHome = open ? everything.find((x) => x.property_id === open.property_id && x.token === open.token)
    ?? lists.find((l) => l.token === open.token)?.homes.find((x) => x.property_id === open.property_id) : null;
  const details = openHome && (
    <CuratedDetails home={openHome} brokerName={b.name} onClose={() => setOpen(null)}
      onDecide={(action) => {
        if (open.token === token && homes[idx]?.property_id === open.property_id) decide(action);
        else setAction(open.token, open.property_id, action);
      }} />
  );

  const head = (
    <header className="cs-head">
      <img src={logoOnDark} alt="MovEazy" height="22" className="cs-logo" />
      <div className="cs-broker">
        {b.photo_url ? <img src={b.photo_url} alt="" width="46" height="46" className="cs-photo" /> : <span className="cs-photo cs-photo--none">{initials(b.name)}</span>}
        <div>
          <b>{b.name || "Your partner"}</b>
          <span>picked {homes.length} home{homes.length === 1 ? "" : "s"} for you{data.lead_name ? `, ${firstName(data.lead_name)}` : ""}</span>
        </div>
      </div>
    </header>
  );

  if (!contact) {
    return (
      <div className="cs"><style>{CSS}</style>
        {head}
        <form className="cs-col cs-gate" onSubmit={submitContact} noValidate>
          <h1>Your homes are ready</h1>
          <p>Enter your mobile number to start. {Partner} sees the homes you like and sets up the visits.</p>
          <label htmlFor="cs-phone">Mobile number</label>
          <div className={`cs-field${err ? " bad" : ""}`}>
            <span>+91</span>
            <input id="cs-phone" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" autoFocus
              value={formatForDisplay(phone)} onChange={(e) => { let d = e.target.value.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); setPhone(d.slice(0, 10)); setErr(""); }} />
          </div>
          <label htmlFor="cs-name">Name <small>(optional)</small></label>
          <input id="cs-name" className="cs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          {err && <p className="cs-err" role="alert">{err}</p>}
          <button type="submit" className="cs-btn cs-btn--gold" disabled={busy}>{busy ? "One moment…" : "See my homes"}</button>
          <p className="cs-fine">Shared only with {b.name || "your partner"}. <a href="https://www.moveazy.co.in/terms" target="_blank" rel="noreferrer">Terms</a></p>
        </form>
      </div>
    );
  }

  const h = homes[idx];
  const next = homes[idx + 1];
  if (h) {
    return (
      <div className="cs"><style>{CSS}</style>
        {head}
        <main className="cs-col">
          <p className="cs-progress">{idx + 1} of {homes.length} · tap for photos & details</p>
          <div className="cs-deck">
            {next && <article className="cs-card cs-card--under" aria-hidden><div className="cs-img"><SmartListingImage listing={next} /></div></article>}
            <article className="cs-card" style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)` }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {drag > 30 && <span className="cs-stamp like">LIKE</span>}
              {drag < -30 && <span className="cs-stamp nope">DISLIKE</span>}
              <div className="cs-img"><SmartListingImage listing={h} /></div>
              <div className="cs-body">
                <div className="cs-rent">{inr(h.rent)} <small>/ month</small></div>
                <div className="cs-line">{h.flat_type} · <MapPin size={14} /> {h.area}</div>
                <div className="cs-meta">{[h.furnishing, h.deposit ? `Deposit ${inr(h.deposit)}` : "", h.available_from ? `From ${new Date(h.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""].filter(Boolean).join(" · ")}</div>
                {h.let_out && <em className="cs-tag cs-tag--warn">May be let out</em>}
                <button type="button" className="cs-more" onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen({ token, property_id: h.property_id })}>
                  <Info size={15} /> See all photos & details
                </button>
              </div>
            </article>
          </div>
          <div className="cs-actions">
            <button type="button" className="cs-round nope" onClick={() => decide("skipped")}><X size={30} /><span>Dislike</span></button>
            <button type="button" className="cs-round like" onClick={() => decide("liked")}><Heart size={30} fill="currentColor" /><span>Like</span></button>
          </div>
        </main>
        {details}
      </div>
    );
  }

  // My homes: the end of the list, and what every later visit to the link opens.
  const url = curatedUrl(token);
  return (
    <div className="cs"><style>{CSS}</style>
      <header className="cs-head cs-head--home">
        <img src={logoOnDark} alt="MovEazy" height="22" className="cs-logo" />
        <p className="cs-kicker">Your partner</p>
        <div className="cs-broker">
          {b.photo_url ? <img src={b.photo_url} alt="" width="56" height="56" className="cs-photo cs-photo--lg" /> : <span className="cs-photo cs-photo--none cs-photo--lg">{initials(b.name)}</span>}
          <div>
            <b>{b.name || "Your partner"}</b>
            {b.agency && <span>{b.agency}</span>}
          </div>
        </div>
        {b.phone && (
          <div className="cs-contact">
            <a className="cs-chip-btn" href={waLink(b.phone, `Hi${firstName(b.name) ? ` ${firstName(b.name)}` : ""}, `)} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
            <a className="cs-chip-btn" href={`tel:+91${normalizeIndianMobile(b.phone)}`}><Phone size={16} /> Call</a>
          </div>
        )}
      </header>

      <main className="cs-col cs-home">
        <h1>{liked.length ? `You liked ${liked.length} home${liked.length === 1 ? "" : "s"}` : "That's the list"}</h1>
        <p className="cs-lead">
          {liked.length ? `Send them to ${partner} and fix a time to see them.` : `Nothing caught your eye? Tell ${partner} what to change.`}
        </p>
        {b.phone && (
          <a className="cs-btn cs-btn--wa" target="_blank" rel="noreferrer"
            href={waLink(b.phone, likedMessage({ brokerName: b.name, liked, url }))}>
            <WhatsAppIcon /> {liked.length ? `Ask ${partner} for visits` : `Ask ${partner} for more options`}
          </a>
        )}

        {liked.length > 0 && (
          <section className="cs-sec">
            <h2><Heart size={16} fill="#E11D48" color="#E11D48" /> Liked</h2>
            {liked.map((x) => <HomeRow key={x.property_id} h={x} onOpen={() => setOpen({ token: x.token, property_id: x.property_id })} />)}
          </section>
        )}

        {pending.length > 0 && (
          <section className="cs-sec">
            <h2>Still to decide · {pending.length}</h2>
            <p className="cs-hint">From {partner}’s other lists. Open one to like or dislike it.</p>
            {pending.map((x) => <HomeRow key={x.property_id} h={x} onOpen={() => setOpen({ token: x.token, property_id: x.property_id })} />)}
          </section>
        )}

        {disliked.length > 0 && (
          <section className="cs-sec">
            <button type="button" className="cs-fold" onClick={() => setShowNo((v) => !v)} aria-expanded={showNo}>
              <span>Disliked · {disliked.length}</span><ChevronDown size={18} style={{ transform: showNo ? "rotate(180deg)" : "none" }} />
            </button>
            {showNo && (
              <>
                <p className="cs-hint">Changed your mind? Open one and tap Like.</p>
                {disliked.map((x) => <HomeRow key={x.property_id} h={x} onOpen={() => setOpen({ token: x.token, property_id: x.property_id })} />)}
              </>
            )}
          </section>
        )}

        {homes.length > 0 && <button type="button" className="cs-again" onClick={() => setIdx(0)}><RotateCcw size={15} /> Go through this list again</button>}
        <p className="cs-fine">Visits are fixed with {b.name || "your partner"}. Keep this link to come back to your homes.</p>
      </main>
      {details}
    </div>
  );
}

const CSS = `
.cs { min-height: 100vh; min-height: 100dvh; background: #F7F5EE; color: #13201B; font-family: Manrope, Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.cs *, .cs *::before, .cs *::after { box-sizing: border-box; }
.cs-col { max-width: 480px; margin: 0 auto; padding: 0 16px 28px; }
.cs-load { min-height: 100dvh; display: grid; place-items: center; }
.cs-load span { width: 34px; height: 34px; border-radius: 99px; border: 3px solid #E6E2D6; border-top-color: #0A3A2A; animation: csspin .8s linear infinite; }
@keyframes csspin { to { transform: rotate(360deg); } }
.cs-head { background: radial-gradient(120% 100% at 0% 0%, #1B6B4E, #0A3A2A 55%, #05241A); color: #fff; padding: 16px 16px 18px; }
.cs .cs-logo { height: 22px; width: auto; display: block; }
.cs-broker { display: flex; align-items: center; gap: 12px; margin-top: 14px; max-width: 480px; }
.cs .cs-photo { width: 46px; height: 46px; border-radius: 99px; object-fit: cover; border: 2px solid #E4B659; flex: none; }
.cs-photo--none { display: grid; place-items: center; background: #F7E9C6; color: #8A6419; font-weight: 800; }
.cs-broker b { display: block; font-size: 17px; }
.cs-broker span { font-size: 13.5px; opacity: .8; }
.cs-gate h1 { font-size: 26px; letter-spacing: -0.02em; margin: 22px 0 6px; }
.cs-gate p { color: #56655F; margin: 0 0 18px; line-height: 1.5; }
.cs-gate label { display: block; font-size: 13px; font-weight: 700; margin: 12px 0 6px; }
.cs-gate label small { font-weight: 500; color: #56655F; }
.cs-field { display: flex; align-items: center; gap: 10px; background: #fff; border: 2px solid #E6E2D6; border-radius: 14px; padding: 0 14px; min-height: 54px; }
.cs-field.bad { border-color: #F87171; }
.cs-field span { font-weight: 800; }
.cs-field input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 18px; font-weight: 700; background: transparent; padding: 14px 0; }
.cs-input { width: 100%; min-height: 50px; border: 2px solid #E6E2D6; border-radius: 14px; padding: 0 14px; font: inherit; font-size: 16px; background: #fff; }
.cs-err { color: #B42318; font-weight: 600; font-size: 13.5px; margin: 8px 0 0 !important; }
.cs-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 54px; margin-top: 18px; border-radius: 14px; border: 0; cursor: pointer;
  font: inherit; font-size: 16px; font-weight: 800; text-decoration: none; }
.cs-btn--gold { background: linear-gradient(180deg, #F2CD7A, #E4B659); color: #1F1605; }
.cs-btn--wa { background: #22C55E; color: #fff; }
.cs-fine { font-size: 12px; text-align: center; margin-top: 12px !important; }
.cs-fine a { color: #0A3A2A; font-weight: 700; }
.cs-progress { text-align: center; font-size: 13px; color: #56655F; font-weight: 700; margin: 14px 0 10px; }
.cs-deck { position: relative; height: min(64dvh, 520px); }
.cs-card { position: absolute; inset: 0; background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 16px 40px rgba(10,40,30,.18);
  touch-action: pan-y; user-select: none; transition: transform .08s linear; display: flex; flex-direction: column; cursor: pointer; }
.cs-card--under { transform: scale(.95) translateY(12px); opacity: .7; box-shadow: none; }
.cs-img { flex: 1; min-height: 0; background: #E5E7EB; pointer-events: none; }
.cs-img img, .cs-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.cs-body { padding: 14px 16px 16px; }
.cs-rent { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; }
.cs-rent small { font-size: 14px; color: #56655F; font-weight: 600; }
.cs-line { display: flex; align-items: center; gap: 4px; font-weight: 700; margin-top: 2px; }
.cs-meta { font-size: 13px; color: #56655F; margin-top: 4px; }
.cs-more { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 8px 12px; border-radius: 99px; border: 1.5px solid #CFE3D9;
  background: #F1F8F4; font: inherit; font-size: 13.5px; font-weight: 800; color: #0A3A2A; cursor: pointer; }
.cs-stamp { position: absolute; top: 18px; z-index: 2; font-size: 26px; font-weight: 900; letter-spacing: .08em; padding: 4px 12px; border-radius: 10px; border: 4px solid; transform: rotate(-12deg); }
.cs-stamp.like { left: 18px; color: #16A34A; border-color: #16A34A; background: rgba(255,255,255,.8); }
.cs-stamp.nope { right: 18px; color: #E11D48; border-color: #E11D48; background: rgba(255,255,255,.8); transform: rotate(12deg); }
.cs-actions { display: flex; justify-content: center; gap: 28px; margin-top: 16px; }
.cs-round { width: 76px; height: 76px; border-radius: 99px; border: 0; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  cursor: pointer; box-shadow: 0 10px 24px rgba(10,40,30,.16); font: inherit; }
.cs-round span { font-size: 11px; font-weight: 800; }
.cs-round.nope { color: #E11D48; }
.cs-round.like { color: #fff; background: linear-gradient(135deg, #22C55E, #15803D); }
.cs-again { margin-top: 14px; border: 0; background: none; font: inherit; font-weight: 700; color: #0A3A2A; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.cs-center { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.cs-center p { color: #56655F; line-height: 1.5; }
.cs-tag { display: inline-block; margin-top: 6px; font-style: normal; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 99px; }
.cs-tag--warn { background: #FEF3C7; color: #92400E; }
.cs-head--home { padding-bottom: 20px; }
.cs-kicker { margin: 16px 0 0; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #E4B659; }
.cs-head--home .cs-broker { margin-top: 8px; }
.cs .cs-photo--lg { width: 56px; height: 56px; }
.cs-contact { display: flex; gap: 8px; margin-top: 14px; max-width: 480px; }
.cs-chip-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border-radius: 12px;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); color: #fff; font-weight: 800; font-size: 14px; text-decoration: none; }
.cs-chip-btn svg { width: 18px; height: 18px; }
.cs-home h1 { font-size: 25px; letter-spacing: -0.02em; margin: 20px 0 4px; }
.cs-lead { color: #56655F; margin: 0; line-height: 1.5; }
.cs-sec { margin-top: 22px; }
.cs-sec h2 { display: flex; align-items: center; gap: 6px; font-size: 15px; margin: 0 0 8px; }
.cs-hint { font-size: 13px; color: #56655F; margin: -4px 0 8px; }
.cs-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px; margin-bottom: 8px; background: #fff; border: 1px solid #E6E2D6;
  border-radius: 14px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.cs-thumb { width: 72px; height: 56px; border-radius: 10px; overflow: hidden; flex: none; background: #E5E7EB; }
.cs-thumb img, .cs-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.cs-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cs-row-main b { font-size: 16px; }
.cs-row-main b small { font-size: 12.5px; color: #56655F; font-weight: 600; }
.cs-row-main > span { font-size: 13.5px; color: #2F3B36; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-row-main .cs-tag { align-self: flex-start; margin-top: 4px; }
.cs-row-go { color: #9CA3AF; flex: none; }
.cs-fold { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: 0; padding: 4px 0 8px;
  font: inherit; font-size: 15px; font-weight: 800; color: #13201B; cursor: pointer; }
.cs-home .cs-again { display: flex; margin: 18px auto 0; }
.cs-home .cs-fine { color: #56655F; }
`;
