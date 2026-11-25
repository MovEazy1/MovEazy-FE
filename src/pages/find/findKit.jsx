/**
 * What the /find pages share: the look (the home page's dark green band, white
 * cards, mint), the phone gate every option sits behind, and the deal card
 * (Steal Deals of the Week, Deal of the Day).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Heart, MapPin, Share2, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import RequirePhoneFirst from "../../components/RequirePhoneFirst";
import ThumbImg from "../../components/ThumbImg";
import MovEazyNav from "../../components/layout/MovEazyNav";
import { LandingStyles } from "../landing/landingKit";
import { SITE_CSS, SiteFooter } from "../home/homeKit";
import { hasLeadPhone } from "../../lib/leadIntake";
import { dealFacts, dealShareUrl, dealTrack } from "../../lib/deals";
import { CitySwitch } from "../../components/city/CityPicker";
import { cityBySlug, setSiteCity, useSiteCity } from "../../lib/cities";

/** A shared deals link names its city (?city=mumbai): open that one, remembered. Returns the city shown. */
export function useDealsCity() {
  useState(() => {
    const q = new URLSearchParams(window.location.search).get("city");
    if (q) setSiteCity(cityBySlug(q)?.name || q);
  });
  return useSiteCity().city;
}

/**
 * The number first, before any option (signed-in accounts go straight in).
 * Closing the gate goes back home. → { allowed, gate }.
 */
export function useFindGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasPhone, setHasPhone] = useState(() => hasLeadPhone());
  const allowed = Boolean(user) || hasPhone;
  const gate = (
    <RequirePhoneFirst
      open={!loading && !allowed}
      onDone={() => setHasPhone(true)}
      onClose={() => navigate("/")}
    />
  );
  return { allowed: !loading && allowed, gate };
}

/**
 * A deals page (Steal Deals, Deal of the Day — the links the team shares): the
 * flats show at once; the number is asked the first time someone opens a flat,
 * taps ♥ or books, and then what they tapped goes ahead. ♥ needs no sign-in.
 * Every open and ♥ is recorded for the team (lib/deals.js dealTrack).
 * → { gate, liked(id), toggle(id), open(id, { visit }) }.
 */
export function useDealActions(deal) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [known, setKnown] = useState(() => hasLeadPhone());
  const [pending, setPending] = useState(null); // the action waiting on the number
  const [likes, setLikes] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    dealTrack(deal, "page").then((r) => { if (alive && r?.likes) setLikes(new Set(r.likes)); });
    return () => { alive = false; };
  }, [deal]);
  const ask = (fn) => { if (known || user) fn(); else setPending(() => fn); };
  const toggle = (id) => ask(() => {
    const on = !likes.has(id);
    setLikes((cur) => { const next = new Set(cur); if (on) next.add(id); else next.delete(id); return next; });
    dealTrack(deal, on ? "like" : "unlike", id).then((r) => { if (r?.likes) setLikes(new Set(r.likes)); });
  });
  const open = (id, { visit = false } = {}) => ask(() => {
    dealTrack(deal, "open", id);
    navigate(`/property/${encodeURIComponent(id)}${visit ? "?visit=1" : ""}`);
  });
  const gate = (
    <RequirePhoneFirst
      open={Boolean(pending)}
      onDone={() => { setKnown(true); const fn = pending; setPending(null); fn?.(); }}
      onClose={() => setPending(null)}
    />
  );
  return { gate, liked: (id) => likes.has(id), toggle, open };
}

/** The page frame: nav, the green band with the title, the body, the footer. */
export function FindShell({ kicker, title, sub, aside = null, children }) {
  const navigate = useNavigate();
  return (
    <div className="lp lp--tenant th fd">
      <LandingStyles />
      <style>{SITE_CSS + FIND_CSS}</style>
      <MovEazyNav active="home" transparentAtTop onFindFlat={() => navigate("/find")} />
      <header className="fd-band">
        <div className="th-wrap fd-band-in">
          <div>
            {kicker && <p className="fd-kicker">{kicker}</p>}
            <h1 className="fd-h1">{title}</h1>
            {sub && <p className="fd-sub">{sub}</p>}
            {/* The city whose deals these are (lib/cities.js). */}
            <div style={{ marginTop: 12 }}><CitySwitch /></div>
          </div>
          {aside}
        </div>
      </header>
      <main className="th-wrap fd-main">{children}</main>
      <SiteFooter onFind={() => navigate("/find")} onList={() => navigate("/list-my-flat")} />
    </div>
  );
}

/** One deal: photo, type and area, rent, why it's a steal, and Schedule visit · Like · Share. */
export function DealCard({ deal, label = "Steal Deal", badge = null, likes }) {
  const { listing: l, reason, rented } = deal;
  const why = reason || dealFacts(l);
  const open = () => likes.open(l.id);
  return (
    <article className={`fd-deal${rented ? " fd-deal--gone" : ""}`}>
      <button type="button" className="fd-deal-photo" onClick={open} aria-label={`Open ${l.title}`}>
        {l.image ? <ThumbImg src={l.image} alt="" /> : <span className="fd-deal-nophoto">{l.bhk || "Flat"}</span>}
        {badge && <span className="fd-deal-badge">{badge}</span>}
        {rented && <span className="fd-deal-stamp">Rented — you missed it</span>}
      </button>
      <div className="fd-deal-body">
        <div className="fd-deal-top">
          <span className="fd-deal-type">{l.bhk || "Flat"}{l.furnishing ? ` · ${l.furnishing}` : ""}</span>
          <button type="button" className={`fd-like${likes?.liked(l.id) ? " is-on" : ""}`} onClick={() => likes?.toggle(l.id)}
            aria-label={likes?.liked(l.id) ? "Unlike" : "Like"} aria-pressed={Boolean(likes?.liked(l.id))}>
            <Heart size={18} fill={likes?.liked(l.id) ? "currentColor" : "none"} />
          </button>
        </div>
        <button type="button" className="fd-deal-title" onClick={open}>{l.title}</button>
        <p className="fd-deal-where"><MapPin size={14} /> {l.location || l.address || "Bengaluru"}</p>
        <p className="fd-deal-rent">{l.price || "Rent on request"}</p>
        {why && <p className="fd-deal-why"><Sparkles size={14} /> {why}</p>}
        <div className="fd-deal-acts">
          <button type="button" className="fd-btn fd-btn--go" disabled={rented}
            onClick={() => likes.open(l.id, { visit: true })}>
            <CalendarCheck size={16} /> {rented ? "Rented" : "Schedule visit"}
          </button>
          <a className="fd-btn fd-btn--wa" href={dealShareUrl(l, label)} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp">
            <Share2 size={16} /> Share
          </a>
        </div>
      </div>
    </article>
  );
}

/** BHK filter chips. */
/** Flat-type chips: tap as many types as you like; "All" (or none picked) shows every type. */
export function KindChips({ kinds, value = [], onChange, counts }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="fd-chips" role="group" aria-label="Flat type — pick one or more">
      <button type="button" className={`fd-chip${!value.length ? " is-on" : ""}`} aria-pressed={!value.length} onClick={() => onChange([])}>All · {counts.all}</button>
      {kinds.map((k) => (
        <button key={k.id} type="button" className={`fd-chip${value.includes(k.id) ? " is-on" : ""}`} aria-pressed={value.includes(k.id)}
          disabled={!counts[k.id]} onClick={() => toggle(k.id)}>
          {k.label} · {counts[k.id] || 0}
        </button>
      ))}
    </div>
  );
}

export const FIND_CSS = `
.fd-band { position: relative; overflow: hidden; color: #F1F6F4;
  background: radial-gradient(90% 80% at 80% 20%, #0B463D 0%, #052723 45%, #04211D 100%); }
.fd-band::after { content: ""; position: absolute; inset: auto -10% -40% 40%; height: 70%; background: radial-gradient(closest-side, rgba(94,234,212,.16), transparent); pointer-events: none; }
.fd-band-in { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-top: 118px; padding-bottom: 46px; }
.fd-kicker { font-size: 12.5px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #5EEAD4; margin: 0 0 12px; }
.fd-h1 { font-size: clamp(32px, 4.6vw, 56px); line-height: 1.04; letter-spacing: -.035em; font-weight: 800; margin: 0; color: #F1F6F4; }
.fd-sub { font-size: clamp(15px, 1.3vw, 18px); line-height: 1.5; color: #A9C2BC; max-width: 560px; margin: 14px 0 0; }
.fd-main { padding-top: 34px; padding-bottom: 72px; }
.fd-timer { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: rgba(94,234,212,.1);
  border: 1px solid rgba(94,234,212,.32); color: #5EEAD4; font-weight: 800; font-size: 15px; white-space: nowrap; }

.fd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 18px; }
.fd-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
.fd-sortnote { margin: 0 0 18px; font-size: 13px; font-weight: 600; color: var(--dim); }
.fd-chip { border: 1.5px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 9px 16px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; }
.fd-chip.is-on { background: #04211D; border-color: #04211D; color: #fff; }
.fd-chip:disabled { opacity: .45; cursor: default; }
.fd-empty { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 40px 24px; text-align: center; color: var(--dim); }
.fd-empty b { display: block; color: var(--ink); font-size: 19px; margin-bottom: 6px; }

.fd-deal { background: #fff; border: 1px solid var(--line); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 10px 28px rgba(4,33,29,.06); }
.fd-deal-photo { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; border: 0; padding: 0; margin: 0; background: #E7E1D2; cursor: pointer; overflow: hidden; }
.fd-deal-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fd-deal-nophoto { display: grid; place-items: center; height: 100%; font-weight: 800; color: #8A8270; }
.fd-deal-badge { position: absolute; top: 12px; left: 12px; background: #5EEAD4; color: #04211D; font-weight: 800; font-size: 12.5px; padding: 6px 11px; border-radius: 999px; }
.fd-deal-stamp { position: absolute; inset: auto 0 0 0; padding: 10px; text-align: center; font-weight: 800; color: #fff; background: rgba(185,28,28,.9); letter-spacing: .02em; }
.fd-deal--gone .fd-deal-photo img { filter: grayscale(.85); opacity: .75; }
.fd-deal-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.fd-deal-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fd-deal-type { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--acc); }
.fd-like { border: 0; background: #F4F2ED; color: #8A8270; width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; cursor: pointer; flex: none; }
.fd-like.is-on { color: #E11D48; background: #FFE4EA; }
.fd-deal-title { border: 0; background: none; padding: 0; text-align: left; font: inherit; font-size: 17.5px; font-weight: 800; color: var(--ink); cursor: pointer; line-height: 1.3; }
.fd-deal-where { display: flex; align-items: center; gap: 5px; margin: 0; color: var(--dim); font-size: 14px; }
.fd-deal-rent { margin: 4px 0 0; font-size: 22px; font-weight: 800; color: #04211D; }
.fd-deal-why { display: flex; gap: 7px; align-items: flex-start; margin: 2px 0 0; padding: 9px 11px; border-radius: 12px; background: #E4F6F1; color: #0E5E50; font-size: 13.5px; font-weight: 700; line-height: 1.4; }
.fd-deal-why svg { flex: none; margin-top: 2px; }
.fd-deal-acts { display: flex; gap: 8px; margin-top: auto; padding-top: 10px; }
.fd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 999px; font: inherit; font-weight: 800; font-size: 14.5px;
  min-height: 46px; padding: 0 16px; cursor: pointer; text-decoration: none; border: 0; }
.fd-btn--go { flex: 1; background: #04211D; color: #fff; }
.fd-btn--go:disabled { background: #C9C3B5; cursor: default; }
.fd-btn--wa { background: #E7F7EE; color: #128C4A; }

@media (max-width: 640px) {
  .fd-band-in { padding-top: 96px; padding-bottom: 32px; }
  .fd-main { padding-top: 22px; }
  .fd-grid { grid-template-columns: 1fr; }
}
`;
