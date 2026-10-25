/**
 * moveazy.co.in/societies/<code> — one society, for a tenant: its photos and
 * Google rating, commute to their office, amenities, who can rent, charges,
 * and every flat free right now (each opens its own page: like it, book a
 * visit). Roughly where it is on the map — never the gate.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, Building2, CalendarDays, Car, CheckCircle2, IndianRupee, Layers, MapPin, Star, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchBuildingPage } from "../../lib/buildings";
import { commuteMinutes, formatCommute } from "../../lib/commute";
import { fetchSocietyPublic, rupees } from "../../lib/society";
import { coverPhoto } from "../../lib/listingMedia";

// A flat's photo — a video as its first file would draw as a broken image.
const flatPhoto = (f) => coverPhoto([f.cover_image_url, ...(f.images ?? [])]);
import { fetchUserRequirement, rowToPrefs } from "../../lib/userRequirements";
import { CSS as EX_CSS, societyPhotos, useGoogle } from "./ExploreSocieties";

const ApproxMap = lazy(() => import("../curated/ApproxMap"));

export default function SocietyPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [b, setB] = useState(undefined);
  const [extra, setExtra] = useState(null);
  const [office, setOffice] = useState(null);
  const g = useGoogle(extra?.place_id);
  const [at, setAt] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchBuildingPage(code), fetchSocietyPublic(code)]).then(([page, pub]) => {
      if (!alive) return;
      setB(page && pub ? page : null);
      setExtra(pub);
    }, () => { if (alive) setB(null); });
    return () => { alive = false; };
  }, [code]);
  useEffect(() => {
    if (user?.uid) fetchUserRequirement(user.uid).then((r) => setOffice(rowToPrefs(r)?.office ?? null));
  }, [user?.uid]);

  if (b === undefined) return <div className="ex"><style>{EX_CSS}</style><div className="ex-wrap ex-skel"><i /></div></div>;
  if (b === null) {
    return <div className="ex"><style>{EX_CSS}</style><div className="ex-soon"><h1>This society isn&apos;t listed right now</h1><Link to="/societies" className="ex-btn">Explore societies</Link></div></div>;
  }

  const flats = (b.flats ?? []).filter((f) => f.available);
  const { urls, google } = societyPhotos({ photos: b.photos, flat_photos: flats.map(flatPhoto).filter(Boolean) }, g);
  const commute = office?.lat != null ? commuteMinutes(office, { lat: b.latitude, lng: b.longitude }) : null;
  const r = extra?.rules || {};
  const facts = [
    extra?.towers ? [Layers, `${extra.towers} tower${extra.towers === 1 ? "" : "s"}`] : null,
    b.total_floors ? [Building2, `${b.total_floors} floors`] : null,
    extra?.total_flats ? [BedDouble, `${extra.total_flats} homes`] : null,
    extra?.year_built ? [CalendarDays, `Built ${extra.year_built}`] : null,
    extra?.maintenance ? [IndianRupee, `${rupees(extra.maintenance)}/mo maintenance`] : null,
  ].filter(Boolean);

  return (
    <div className="ex sp">
      <style>{EX_CSS + CSS}</style>
      <div className="sp-hero">
        <div className="ex-strip" onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {urls.length ? urls.map((u) => <img key={u} src={u} alt="" />) : <div className="ex-noimg"><Building2 size={48} /></div>}
        </div>
        <button type="button" className="ex-back sp-back" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={22} /></button>
        {urls.length > 1 && <span className="ex-dots">{urls.map((u, i) => <i key={u} className={i === at ? "on" : ""} />)}</span>}
        {google && <span className="ex-attr">Photos: Google</span>}
      </div>
      <main className="ex-wrap sp-main">
        <div className="sp-titlebox">
          <p className="ex-kicker" style={{ color: "#0A6B4E", margin: 0 }}>Gated society</p>
          <h1>{b.name}</h1>
          <p className="sp-where"><MapPin size={16} /> {[b.area, b.landmark].filter(Boolean).join(" · ")}</p>
          <div className="sp-chips">
            {g?.rating != null && <span className="sp-chip"><Star size={14} fill="#F5B524" color="#F5B524" /> {g.rating} · {g.ratings.toLocaleString("en-IN")} Google reviews</span>}
            {commute != null && <span className="sp-chip sp-chip--em"><Car size={14} /> {formatCommute(commute)} to your office</span>}
            <span className="sp-chip"><CheckCircle2 size={14} /> Listed by the society</span>
          </div>
        </div>

        {facts.length > 0 && <div className="sp-facts">{facts.map(([Icon, t]) => <span key={t}><Icon size={17} /> {t}</span>)}</div>}

        <section className="sp-sec">
          <h2>Flats free now · {flats.length}</h2>
          <div className="sp-flats">
            {flats.map((f) => (
              <Link key={f.property_id} to={`/property/${f.property_id}`} className="sp-flat">
                <span className="sp-fimg">{flatPhoto(f) ? <img src={flatPhoto(f)} alt="" loading="lazy" /> : (urls[0] ? <img src={urls[0]} alt="" /> : <Building2 size={28} />)}</span>
                <span className="sp-fbody">
                  <b>{rupees(f.rent)}<em>/month</em></b>
                  <span>{[f.flat_type, f.furnishing, f.area_sqft ? `${f.area_sqft} sq ft` : ""].filter(Boolean).join(" · ")}</span>
                  {f.available_from && <small>Available {new Date(f.available_from) <= new Date() ? "now" : `from ${new Date(f.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}</small>}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {(b.amenities ?? []).length > 0 && (
          <section className="sp-sec"><h2>Amenities</h2><div className="sp-am">{b.amenities.map((a) => <span key={a}><CheckCircle2 size={15} /> {a}</span>)}</div></section>
        )}

        <section className="sp-sec">
          <h2>Who can rent</h2>
          <div className="sp-rules">
            <span className={r.families ? "y" : "n"}><Users size={15} /> Families</span>
            <span className={r.bachelors ? "y" : "n"}><Users size={15} /> Bachelors</span>
            <span className={r.pets ? "y" : "n"}>Pets</span>
            {r.veg_only && <span className="y">Vegetarian only</span>}
          </div>
          {r.notes && <p className="sp-note">{r.notes}</p>}
        </section>

        {b.description && <section className="sp-sec"><h2>About</h2><p className="sp-note">{b.description}</p></section>}

        {b.latitude != null && (
          <section className="sp-sec">
            <h2>Where</h2>
            <div className="sp-map"><Suspense fallback={null}><ApproxMap lat={Number(b.latitude)} lng={Number(b.longitude)} /></Suspense></div>
            <p className="sp-note" style={{ fontSize: 13 }}>Approximate area. The exact address is shared when you book a visit.</p>
          </section>
        )}
      </main>
    </div>
  );
}

const CSS = `
.sp-hero { position: relative; height: min(56vh, 460px); background: #E7E1D2; }
.sp-hero .ex-strip img { height: 100%; }
.sp-back { position: absolute; top: 14px; left: 14px; background: rgba(0,0,0,.35); }
.sp-main { position: relative; margin-top: -40px; padding-bottom: 60px; }
.sp-titlebox { background: #fff; border-radius: 24px; padding: 20px; box-shadow: 0 16px 40px rgba(10,40,30,.12); border: 1px solid #ECE6D8; }
.sp-titlebox h1 { font-size: clamp(26px, 5vw, 38px); margin: 4px 0 6px; letter-spacing: -0.025em; }
.sp-where { display: flex; align-items: center; gap: 6px; color: #56625D; margin: 0; }
.sp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.sp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 99px; background: #F3EFE6; font-weight: 700; font-size: 13.5px; }
.sp-chip--em { background: #E3F4EC; color: #0A6B4E; }
.sp-facts { display: flex; flex-wrap: wrap; gap: 10px 20px; margin: 18px 4px 0; color: #3D4A45; font-weight: 600; }
.sp-facts span { display: inline-flex; align-items: center; gap: 6px; }
.sp-facts svg { color: #0A6B4E; }
.sp-sec { margin-top: 28px; }
.sp-sec h2 { font-size: 20px; margin: 0 0 12px; letter-spacing: -0.01em; }
.sp-flats { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.sp-flat { display: flex; gap: 12px; background: #fff; border-radius: 18px; padding: 10px; border: 1px solid #ECE6D8; text-decoration: none; color: inherit; box-shadow: 0 6px 18px rgba(10,40,30,.06); }
.sp-fimg { width: 110px; height: 90px; border-radius: 12px; overflow: hidden; flex: none; background: #E7E1D2; display: grid; place-items: center; color: #A59C87; }
.sp-fimg img { width: 100%; height: 100%; object-fit: cover; }
.sp-fbody { display: flex; flex-direction: column; gap: 3px; min-width: 0; justify-content: center; }
.sp-fbody b { font-size: 18px; }
.sp-fbody b em { font-style: normal; font-size: 13px; color: #6B746F; font-weight: 600; }
.sp-fbody span { color: #3D4A45; font-size: 14px; }
.sp-fbody small { color: #0A6B4E; font-weight: 700; font-size: 12.5px; }
.sp-am { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.sp-am span { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #ECE6D8; border-radius: 12px; padding: 11px 12px; font-weight: 600; font-size: 14px; }
.sp-am svg { color: #0A6B4E; flex: none; }
.sp-rules { display: flex; flex-wrap: wrap; gap: 8px; }
.sp-rules span { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 99px; font-weight: 700; font-size: 14px; }
.sp-rules .y { background: #E3F4EC; color: #0A6B4E; }
.sp-rules .n { background: #F3EFE6; color: #8A8270; text-decoration: line-through; }
.sp-note { color: #3D4A45; line-height: 1.55; white-space: pre-line; margin: 10px 0 0; }
.sp-map { height: 240px; border-radius: 18px; overflow: hidden; border: 1px solid #ECE6D8; isolation: isolate; }
`;
