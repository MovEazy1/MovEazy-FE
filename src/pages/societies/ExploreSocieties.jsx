/**
 * moveazy.co.in/societies — Explore societies: gated societies near the
 * tenant's office with a flat to rent, as a list or on a map. Each card: its
 * photos, Google rating, commute to office, amenities and who can rent, and
 * the flats free now with their price range. Only societies (MovEazy
 * Society), and only once the CRM switches it live (staff preview it).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Car, CheckCircle2, List, Map as MapIcon, Star, Users } from "lucide-react";
import { formatCommute } from "../../lib/commute";
import { fetchGooglePlace, googlePhotoUrl } from "../../lib/society";
import { useExploreSocieties } from "./useExplore";

const SocietiesMap = lazy(() => import("./SocietiesMap"));
export const kRange = (min, max) => {
  const k = (n) => (n >= 100000 ? `${(n / 100000).toFixed(1).replace(/\.0$/, "")}L` : `${Math.round(n / 1000)}k`);
  return min === max ? `₹${k(min)}` : `₹${k(min)}–${k(max)}`;
};

/** Google's rating (and its photos when the society has none of its own), live, cached a day. */
export function useGoogle(placeId) {
  const [g, setG] = useState(null);
  useEffect(() => {
    let alive = true;
    if (placeId) fetchGooglePlace(placeId).then((d) => { if (alive) setG(d); });
    return () => { alive = false; };
  }, [placeId]);
  return g;
}

export function societyPhotos(s, g) {
  const own = [...(s.photos ?? []), ...(s.flat_photos ?? [])].filter(Boolean);
  if (own.length) return { urls: own, google: false };
  return { urls: (g?.photos ?? []).slice(0, 5).map((p) => googlePhotoUrl(p.name, 900)), google: true };
}

function Rules({ rules }) {
  const r = rules || {};
  const who = [r.families && "Families", r.bachelors && "Bachelors"].filter(Boolean).join(" & ");
  return (
    <span className="ex-rules">
      {who && <span><Users size={13} /> {who}</span>}
      {r.pets && <span>Pets OK</span>}
      {r.veg_only && <span>Veg only</span>}
    </span>
  );
}

export function SocietyCard({ s, compact = false }) {
  const g = useGoogle(s.place_id);
  const { urls, google } = societyPhotos(s, g);
  const [at, setAt] = useState(0);
  return (
    <Link to={`/societies/${s.code}`} className={`ex-card${compact ? " ex-card--compact" : ""}`}>
      <div className="ex-photos">
        <div className="ex-strip" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {urls.length ? urls.slice(0, 6).map((u) => <img key={u} src={u} alt="" loading="lazy" />) : <div className="ex-noimg"><Building2 size={36} /></div>}
        </div>
        {urls.length > 1 && <span className="ex-dots">{urls.slice(0, 6).map((u, i) => <i key={u} className={i === at ? "on" : ""} />)}</span>}
        {g?.rating != null && <span className="ex-rating"><Star size={13} fill="#F5B524" color="#F5B524" /> {g.rating} <em>({g.ratings.toLocaleString("en-IN")})</em></span>}
        {s.inBudget && <span className="ex-fit"><CheckCircle2 size={13} /> In your budget</span>}
        {google && <span className="ex-attr">Photos: Google</span>}
      </div>
      <div className="ex-body">
        <div className="ex-row1">
          <b>{s.name}</b>
          <span className="ex-price">{kRange(s.min_rent, s.max_rent)}<em>/mo</em></span>
        </div>
        <div className="ex-meta">
          {s.area}
          {s.commute != null ? <span><Car size={14} /> {formatCommute(s.commute)} to office</span> : s.km != null ? <span>{s.km} km away</span> : null}
        </div>
        {!compact && (
          <>
            <div className="ex-flats">{s.flats} flat{s.flats === 1 ? "" : "s"} free · {(s.bhks ?? []).sort().join(", ")}</div>
            <div className="ex-am">{(s.amenities ?? []).slice(0, 4).map((a) => <span key={a}>{a}</span>)}{(s.amenities ?? []).length > 4 && <span>+{s.amenities.length - 4}</span>}</div>
            <Rules rules={s.rules} />
          </>
        )}
      </div>
    </Link>
  );
}

export default function ExploreSocieties() {
  const navigate = useNavigate();
  const { loading, live, prefs, societies, error } = useExploreSocieties();
  const [view, setView] = useState("list");

  if (!loading && live === false) {
    return (
      <div className="ex"><style>{CSS}</style>
        <div className="ex-wrap ex-soon"><h1>Societies are coming soon</h1><p>We&apos;re onboarding gated societies near you.</p><Link to="/" className="ex-btn">Back home</Link></div>
      </div>
    );
  }
  const office = prefs?.office?.label || prefs?.office?.display || "";
  return (
    <div className="ex">
      <style>{CSS}</style>
      <header className="ex-head">
        <div className="ex-wrap">
          <button type="button" className="ex-back" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={22} /></button>
          <p className="ex-kicker">Explore societies</p>
          <h1>Gated societies{office ? <> near <span>{String(office).split(",")[0]}</span></> : " in Bengaluru"}</h1>
          <p className="ex-lead">Verified societies with flats free right now — amenities, rules and real photos, listed by the society itself.</p>
          <div className="ex-toggle" role="tablist">
            <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}><List size={16} /> List</button>
            <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => setView("map")}><MapIcon size={16} /> Map</button>
          </div>
        </div>
      </header>
      <main className="ex-wrap">
        {error && <p style={{ color: "#B42318" }}>{error}</p>}
        {loading ? <div className="ex-skel">{[0, 1, 2].map((i) => <i key={i} />)}</div>
          : societies.length === 0 ? (
            <div className="ex-soon" style={{ padding: "40px 0" }}><h1 style={{ fontSize: 22 }}>No societies with free flats near you yet</h1><p>New societies join every week — check back soon.</p></div>
          ) : view === "list" ? (
            <div className="ex-grid">{societies.map((s) => <SocietyCard key={s.code} s={s} />)}</div>
          ) : (
            <Suspense fallback={<div className="ex-skel"><i /></div>}><SocietiesMap societies={societies} office={prefs?.office} /></Suspense>
          )}
      </main>
    </div>
  );
}

export const CSS = `
.ex { min-height: 100vh; background: #F6F3EC; color: #13201B; font-family: Manrope, Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.ex *, .ex *::before, .ex *::after { box-sizing: border-box; }
.ex-wrap { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
.ex-head { color: #fff; padding: 18px 0 26px; background: radial-gradient(90% 140% at 0% 0%, #13805D 0%, #0A5E44 40%, #063B2D 75%, #041F18 100%); position: relative; overflow: hidden; }
.ex-head::after { content: ""; position: absolute; right: -120px; top: -120px; width: 360px; height: 360px; border-radius: 50%; background: radial-gradient(circle, rgba(0,191,174,.35), transparent 65%); }
.ex-back { width: 40px; height: 40px; border-radius: 99px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.08); color: #fff; display: grid; place-items: center; cursor: pointer; }
.ex-kicker { margin: 18px 0 6px; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #7FE3D7; }
.ex-head h1 { font-size: clamp(26px, 5vw, 40px); line-height: 1.1; letter-spacing: -0.025em; margin: 0; max-width: 680px; position: relative; z-index: 1; }
.ex-head h1 span { color: #9FF0E4; }
.ex-lead { color: #CFE6DD; max-width: 560px; line-height: 1.5; margin: 10px 0 18px; position: relative; z-index: 1; }
.ex-toggle { display: inline-flex; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 99px; padding: 4px; position: relative; z-index: 1; }
.ex-toggle button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #DDEFE8; font: inherit; font-weight: 700; font-size: 14px; padding: 8px 16px; border-radius: 99px; cursor: pointer; }
.ex-toggle button.on { background: #fff; color: #063B2D; }
.ex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; padding: 20px 0 48px; }
.ex-card { display: block; background: #fff; border-radius: 22px; overflow: hidden; text-decoration: none; color: inherit; border: 1px solid #ECE6D8;
  box-shadow: 0 10px 30px rgba(10,40,30,.08); transition: transform .15s, box-shadow .15s; }
.ex-card:hover { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(10,40,30,.14); }
.ex-photos { position: relative; aspect-ratio: 16 / 11; background: #E7E1D2; }
.ex-strip { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; height: 100%; }
.ex-strip::-webkit-scrollbar { display: none; }
.ex-strip img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start; }
.ex-noimg { flex: 1; display: grid; place-items: center; color: #A59C87; }
.ex-dots { position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 5px; }
.ex-dots i { width: 6px; height: 6px; border-radius: 99px; background: rgba(255,255,255,.55); }
.ex-dots i.on { background: #fff; width: 16px; }
.ex-rating { position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,.95); color: #13201B;
  font-weight: 800; font-size: 13px; padding: 5px 10px; border-radius: 99px; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
.ex-rating em { font-style: normal; color: #6B746F; font-weight: 600; }
.ex-fit { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; gap: 4px; background: #0A6B4E; color: #fff; font-weight: 700; font-size: 12px; padding: 5px 10px; border-radius: 99px; }
.ex-attr { position: absolute; right: 10px; bottom: 8px; font-size: 10.5px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.ex-body { padding: 14px 16px 16px; display: grid; gap: 6px; }
.ex-row1 { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.ex-row1 b { font-size: 18px; letter-spacing: -0.01em; }
.ex-price { font-weight: 800; color: #0A6B4E; white-space: nowrap; }
.ex-price em { font-style: normal; color: #6B746F; font-weight: 600; font-size: 13px; }
.ex-meta { display: flex; gap: 10px; flex-wrap: wrap; color: #56625D; font-size: 14px; }
.ex-meta span { display: inline-flex; align-items: center; gap: 4px; color: #0A6B4E; font-weight: 700; }
.ex-flats { font-size: 13.5px; font-weight: 700; color: #2E3B36; }
.ex-am { display: flex; flex-wrap: wrap; gap: 6px; }
.ex-am span { font-size: 12px; font-weight: 600; padding: 4px 9px; border-radius: 99px; background: #F1EDE3; color: #4A4536; }
.ex-rules { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12.5px; color: #56625D; }
.ex-rules span { display: inline-flex; align-items: center; gap: 4px; }
.ex-card--compact .ex-photos { aspect-ratio: 16 / 8; }
.ex-skel { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; padding: 20px 0; }
.ex-skel i { height: 340px; border-radius: 22px; background: linear-gradient(90deg, #ECE7DB, #F5F1E8, #ECE7DB); background-size: 200% 100%; animation: exsk 1.2s infinite; }
@keyframes exsk { to { background-position: -200% 0; } }
.ex-soon { text-align: center; padding: 80px 16px; }
.ex-soon p { color: #56625D; }
.ex-btn { display: inline-block; margin-top: 12px; padding: 12px 22px; border-radius: 99px; background: #0A6B4E; color: #fff; font-weight: 700; text-decoration: none; }
`;
