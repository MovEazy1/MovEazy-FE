/**
 * A broker's storefront — moveazy.co.in/b/<code>, what their QR poster opens.
 *
 * The broker (photo, rating, number) and every flat they have live on
 * MovEazy. Anyone can look; a visit is counted for the broker. Signing in
 * lets a tenant like a flat — which the broker sees, with the tenant's name
 * and number, and the page says so next to the hearts — and rate the broker.
 * A heart tapped while signed out is remembered through the Google round trip.
 *
 * QR leads (lib/qrLeads.js, partner_qr_leads.sql): signed in with a mobile
 * number, the tenant checks in — asked once for their location — and becomes
 * the broker's lead, with a tentative requirement from what they looked at
 * here. "Schedule visit" on a flat (here, or on the flat's own page opened from
 * here, which comes back with ?visit=<id>) asks the broker for a visit and
 * shows "you'll be contacted soon" with WhatsApp / Call / their other flats.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BadgeCheck, CalendarCheck, CheckCircle2, Heart, LocateFixed, MapPin, Phone, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SmartListingImage } from "./partners/partnerMedia";
import { WhatsAppIcon } from "./partners/partnerUi";
import { inr, telLink, waLink } from "../lib/partners";
import { fetchStorefront, likeStorefrontHome, rateStorefront, recordStorefrontView, storefrontDisplay } from "../lib/storefront";
import { formatMobile } from "../lib/qrPoster";
import { checkinStorefront, currentPosition, noteBrowse, readBrowse, requestStorefrontVisit, visitMessage } from "../lib/qrLeads";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";
import logoOnLight from "../assets/logo/moveazy-logo-mint-light.png";

const PENDING_KEY = "mz_storefront_pending";
const FROM_KEY = (code) => `mz_qr_from:${code}`;
const LOC_KEY = (code) => `mz_qr_loc:${code}`;
const sGet = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const sSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private tab */ } };

/** Location already allowed for this site: read it without asking again. */
async function locationGranted() {
  try { return (await navigator.permissions?.query({ name: "geolocation" }))?.state === "granted"; } catch { return false; }
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "The broker";
const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";

function readPending(code) {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    return p && p.code === code ? p : null;
  } catch {
    return null;
  }
}

export default function Storefront() {
  const { code: rawCode = "" } = useParams();
  const code = rawCode.toUpperCase();
  const [params] = useSearchParams();
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const [data, setData] = useState(undefined); // undefined: loading · null: no such storefront
  const [liked, setLiked] = useState(() => new Set());
  const [myRating, setMyRating] = useState(0);
  const [rating, setRating] = useState({ rating: null, ratings: 0, fromTenants: false });
  const [filter, setFilter] = useState("all");
  const [note, setNote] = useState("");
  const counted = useRef(false);
  const uid = user?.id || "";
  const hasPhone = Boolean(String(user?.phone || "").trim());
  const [visitDone, setVisitDone] = useState(null); // the thank-you page: { broker, home }
  const [locAsk, setLocAsk] = useState(false);
  const [requested, setRequested] = useState(() => new Set(readBrowse(code).visits));
  const locAnswer = useRef(null);
  const queue = useRef(null); // a flat to ask a visit for, once signed in with a number
  const checked = useRef(false);
  const running = useRef(false);

  // Where they came from (the QR, which poster spot) outlives the Google round trip.
  const [from] = useState(() => {
    const s = params.get("s"), p = params.get("p");
    if (s || p) { sSet(FROM_KEY(code), JSON.stringify({ s: s || "", p: p || "" })); return { s: s || "", p: p || "" }; }
    try { return JSON.parse(sGet(FROM_KEY(code)) || "null") || { s: "", p: "" }; } catch { return { s: "", p: "" }; }
  });

  const noteTimer = useRef(0);
  const say = useCallback((t) => {
    setNote(t);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(""), 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await fetchStorefront(code);
      setData(d || null);
      if (d) {
        setLiked(new Set(d.liked || []));
        setMyRating(d.my_rating || 0);
        setRating({ rating: d.broker?.rating, ratings: Number(d.broker?.ratings) || 0, fromTenants: Boolean(d.broker?.from_tenants) });
      }
      return d;
    } catch {
      setData(null);
      return null;
    }
  }, [code]);

  // Load (again once auth settles, so a signed-in tenant sees their own hearts).
  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    (async () => {
      const d = await load();
      if (!alive || !d) return;
      if (!counted.current) {
        counted.current = true;
        recordStorefrontView(code, params.get("s"), params.get("p"));
      }
      // A heart, rating or visit tapped before signing in, finished now.
      const pending = uid ? readPending(code) : null;
      if (pending) {
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
        if (pending.visit) queue.current = pending.visit;
        try {
          if (pending.like) {
            await likeStorefrontHome(code, pending.like, true);
            setLiked((s) => new Set(s).add(pending.like));
            say(`Liked. ${firstName(d.broker?.name)} will reach out.`);
          }
          if (pending.stars) {
            const r = await rateStorefront(code, pending.stars);
            setMyRating(pending.stars);
            setRating({ rating: r?.rating, ratings: Number(r?.ratings) || 0, fromTenants: Boolean(r?.from_tenants) });
            say("Thanks for rating.");
          }
        } catch (e) {
          say(e?.message || "That didn't go through. Please try again.");
        }
      }
    })();
    return () => { alive = false; };
  }, [authLoading, uid, code, load, params, say]);

  const signInFor = async (pending) => {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ code, ...pending })); } catch { /* ignore */ }
    const res = await loginWithGoogle();
    if (!res?.success) say(res?.error || "Google sign-in failed. Please try again.");
  };

  const toggleLike = async (pid) => {
    if (!uid) { signInFor({ like: pid }); return; }
    const on = !liked.has(pid);
    setLiked((s) => { const n = new Set(s); if (on) n.add(pid); else n.delete(pid); return n; });
    try {
      await likeStorefrontHome(code, pid, on);
      if (on) {
        say(`Liked. ${firstName(data?.broker?.name)} will reach out.`);
        const browse = noteBrowse(code, "opened", pid);
        if (hasPhone) checkinStorefront(code, { spot: from.p, source: from.s, browse }).catch(() => {});
      }
    } catch (e) {
      setLiked((s) => { const n = new Set(s); if (on) n.delete(pid); else n.add(pid); return n; });
      say(e?.message || "Could not save that. Please try again.");
    }
  };

  const rate = async (stars) => {
    if (!uid) { signInFor({ stars }); return; }
    const before = myRating;
    setMyRating(stars);
    try {
      const r = await rateStorefront(code, stars);
      setRating({ rating: r?.rating, ratings: Number(r?.ratings) || 0, fromTenants: Boolean(r?.from_tenants) });
      say("Thanks for rating.");
    } catch (e) {
      setMyRating(before);
      say(e?.message || "Could not save your rating.");
    }
  };

  /** Asks once (this tab) before the browser's own location prompt. → { lat, lng, accuracy } or null */
  const askLocation = useCallback(async () => {
    if (sGet(LOC_KEY(code))) return (await locationGranted()) ? currentPosition() : null;
    sSet(LOC_KEY(code), "1");
    if (await locationGranted()) return currentPosition();
    setLocAsk(true);
    return new Promise((resolve) => { locAnswer.current = resolve; });
  }, [code]);
  const answerLocation = async (allow) => {
    setLocAsk(false);
    const done = locAnswer.current;
    locAnswer.current = null;
    done?.(allow ? await currentPosition() : null);
  };

  const sendVisit = useCallback(async (pid) => {
    const browse = noteBrowse(code, "visits", pid);
    try {
      const r = await requestStorefrontVisit(code, pid, browse);
      setRequested(new Set(browse.visits));
      setVisitDone(r);
      window.scrollTo(0, 0);
    } catch (e) {
      say(e?.message || "That didn't go through. Please try again.");
    }
  }, [code, say]);

  // Signed in with a number: check in once (their lead), then any visit waiting.
  const ready = Boolean(data && !data.is_mine && uid && hasPhone);
  const pump = useCallback(async () => {
    if (!ready || running.current) return;
    running.current = true;
    try {
      if (!checked.current) {
        checked.current = true;
        const position = await askLocation();
        await checkinStorefront(code, { spot: from.p, source: from.s, position, browse: readBrowse(code) }).catch(() => {});
      }
      while (queue.current) {
        const pid = queue.current;
        queue.current = null;
        await sendVisit(pid);
      }
    } finally {
      running.current = false;
    }
  }, [ready, askLocation, code, from, sendVisit]);
  useEffect(() => { pump(); }, [pump]);

  // Back from a flat's own page with "Schedule visit" tapped there.
  const visitParam = params.get("visit") || "";
  const visitParamDone = useRef(false);
  useEffect(() => {
    if (!visitParam || visitParamDone.current || authLoading || !data) return;
    visitParamDone.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (data.is_mine) return;
    if (!uid) signInFor({ visit: visitParam });
    else { queue.current = visitParam; pump(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitParam, authLoading, data]);

  const scheduleVisit = (pid) => {
    if (!uid) { signInFor({ visit: pid }); return; }
    queue.current = pid;
    if (!hasPhone) return; // the mobile-number screen is up; the visit goes once it's saved
    pump();
  };

  const homes = useMemo(() => data?.homes ?? [], [data]);
  const types = useMemo(() => [...new Set(homes.map((h) => h.flat_type).filter(Boolean))].sort(), [homes]);
  const shown = filter === "all" ? homes : homes.filter((h) => h.flat_type === filter);

  if (data === undefined) {
    return <div className="sf"><style>{CSS}</style><div className="sf-load"><span /></div></div>;
  }
  if (data === null) {
    return (
      <div className="sf">
        <style>{CSS}</style>
        <div className="sf-col sf-missing">
          <img src={logoOnLight} alt="MovEazy" height="30" className="sf-logo-light" />
          <h1>This QR isn’t active.</h1>
          <p>The broker may have moved on — but verified homes are still a tap away.</p>
          <Link className="sf-btn sf-btn--ink" to="/">Find a home on MovEazy</Link>
        </div>
      </div>
    );
  }

  const b = data.broker || {};
  const wa = waLink(b.phone, `Hi ${firstName(b.name)}, I found your homes on MovEazy (${storefrontDisplay(code)}). I'm looking for a flat.`);

  return (
    <div className="sf">
      <style>{CSS}</style>
      <header className="sf-hero">
        <div className="sf-col">
          <Link to="/" aria-label="MovEazy home"><img src={logoOnDark} alt="MovEazy" height="24" className="sf-logo" /></Link>
          {data.is_mine && <div className="sf-mine">This is your storefront — tenants who scan your QR see this page.</div>}
          <div className="sf-who">
            {b.photo_url
              ? <img className="sf-photo" src={b.photo_url} alt={b.name} width="84" height="84" />
              : <span className="sf-photo sf-photo--none" aria-hidden>{initials(b.name)}</span>}
            <div style={{ minWidth: 0 }}>
              <h1>{b.name}</h1>
              {b.agency && <p className="sf-agency">{b.agency}</p>}
              <p className="sf-rating">
                {Number(rating.rating) > 0
                  ? <><Star size={15} fill="#E4B659" color="#E4B659" /> <b>{Number(rating.rating).toFixed(1)}</b>{rating.fromTenants ? ` · ${rating.ratings} ratings` : ""}</>
                  : <span className="sf-new">New on MovEazy</span>}
              </p>
              <span className="sf-badge"><BadgeCheck size={13} /> Verified MovEazy partner</span>
            </div>
          </div>
          <p className="sf-count"><MapPin size={14} /> {homes.length} home{homes.length === 1 ? "" : "s"} listed</p>
          {b.phone && (
            <div className="sf-contact">
              <a className="sf-btn sf-btn--wa" href={wa} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
              <a className="sf-btn sf-btn--ghost" href={telLink(b.phone)}><Phone size={17} /> {formatMobile(b.phone)}</a>
            </div>
          )}
        </div>
      </header>

      <main className="sf-col sf-main">
        {visitDone ? (
          <VisitRequested result={visitDone} fallbackPhone={b.phone} onBack={() => { setVisitDone(null); window.scrollTo(0, 0); }} />
        ) : homes.length > 0 ? (
          <>
            <div className="sf-chips" role="tablist" aria-label="Filter by size">
              {[["all", `All ${homes.length}`], ...types.map((t) => [t, t])].map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={filter === v} className={`sf-chip${filter === v ? " on" : ""}`} onClick={() => { setFilter(v); noteBrowse(code, "filters", v); }}>{l}</button>
              ))}
            </div>
            <p className="sf-disclose"><Heart size={13} fill="#E11D48" color="#E11D48" /> Like a home and {firstName(b.name)} sees your name and number, so they can call you.</p>
            <div className="sf-grid">
              {shown.map((h) => {
                const on = liked.has(h.property_id);
                return (
                  <article key={h.property_id} className="sf-card">
                    <Link to={`/property/${h.property_id}?sf=${code}`} onClick={() => noteBrowse(code, "opened", h.property_id)} className="sf-img" aria-label={`${h.flat_type || "Home"} in ${h.area || "Bengaluru"}`}>
                      <SmartListingImage listing={h} />
                    </Link>
                    <button type="button" className={`sf-heart${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? "Unlike" : "Like"} onClick={() => toggleLike(h.property_id)}>
                      <Heart size={19} fill={on ? "#E11D48" : "none"} color={on ? "#E11D48" : "#111827"} />
                    </button>
                    <Link to={`/property/${h.property_id}?sf=${code}`} onClick={() => noteBrowse(code, "opened", h.property_id)} className="sf-body">
                      <div className="sf-rent">{inr(h.rent)} <small>/ month</small></div>
                      <div className="sf-line">{[h.flat_type, h.area].filter(Boolean).join(" · ")}</div>
                      <div className="sf-meta">{[h.furnishing, h.property_type].filter(Boolean).join(" · ")}</div>
                    </Link>
                    {!data.is_mine && (
                      <button type="button" className={`sf-visit${requested.has(h.property_id) ? " on" : ""}`} onClick={() => scheduleVisit(h.property_id)}>
                        {requested.has(h.property_id) ? <><CheckCircle2 size={17} /> Visit requested</> : <><CalendarCheck size={17} /> Schedule visit</>}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="sf-empty">
            <h2>{firstName(b.name)} is adding homes.</h2>
            <p>Message them for what’s available, or browse verified homes on MovEazy.</p>
            <Link className="sf-btn sf-btn--ink" to="/">Browse homes</Link>
          </div>
        )}

        {!data.is_mine && (
          <section className="sf-rate">
            <h2>Rate {firstName(b.name)}</h2>
            <div className="sf-stars" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={myRating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => rate(n)}>
                  <Star size={30} fill={n <= myRating ? "#E4B659" : "none"} color={n <= myRating ? "#E4B659" : "#C9C3B3"} />
                </button>
              ))}
            </div>
            <p className="sf-meta">{myRating ? "Thanks — tap to change it." : uid ? "Tap a star." : "Sign in with Google to rate."}</p>
          </section>
        )}

        <footer className="sf-foot">
          <img src={logoOnLight} alt="MovEazy" height="22" className="sf-logo-light" />
          <p>Verified rental homes in Bengaluru. <Link to="/">Find more homes</Link> · <a href="https://www.moveazy.co.in/terms">Terms</a></p>
        </footer>
      </main>

      {note && <div className="sf-toast" role="status">{note}</div>}
      {locAsk && (
        <div className="sf-sheet-bg" role="presentation">
          <div className="sf-sheet" role="dialog" aria-modal="true" aria-label="Share your location">
            <span className="sf-sheet-icon" aria-hidden><LocateFixed size={26} /></span>
            <h2>Find homes near you</h2>
            <p>Share where you are so {firstName(b.name)} can suggest flats close by. It&apos;s only used to find you nearby homes.</p>
            <button type="button" className="sf-btn sf-btn--deep" onClick={() => answerLocation(true)}>Allow location</button>
            <button type="button" className="sf-btn sf-btn--plain" onClick={() => answerLocation(false)}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "You'll be contacted soon" — after asking for a visit. */
function VisitRequested({ result, fallbackPhone, onBack }) {
  const broker = result?.broker || {};
  const home = result?.home || {};
  const phone = broker.phone || fallbackPhone;
  const first = firstName(broker.name);
  const flat = [home.flat_type, home.area].filter(Boolean).join(" in ");
  return (
    <section className="sf-done" aria-live="polite">
      <span className="sf-done-icon" aria-hidden><CheckCircle2 size={34} /></span>
      <h2>Visit requested</h2>
      <p>
        {first} will contact you soon to fix a time{flat ? <> for the <b>{flat}</b>{Number(home.rent) > 0 ? <> · {inr(home.rent)}/month</> : null}</> : null}.
      </p>
      {phone && (
        <div className="sf-done-actions">
          <a className="sf-btn sf-btn--wa" href={waLink(phone, visitMessage(broker.name, home, inr))} target="_blank" rel="noreferrer">
            <WhatsAppIcon /> WhatsApp {first} about this flat
          </a>
          <a className="sf-btn sf-btn--line" href={telLink(phone)}><Phone size={17} /> Call {formatMobile(phone)}</a>
        </div>
      )}
      <button type="button" className="sf-btn sf-btn--plain" onClick={onBack}>See {first}&apos;s other flats</button>
    </section>
  );
}

const CSS = `
.sf { --deep:#0A3A2A; --deep2:#05241A; --gold:#E4B659; --gold2:#F7E9C6; --ink:#13201B; --dim:#56655F; --line:#E6E2D6; --cream:#F7F5EE;
  min-height: 100vh; min-height: 100dvh; background: var(--cream); color: var(--ink); font-family: Manrope, Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.sf *, .sf *::before, .sf *::after { box-sizing: border-box; }
.sf-col { width: 100%; max-width: 760px; margin: 0 auto; padding: 0 16px; }
.sf-load { min-height: 100dvh; display: grid; place-items: center; }
.sf-load span { width: 34px; height: 34px; border-radius: 99px; border: 3px solid var(--line); border-top-color: var(--deep); animation: sfspin .8s linear infinite; }
@keyframes sfspin { to { transform: rotate(360deg); } }
.sf-hero { background: radial-gradient(120% 100% at 0% 0%, #1B6B4E, var(--deep) 55%, var(--deep2)); color: #fff; padding: 18px 0 22px; }
.sf .sf-logo { height: 24px; width: auto; display: block; }
.sf .sf-logo-light { height: 22px; width: auto; display: block; }
.sf-mine { margin-top: 14px; font-size: 13px; background: rgba(228,182,89,.16); color: var(--gold); border-radius: 12px; padding: 9px 12px; font-weight: 700; }
.sf-who { display: flex; gap: 16px; align-items: center; margin-top: 20px; }
.sf .sf-photo { width: 84px; height: 84px; border-radius: 99px; object-fit: cover; border: 3px solid var(--gold); flex: none; background: var(--gold2); }
.sf-photo--none { display: grid; place-items: center; font-size: 30px; font-weight: 800; color: #8A6419; }
.sf-who h1 { margin: 0; font-size: 25px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 800; color: #fff; }
.sf-agency { margin: 2px 0 0; font-size: 14px; opacity: .75; }
.sf-rating { margin: 6px 0 0; display: flex; align-items: center; gap: 5px; font-size: 14px; }
.sf-new { opacity: .75; }
.sf-badge { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 12px; font-weight: 800; color: #1F1605; background: var(--gold); border-radius: 99px; padding: 3px 9px; }
.sf-count { display: flex; align-items: center; gap: 6px; margin: 16px 0 0; font-size: 14px; opacity: .85; }
.sf-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.sf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border-radius: 14px; font-weight: 800; font-size: 15px; text-decoration: none; border: 1px solid transparent; padding: 0 16px; cursor: pointer; }
.sf-btn--wa { background: #22C55E; color: #fff; }
.sf-btn--ghost { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.3); color: #fff; }
.sf-btn--ink { background: var(--ink); color: #fff; margin-top: 18px; }
.sf-main { padding-top: 16px; padding-bottom: 40px; }
.sf-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.sf-chips::-webkit-scrollbar { display: none; }
.sf-chip { flex: none; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 99px; padding: 8px 14px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.sf-chip.on { background: var(--deep); border-color: var(--deep); color: #fff; }
.sf-disclose { display: flex; align-items: center; gap: 6px; margin: 12px 0 14px; font-size: 12.5px; color: var(--dim); }
.sf-grid { display: grid; gap: 14px; }
@media (min-width: 640px) { .sf-grid { grid-template-columns: 1fr 1fr; } }
.sf-card { position: relative; background: #fff; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); }
.sf-img { display: block; height: 210px; overflow: hidden; background: #E5E7EB; position: relative; }
.sf-img img, .sf-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.sf-heart { position: absolute; top: 10px; right: 10px; width: 42px; height: 42px; border-radius: 99px; border: 0; background: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,.18); }
.sf-heart.on { animation: sfpop .35s ease; }
@keyframes sfpop { 50% { transform: scale(1.18); } }
.sf-body { display: block; padding: 12px 14px 14px; color: inherit; text-decoration: none; }
.sf-rent { font-size: 21px; font-weight: 800; letter-spacing: -0.01em; }
.sf-rent small { font-size: 13px; font-weight: 600; color: var(--dim); }
.sf-line { font-size: 15px; font-weight: 700; margin-top: 2px; }
.sf-meta { font-size: 13px; color: var(--dim); margin-top: 2px; }
.sf-empty { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px 20px; text-align: center; }
.sf-empty h2, .sf-rate h2 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: -0.01em; }
.sf-empty p { color: var(--dim); margin: 6px 0 0; }
.sf-rate { margin-top: 22px; background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 18px; text-align: center; }
.sf-stars { display: flex; justify-content: center; gap: 4px; margin-top: 8px; }
.sf-stars button { border: 0; background: none; padding: 4px; cursor: pointer; }
.sf-foot { margin-top: 28px; display: grid; justify-items: center; gap: 6px; text-align: center; font-size: 13px; color: var(--dim); }
.sf-foot p { margin: 0; }
.sf-foot a { color: var(--deep); font-weight: 700; }
.sf-missing { min-height: 100dvh; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
.sf-missing h1 { font-size: 30px; margin: 22px 0 6px; letter-spacing: -0.02em; }
.sf-missing p { color: var(--dim); margin: 0; }
.sf-visit { display: flex; width: calc(100% - 28px); margin: 0 14px 14px; align-items: center; justify-content: center; gap: 8px; min-height: 46px;
  border-radius: 12px; border: 0; background: var(--deep); color: #fff; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
.sf-visit.on { background: #E7F3EC; color: var(--deep); }
.sf-btn--deep { background: var(--deep); color: #fff; width: 100%; }
.sf-btn--plain { background: transparent; color: var(--deep); width: 100%; }
.sf-btn--line { background: #fff; color: var(--ink); border-color: var(--line); }
.sf-done { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 26px 18px 14px; text-align: center; }
.sf-done-icon { display: inline-grid; place-items: center; width: 62px; height: 62px; border-radius: 99px; background: #E7F3EC; color: #15803D; }
.sf-done h2 { margin: 12px 0 4px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.sf-done p { margin: 0 auto; max-width: 420px; color: var(--dim); font-size: 15px; line-height: 1.5; }
.sf-done p b { color: var(--ink); }
.sf-done-actions { display: grid; gap: 10px; margin: 18px 0 6px; }
.sf-sheet-bg { position: fixed; inset: 0; z-index: 60; background: rgba(5,36,26,.55); display: flex; align-items: flex-end; justify-content: center; }
.sf-sheet { width: 100%; max-width: 480px; background: #fff; border-radius: 22px 22px 0 0; padding: 22px 18px calc(16px + env(safe-area-inset-bottom)); text-align: center; }
.sf-sheet-icon { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 99px; background: #E7F3EC; color: var(--deep); }
.sf-sheet h2 { margin: 10px 0 4px; font-size: 20px; font-weight: 800; }
.sf-sheet p { margin: 0 0 16px; color: var(--dim); font-size: 14.5px; line-height: 1.5; }
.sf-toast { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom)); transform: translateX(-50%); background: var(--ink); color: #fff;
  padding: 12px 16px; border-radius: 14px; font-size: 14px; font-weight: 700; box-shadow: 0 14px 30px rgba(0,0,0,.25); z-index: 50; max-width: calc(100% - 32px); }
`;
