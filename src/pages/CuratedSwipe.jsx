/**
 * moveazy.co.in/c/<token> — a broker's curated list, as the tenant sees it.
 *
 * Mobile number first (name optional): the tenant becomes that broker's
 * tenant (unverified), never a MovEazy lead. Then a swipe deck — right or ♥ to
 * like, left or ✕ to skip. Every like reaches the broker as a notification.
 * Separate from MovEazy's own curated shortlists at /curated/<token>.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, MapPin, RotateCcw, X } from "lucide-react";
import { SmartListingImage } from "./partners/partnerMedia";
import { WhatsAppIcon } from "./partners/partnerUi";
import { inr, waLink } from "../lib/partners";
import { actOnCurated, giveCuratedContact, openCuratedList } from "../lib/partnerCurated";
import { formatForDisplay, normalizeIndianMobile } from "../lib/mobile";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";

const seenKey = (t) => `mz_curated_${t}`;
const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";

export default function CuratedSwipe() {
  const { token = "" } = useParams();
  const [data, setData] = useState(undefined);
  const [contact, setContact] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [acts, setActs] = useState({});
  const [drag, setDrag] = useState(0);
  const start = useRef(null);

  useEffect(() => {
    openCuratedList(token).then((d) => {
      setData(d || null);
      if (!d) return;
      let local = false;
      try { local = localStorage.getItem(seenKey(token)) === "1"; } catch { /* private tab */ }
      setContact(Boolean(d.has_contact && local));
      const done = Object.fromEntries((d.homes || []).filter((h) => h.action).map((h) => [h.property_id, h.action]));
      setActs(done);
      const first = (d.homes || []).findIndex((h) => !h.action);
      setIdx(first < 0 ? (d.homes || []).length : first);
    }, () => setData(null));
  }, [token]);

  const homes = useMemo(() => data?.homes ?? [], [data]);
  const b = data?.broker || {};
  const liked = homes.filter((h) => acts[h.property_id] === "liked");

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
    setActs((a) => ({ ...a, [h.property_id]: action }));
    setDrag(0);
    setIdx((i) => i + 1);
    actOnCurated(token, h.property_id, action).catch(() => {});
  };

  const onDown = (e) => { start.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (start.current != null) setDrag(e.clientX - start.current); };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (drag > 90) decide("liked");
    else if (drag < -90) decide("skipped");
    else setDrag(0);
  };

  if (data === undefined) return <div className="cs"><style>{CSS}</style><div className="cs-load"><span /></div></div>;
  if (data === null) {
    return (
      <div className="cs"><style>{CSS}</style>
        <div className="cs-col cs-center">
          <h1>This list isn’t available.</h1>
          <p>Ask your broker to send a fresh link — or browse verified homes on MovEazy.</p>
          <Link className="cs-btn cs-btn--gold" to="/">Browse homes</Link>
        </div>
      </div>
    );
  }

  const head = (
    <header className="cs-head">
      <img src={logoOnDark} alt="MovEazy" height="22" className="cs-logo" />
      <div className="cs-broker">
        {b.photo_url ? <img src={b.photo_url} alt="" width="46" height="46" className="cs-photo" /> : <span className="cs-photo cs-photo--none">{initials(b.name)}</span>}
        <div>
          <b>{b.name || "Your broker"}</b>
          <span>picked {homes.length} home{homes.length === 1 ? "" : "s"} for you{data.lead_name ? `, ${data.lead_name.split(" ")[0]}` : ""}</span>
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
          <p>Enter your mobile number to start swiping. {b.name ? b.name.split(" ")[0] : "Your broker"} sees the homes you like and sets up the visits.</p>
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
          <p className="cs-fine">Shared only with {b.name || "your broker"}. <a href="https://www.moveazy.co.in/terms">Terms</a></p>
        </form>
      </div>
    );
  }

  const h = homes[idx];
  const next = homes[idx + 1];
  return (
    <div className="cs"><style>{CSS}</style>
      {head}
      <main className="cs-col">
        {h ? (
          <>
            <p className="cs-progress">{idx + 1} of {homes.length} · swipe right to like</p>
            <div className="cs-deck">
              {next && <article className="cs-card cs-card--under" aria-hidden><div className="cs-img"><SmartListingImage listing={next} /></div></article>}
              <article className="cs-card" style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)` }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                {drag > 30 && <span className="cs-stamp like">LIKE</span>}
                {drag < -30 && <span className="cs-stamp nope">SKIP</span>}
                <div className="cs-img"><SmartListingImage listing={h} /></div>
                <div className="cs-body">
                  <div className="cs-rent">{inr(h.rent)} <small>/ month</small></div>
                  <div className="cs-line">{h.flat_type} · <MapPin size={14} /> {h.area}</div>
                  <div className="cs-meta">{[h.furnishing, h.deposit ? `Deposit ${inr(h.deposit)}` : "", h.available_from ? `From ${new Date(h.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""].filter(Boolean).join(" · ")}</div>
                  <a className="cs-more" href={`/property/${h.property_id}`} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>See all photos & details</a>
                </div>
              </article>
            </div>
            <div className="cs-actions">
              <button type="button" className="cs-round nope" aria-label="Skip" onClick={() => decide("skipped")}><X size={30} /></button>
              <button type="button" className="cs-round like" aria-label="Like" onClick={() => decide("liked")}><Heart size={30} fill="currentColor" /></button>
            </div>
          </>
        ) : (
          <div className="cs-done">
            <span className="cs-done-ic"><Heart size={30} fill="#fff" /></span>
            <h1>{liked.length ? `You liked ${liked.length} home${liked.length === 1 ? "" : "s"}` : "That's the list"}</h1>
            <p>{liked.length ? `${b.name ? b.name.split(" ")[0] : "Your broker"} has been told and will set up your visits.` : "Nothing caught your eye? Tell your broker what to change."}</p>
            {b.phone && (
              <a className="cs-btn cs-btn--wa" target="_blank" rel="noreferrer"
                href={waLink(b.phone, liked.length ? `Hi ${b.name ? b.name.split(" ")[0] : ""}, I liked ${liked.map((x) => `${x.flat_type} in ${x.area}`).join(", ")}. When can I visit?` : "Hi, I went through the list — can you show me a few more options?")}>
                <WhatsAppIcon /> Message {b.name ? b.name.split(" ")[0] : "your broker"}
              </a>
            )}
            {homes.length > 0 && <button type="button" className="cs-again" onClick={() => setIdx(0)}><RotateCcw size={15} /> Go through again</button>}
          </div>
        )}
      </main>
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
  touch-action: pan-y; user-select: none; transition: transform .08s linear; display: flex; flex-direction: column; }
.cs-card--under { transform: scale(.95) translateY(12px); opacity: .7; box-shadow: none; }
.cs-img { flex: 1; min-height: 0; background: #E5E7EB; pointer-events: none; }
.cs-img img, .cs-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.cs-body { padding: 14px 16px 16px; }
.cs-rent { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; }
.cs-rent small { font-size: 14px; color: #56655F; font-weight: 600; }
.cs-line { display: flex; align-items: center; gap: 4px; font-weight: 700; margin-top: 2px; }
.cs-meta { font-size: 13px; color: #56655F; margin-top: 4px; }
.cs-more { display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 800; color: #0A3A2A; }
.cs-stamp { position: absolute; top: 18px; z-index: 2; font-size: 26px; font-weight: 900; letter-spacing: .08em; padding: 4px 12px; border-radius: 10px; border: 4px solid; transform: rotate(-12deg); }
.cs-stamp.like { left: 18px; color: #16A34A; border-color: #16A34A; background: rgba(255,255,255,.8); }
.cs-stamp.nope { right: 18px; color: #E11D48; border-color: #E11D48; background: rgba(255,255,255,.8); transform: rotate(12deg); }
.cs-actions { display: flex; justify-content: center; gap: 28px; margin-top: 16px; }
.cs-round { width: 68px; height: 68px; border-radius: 99px; border: 0; background: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 10px 24px rgba(10,40,30,.16); }
.cs-round.nope { color: #E11D48; }
.cs-round.like { color: #fff; background: linear-gradient(135deg, #22C55E, #15803D); }
.cs-done { text-align: center; padding-top: 40px; }
.cs-done-ic { width: 72px; height: 72px; border-radius: 99px; margin: 0 auto 14px; display: grid; place-items: center; background: #E11D48; }
.cs-done h1 { font-size: 26px; margin: 0 0 6px; }
.cs-done p { color: #56655F; margin: 0; }
.cs-again { margin-top: 14px; border: 0; background: none; font: inherit; font-weight: 700; color: #0A3A2A; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.cs-center { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; }
`;
