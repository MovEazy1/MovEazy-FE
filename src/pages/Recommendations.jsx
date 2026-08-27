import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import { recommendInventory } from "../lib/recommend";
import { fetchUserRequirement } from "../lib/userRequirements";
import { fetchReactions, setReaction } from "../lib/visits";

const BLR = [12.9716, 77.5946];
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Teardrop pin — neutral coral (match score is intentionally not shown). Active enlarges + darkens. */
function pinIcon(active) {
  const c = active ? "#d8412b" : "#ef5a45";
  const size = active ? 40 : 32;
  return L.divIcon({
    className: "rec-pin",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${c};transform:rotate(-45deg);
        box-shadow:0 6px 16px rgba(0,0,0,.32);border:2px solid #fff;"></div>
      <span style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:#fff;"></span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/** The mobile map pane goes from `display:none` to visible when the visitor
 * taps "Map" — Leaflet doesn't know its container just changed size, so
 * without this it can render blank or misaligned until the map is dragged. */
function SyncSizeOnShow({ shown }) {
  const map = useMap();
  useEffect(() => {
    if (!shown) return;
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [shown, map]);
  return null;
}

/** Fly the map when the active/selected listing changes.
 *
 * On mobile the map pane starts `display:none` (the list/map toggle below
 * defaults to "list"), so this can fire — via the "center on first result"
 * effect — while the Leaflet container is still zero-sized. flyTo() animates
 * by interpolating in pixel space using the container's size, and against a
 * zero size that math produces NaN, which Leaflet then throws as "Invalid
 * LatLng object: (NaN, NaN)" — uncaught, that took the whole page down via
 * the top-level error boundary. setView (no animation) doesn't do that pixel
 * interpolation and is safe to call on a hidden container, so we use it
 * whenever the map isn't actually visible yet; the try/catch is a last-resort
 * safety net so this can't crash the page again even in an edge case we
 * haven't seen.
 */
function FlyTo({ center, zoom }) {
  const map = useMap();
  const lat = center?.[0];
  const lng = center?.[1];
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        map.flyTo([lat, lng], zoom, { duration: 0.5 });
      } else {
        map.setView([lat, lng], zoom, { animate: false });
      }
    } catch (err) {
      console.error("FlyTo: skipped recentering", err);
    }
  }, [map, lat, lng, zoom]);
  return null;
}

export default function Recommendations() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useVisitCart();

  const [prefs, setPrefs] = useState(location.state?.prefs || null);
  const [showConfirmation, setShowConfirmation] = useState(Boolean(location.state?.justSubmitted));
  const contactPhone = String(user?.phone || prefs?.office?.phone || "").trim();
  const [reactions, setReactions] = useState({}); // { property_id: 'like'|'dislike' }
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [flyCenter, setFlyCenter] = useState(BLR);
  const [mobileView, setMobileView] = useState("list"); // list | map (mobile toggle)
  const cardRefs = useRef({});

  // If we arrived without prefs (e.g. refresh / deep link), load the saved requirement.
  useEffect(() => {
    let alive = true;
    (async () => {
      let p = location.state?.prefs || null;
      if (!p && user) {
        const row = await fetchUserRequirement(user.uid);
        if (row) p = row; // snake_case row — normalizeRequirement handles it
      }
      if (alive) setPrefs(p || {});
    })();
    return () => { alive = false; };
  }, [location.state, user]);

  useEffect(() => {
    if (prefs == null) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const r = await recommendInventory(prefs, { min: 20 });
      if (!alive) return;
      setResults(r);
      setLoading(false);
      const first = r.find((x) => x.listing?.latitude);
      if (first) setFlyCenter([Number(first.listing.latitude), Number(first.listing.longitude)]);
    })();
    return () => { alive = false; };
  }, [prefs]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchReactions(user.uid).then((r) => { if (alive) setReactions(r); });
    return () => { alive = false; };
  }, [user]);

  const react = async (propertyId, value) => {
    const current = reactions[propertyId] || null;
    // optimistic
    const next = current === value ? null : value;
    setReactions((prev) => { const c = { ...prev }; if (next) c[propertyId] = next; else delete c[propertyId]; return c; });
    if (user) await setReaction(user.uid, propertyId, value, current);
  };

  const markers = useMemo(
    () => results.filter((r) => Number.isFinite(Number(r.listing?.latitude)) && Number.isFinite(Number(r.listing?.longitude))),
    [results]
  );

  const focusListing = (r) => {
    setActiveId(r.listing.property_id);
    if (r.listing.latitude) setFlyCenter([Number(r.listing.latitude), Number(r.listing.longitude)]);
    const el = cardRefs.current[r.listing.property_id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="rec-root">
      <style>{`
        .rec-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .rec-shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: calc(100dvh - 92px); }
        .rec-map { position: relative; height: 100%; }
        .rec-map .leaflet-container { height: 100%; width: 100%; }
        .rec-list { height: 100%; overflow-y: auto; padding: 20px 22px 40px; }
        .rec-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .rec-title { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
        .rec-sub { font-size: 13px; color: #7a7267; margin-top: 2px; }
        .rec-cards { display: flex; flex-direction: column; gap: 14px; }
        .rec-card { display: grid; grid-template-columns: 132px 1fr; gap: 14px; background: #fff; border: 1px solid #ece6da; border-radius: 18px; padding: 12px; cursor: pointer; transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease; }
        .rec-card:hover, .rec-card.is-active { box-shadow: 0 14px 34px rgba(20,18,16,0.12); border-color: #dcd3c4; transform: translateY(-1px); }
        .rec-thumb { position: relative; aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg,#f3ded9,#efe3c8); }
        .rec-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .rec-thumb-fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #c8b79b; }
        .rec-score { position: absolute; top: 8px; left: 8px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; color: #fff; }
        .rec-body { min-width: 0; display: flex; flex-direction: column; }
        .rec-name { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
        .rec-meta { font-size: 12.5px; color: #7a7267; margin-top: 2px; }
        .rec-listedby { display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 999px; background: #fff5f2; color: #b23a28; font-size: 11px; font-weight: 700; vertical-align: middle; }
        .rec-reasons { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
        .rec-chip { font-size: 11px; font-weight: 600; color: #4a443d; background: #f3f0ea; border-radius: 999px; padding: 3px 9px; }
        .rec-foot { display: flex; align-items: baseline; justify-content: space-between; padding-top: 8px; }
        .rec-rent { font-size: 18px; font-weight: 800; }
        .rec-rent small { font-size: 12px; font-weight: 600; color: #9a9186; }
        .rec-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #b98d2f; }
        .rec-actions { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
        .rec-ico { width: 40px; height: 40px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid #e7e0d3; background: #fff; color: #7a7267; cursor: pointer; transition: all .15s ease; }
        .rec-ico:hover { border-color: #d3c9b8; color: #4a443d; }
        .rec-ico.on-like { background: #fdeceb; border-color: #f4b8ae; color: #ef5a45; }
        .rec-ico.on-dislike { background: #eef0f2; border-color: #cfd4da; color: #566072; }
        .rec-add { flex: 1; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 12px; border: none; background: #1c1a17; color: #fff; font: 700 13px/1 'Plus Jakarta Sans',sans-serif; cursor: pointer; transition: background .15s ease; }
        .rec-add:hover { background: #000; }
        .rec-add.is-added { background: #eaf6ee; color: #16a34a; border: 1px solid #bfe6ca; }
        .rec-empty { text-align: center; color: #7a7267; padding: 60px 20px; }
        .rec-refine { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 999px; border: 1px solid #ded6c8; background: #fff; font-size: 13px; font-weight: 700; cursor: pointer; color: #2a2621; }
        .rec-mobiletoggle { display: none; }

        .rec-confirm-overlay { position: fixed; inset: 0; z-index: 1400; background: rgba(20,18,16,0.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .rec-confirm { width: min(520px, 100%); background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 90px rgba(0,0,0,0.4); }
        .rec-confirm-top { background: linear-gradient(135deg,#1c1a17,#3b2b28); padding: 28px 28px 22px; text-align: center; }
        .rec-confirm-check { width: 60px; height: 60px; margin: 0 auto 14px; border-radius: 50%; background: #eaf6ee; display: flex; align-items: center; justify-content: center; }
        .rec-confirm-h { font-family: 'Playfair Display', Georgia, serif; font-size: 25px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
        .rec-confirm-sub { font-size: 13.5px; color: rgba(255,255,255,0.72); margin-top: 6px; line-height: 1.5; }
        .rec-confirm-body { padding: 22px 26px 8px; }
        .rec-confirm-row { display: flex; gap: 13px; padding: 12px 0; border-bottom: 1px solid #f1ede5; }
        .rec-confirm-row:last-child { border-bottom: none; }
        .rec-confirm-ico { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px; background: #fdeee9; color: #ef5a45; display: flex; align-items: center; justify-content: center; }
        .rec-confirm-rt { min-width: 0; }
        .rec-confirm-rt b { display: block; font-size: 13.5px; font-weight: 800; color: #1c1a17; }
        .rec-confirm-rt span { display: block; font-size: 12.5px; color: #7a7267; line-height: 1.5; margin-top: 2px; }
        .rec-confirm-foot { padding: 14px 26px 24px; display: flex; flex-direction: column; gap: 10px; }
        .rec-confirm-cta { width: 100%; min-height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 14px; background: #ef5a45; color: #fff; font: 800 15px/1 'Plus Jakarta Sans', sans-serif; cursor: pointer; box-shadow: 0 10px 26px rgba(239,90,69,0.32); }
        .rec-confirm-cta:hover { filter: brightness(1.03); }
        .rec-confirm-link { background: none; border: none; color: #7a7267; font: 700 13px/1 'Plus Jakarta Sans', sans-serif; cursor: pointer; padding: 4px; }
        .rec-confirm-link:hover { color: #1c1a17; }

        @media (max-width: 900px) {
          .rec-shell { grid-template-columns: 1fr; height: auto; }
          .rec-map { height: 42vh; position: sticky; top: 0; z-index: 1; }
          .rec-list { height: auto; overflow: visible; padding: 16px 14px 40px; }
        }
        @media (max-width: 640px) {
          .rec-shell { display: block; }
          .rec-map, .rec-list { display: none; }
          .rec-shell.view-map .rec-map { display: block; height: calc(100dvh - 96px); position: static; }
          .rec-shell.view-list .rec-list { display: block; }
          .rec-title { font-size: 22px; }
          .rec-card { grid-template-columns: 108px 1fr; }
          .rec-mobiletoggle {
            display: inline-flex; position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
            z-index: 1300; background: #1c1a17; border-radius: 999px; padding: 5px; box-shadow: 0 10px 30px rgba(0,0,0,.28);
          }
          .rec-mobiletoggle button { border: none; background: none; color: rgba(255,255,255,.6); font: 700 13px/1 inherit; padding: 10px 20px; border-radius: 999px; cursor: pointer; }
          .rec-mobiletoggle button.is-on { background: #fff; color: #1c1a17; }
        }
      `}</style>

      <MovEazyNav active="" />

      {showConfirmation && (
        <div className="rec-confirm-overlay" onClick={() => setShowConfirmation(false)}>
          <div className="rec-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="rec-confirm-top">
              <div className="rec-confirm-check">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div className="rec-confirm-h">Your request has been received</div>
              <div className="rec-confirm-sub">Thanks — your preferences are saved. Here's exactly what happens next.</div>
            </div>
            <div className="rec-confirm-body">
              <div className="rec-confirm-row">
                <span className="rec-confirm-ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
                </span>
                <div className="rec-confirm-rt">
                  <b>Your MovEazy broker reviews your needs</b>
                  <span>A dedicated broker checks your budget, localities and must-haves, then curates the homes worth your time.</span>
                </div>
              </div>
              <div className="rec-confirm-row">
                <span className="rec-confirm-ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                </span>
                <div className="rec-confirm-rt">
                  <b>Expect your shortlist within 24 hours</b>
                  <span>You can browse your best-matched homes below right now — we'll keep refining them as new listings come in.</span>
                </div>
              </div>
              <div className="rec-confirm-row">
                <span className="rec-confirm-ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
                </span>
                <div className="rec-confirm-rt">
                  <b>We'll reach out to you</b>
                  <span>Expect a call or WhatsApp{contactPhone ? ` on ${contactPhone}` : " on your registered number"}, and the shortlist by email. No spam — just your matches.</span>
                </div>
              </div>
            </div>
            <div className="rec-confirm-foot">
              <button type="button" className="rec-confirm-cta" onClick={() => setShowConfirmation(false)}>
                See my matched homes
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" className="rec-confirm-link" onClick={() => { setShowConfirmation(false); navigate("/?find=1"); }}>
                Refine my preferences
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`rec-shell view-${mobileView}`}>
        {/* Map (left) */}
        <div className="rec-map">
          <MapContainer center={BLR} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" subdomains="abc" maxZoom={19} />
            <SyncSizeOnShow shown={mobileView === "map"} />
            <FlyTo center={flyCenter} zoom={14} />
            {markers.map((r) => (
              <Marker
                key={r.listing.property_id}
                position={[Number(r.listing.latitude), Number(r.listing.longitude)]}
                icon={pinIcon(activeId === r.listing.property_id)}
                eventHandlers={{ click: () => focusListing(r) }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Listings (right) */}
        <div className="rec-list">
          <div className="rec-head">
            <div>
              <div className="rec-title">Homes matched to you</div>
              <div className="rec-sub">
                {loading ? "Scoring homes against your preferences…" : `${results.length} home${results.length === 1 ? "" : "s"} ranked by how well they fit — best first.`}
              </div>
            </div>
            <button type="button" className="rec-refine" onClick={() => navigate("/?find=1")}>
              Refine preferences
            </button>
          </div>

          {!loading && results.length === 0 && (
            <div className="rec-empty">
              <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>No strong matches yet.</p>
              <p style={{ marginTop: 6 }}>As more homes get listed we'll surface the ones that fit you. Try widening your budget or areas.</p>
              <button type="button" className="rec-refine" style={{ marginTop: 16 }} onClick={() => navigate("/?find=1")}>Adjust preferences</button>
            </div>
          )}

          <div className="rec-cards">
            {results.map((r) => {
              const l = r.listing;
              const cover = l.cover_image_url || (Array.isArray(l.images) && l.images[0]) || "";
              return (
                <div
                  key={l.property_id}
                  ref={(el) => (cardRefs.current[l.property_id] = el)}
                  className={`rec-card ${activeId === l.property_id ? "is-active" : ""}`}
                  onMouseEnter={() => { setActiveId(l.property_id); if (l.latitude) setFlyCenter([Number(l.latitude), Number(l.longitude)]); }}
                  onClick={() => focusListing(r)}
                >
                  <div className="rec-thumb">
                    {cover
                      ? <img src={cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <span className="rec-thumb-fallback"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></span>}
                  </div>
                  <div className="rec-body">
                    <div className="rec-name">{l.title || `${l.flat_type || "Home"} in ${l.area || "Bengaluru"}`}</div>
                    <div className="rec-meta">
                      {[l.flat_type, l.area, l.furnishing].filter(Boolean).join(" · ")}
                      {(() => {
                        const r = String(l.posted_by || l.postedBy || "").toLowerCase();
                        const label = r === "broker" ? "Broker" : r === "tenant" ? "Tenant" : r === "owner" ? "Owner" : "";
                        return label ? <span className="rec-listedby">Listed by {label}</span> : null;
                      })()}
                    </div>
                    {r.reasons?.length > 0 && (
                      <div className="rec-reasons">
                        {r.reasons.slice(0, 4).map((x, i) => <span key={i} className="rec-chip">{x}</span>)}
                      </div>
                    )}
                    <div className="rec-foot">
                      <span className="rec-rent">{fmtINR(l.rent)}<small>/mo</small></span>
                      {l.landmark ? <span className="rec-tag">near {String(l.landmark).replace(/^near /i, "")}</span> : null}
                    </div>
                    <div className="rec-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className={`rec-ico ${reactions[l.property_id] === "like" ? "on-like" : ""}`} title="Like" aria-label="Like" onClick={() => react(l.property_id, "like")}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={reactions[l.property_id] === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                      </button>
                      <button type="button" className={`rec-ico ${reactions[l.property_id] === "dislike" ? "on-dislike" : ""}`} title="Not for me" aria-label="Dislike" onClick={() => react(l.property_id, "dislike")}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2M9.2 22l1.3-6H4.3a2 2 0 0 1-2-2.3l1.4-9A2 2 0 0 1 5.6 3H17v11l-5 8a2 2 0 0 1-2.8-1z"/></svg>
                      </button>
                      {cart.has(l.property_id) ? (
                        <button type="button" className="rec-add is-added" onClick={() => navigate("/visits")}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          In your visits
                        </button>
                      ) : (
                        <button type="button" className="rec-add" onClick={() => cart.add(l)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                          Add to site visit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Map/List toggle */}
      <div className="rec-mobiletoggle">
        <button type="button" className={mobileView === "list" ? "is-on" : ""} onClick={() => setMobileView("list")}>List</button>
        <button type="button" className={mobileView === "map" ? "is-on" : ""} onClick={() => setMobileView("map")}>Map</button>
      </div>
    </div>
  );
}
