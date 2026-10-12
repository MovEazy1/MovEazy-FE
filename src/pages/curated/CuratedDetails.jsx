/**
 * One flat from a partner's list, full screen, without leaving the list:
 * every photo, the facts, amenities and rules, roughly where it is — and only
 * Dislike / Like at the bottom. No booking: visits are fixed with the partner.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ChevronLeft, Heart, Landmark, MapPin, X } from "lucide-react";
import { MediaItem, listingMedia } from "../partners/partnerMedia";
import { inr } from "../../lib/partners";
import { factsOf, firstName } from "./curatedText";

const ApproxMap = lazy(() => import("./ApproxMap"));

export default function CuratedDetails({ home: h, brokerName = "", onClose, onDecide }) {
  const media = listingMedia(h);
  const [at, setAt] = useState(0);
  const strip = useRef(null);
  const facts = factsOf(h);
  const partner = firstName(brokerName) || "your partner";

  // The phone's back button closes the sheet rather than leaving the list.
  useEffect(() => {
    window.history.pushState({ csDetails: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => window.history.back();
  const decide = (action) => { onDecide(action); window.history.back(); };
  const onScroll = () => {
    const el = strip.current;
    if (el) setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  return (
    <div className="cd" role="dialog" aria-modal="true" aria-label="Flat details">
      <style>{CSS}</style>
      <div className="cd-scroll">
        <div className="cd-gallery">
          <div className="cd-strip" ref={strip} onScroll={onScroll}>
            {media.length ? media.map((src, i) => <div className="cd-shot" key={src + i}><MediaItem src={src} alt={`Photo ${i + 1}`} /></div>)
              : <div className="cd-shot cd-shot--none">No photos yet</div>}
          </div>
          <button type="button" className="cd-back" onClick={close} aria-label="Back to the list"><ChevronLeft size={24} /></button>
          {media.length > 1 && <span className="cd-count">{at + 1} / {media.length}</span>}
        </div>

        <div className="cd-body">
          {h.let_out && <p className="cd-flag">This one may already be let out — ask {partner}.</p>}
          <div className="cd-rent">{inr(h.rent)} <small>/ month</small></div>
          <h1 className="cd-title">{[h.flat_type, h.area].filter(Boolean).join(" in ") || h.title}</h1>
          {h.title && h.title !== h.flat_type && <p className="cd-sub">{h.title}</p>}

          {facts.length > 0 && (
            <dl className="cd-facts">
              {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}

          {(h.amenities ?? []).length > 0 && (
            <section><h2>Amenities</h2><div className="cd-chips">{h.amenities.map((a) => <span key={a}>{a}</span>)}</div></section>
          )}
          {(h.house_rules ?? []).length > 0 && (
            <section><h2>House rules</h2><div className="cd-chips cd-chips--rules">{h.house_rules.map((a) => <span key={a}>{a}</span>)}</div></section>
          )}
          {h.description && <section><h2>About this flat</h2><p className="cd-desc">{h.description}</p></section>}

          <section>
            <h2>Location</h2>
            <p className="cd-loc"><MapPin size={16} /> {h.area || "Bengaluru"}</p>
            {h.landmark && <p className="cd-loc"><Landmark size={16} /> {h.landmark}</p>}
            {h.approx_lat != null && h.approx_lng != null && (
              <div className="cd-map">
                <Suspense fallback={null}><ApproxMap lat={Number(h.approx_lat)} lng={Number(h.approx_lng)} /></Suspense>
              </div>
            )}
            <p className="cd-fine">Approximate area. {partner === "your partner" ? "Your partner" : partner} shares the exact address when you fix a visit.</p>
          </section>
        </div>
      </div>

      <div className="cd-bar">
        <button type="button" className={`cd-btn no${h.action === "skipped" ? " on" : ""}`} onClick={() => decide("skipped")}>
          <X size={22} /> {h.action === "skipped" ? "Disliked" : "Dislike"}
        </button>
        <button type="button" className={`cd-btn yes${h.action === "liked" ? " on" : ""}`} onClick={() => decide("liked")}>
          <Heart size={20} fill="currentColor" /> {h.action === "liked" ? "Liked" : "Like"}
        </button>
      </div>
    </div>
  );
}

const CSS = `
.cd { position: fixed; inset: 0; z-index: 60; background: #F7F5EE; display: flex; flex-direction: column; color: #13201B;
  font-family: Manrope, Inter, system-ui, sans-serif; animation: cdin .18s ease-out; }
@keyframes cdin { from { transform: translateY(24px); opacity: 0; } }
.cd *, .cd *::before, .cd *::after { box-sizing: border-box; }
.cd-scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.cd-gallery { position: relative; max-width: 640px; margin: 0 auto; }
.cd-strip { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; background: #E5E7EB; }
.cd-strip::-webkit-scrollbar { display: none; }
.cd-shot { flex: 0 0 100%; aspect-ratio: 4 / 3; scroll-snap-align: start; }
.cd-shot img, .cd-shot video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.cd-shot--none { display: grid; place-items: center; color: #6B7280; font-weight: 700; }
.cd-back { position: absolute; top: 12px; left: 12px; width: 42px; height: 42px; border-radius: 99px; border: 0; cursor: pointer;
  background: rgba(255,255,255,.92); display: grid; place-items: center; color: #13201B; box-shadow: 0 4px 14px rgba(0,0,0,.18); }
.cd-count { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,.6); color: #fff; font-size: 12.5px; font-weight: 700;
  padding: 4px 10px; border-radius: 99px; }
.cd-body { max-width: 640px; margin: 0 auto; padding: 16px 16px 24px; }
.cd-flag { background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 13.5px; padding: 10px 12px; border-radius: 12px; margin: 0 0 12px; }
.cd-rent { font-size: 28px; font-weight: 800; letter-spacing: -0.01em; }
.cd-rent small { font-size: 15px; color: #56655F; font-weight: 600; }
.cd-title { font-size: 19px; margin: 2px 0 0; }
.cd-sub { color: #56655F; margin: 4px 0 0; font-size: 14px; }
.cd-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 16px 0 0; }
.cd-facts div { background: #fff; border: 1px solid #E6E2D6; border-radius: 12px; padding: 10px 12px; min-width: 0; }
.cd-facts dt { font-size: 12px; color: #56655F; font-weight: 600; }
.cd-facts dd { margin: 2px 0 0; font-weight: 800; font-size: 14.5px; overflow-wrap: anywhere; }
.cd section { margin-top: 20px; }
.cd h2 { font-size: 15px; margin: 0 0 8px; }
.cd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cd-chips span { background: #E8F3EE; color: #0A3A2A; font-weight: 700; font-size: 13px; padding: 6px 10px; border-radius: 99px; }
.cd-chips--rules span { background: #F3F0E7; color: #3F3A2E; }
.cd-desc { margin: 0; line-height: 1.55; color: #2F3B36; white-space: pre-line; overflow-wrap: anywhere; }
.cd-loc { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-weight: 700; }
.cd-map { height: 200px; border-radius: 14px; overflow: hidden; margin-top: 8px; border: 1px solid #E6E2D6; isolation: isolate; }
.cd-fine { font-size: 12.5px; color: #56655F; margin: 8px 0 0; }
.cd-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff; border-top: 1px solid #E6E2D6; }
.cd-bar { max-width: 100%; }
.cd-btn { min-height: 54px; border-radius: 14px; font: inherit; font-size: 16px; font-weight: 800; display: flex; align-items: center;
  justify-content: center; gap: 8px; cursor: pointer; border: 2px solid; }
.cd-btn.no { background: #fff; color: #E11D48; border-color: #FBCFE8; }
.cd-btn.no.on { background: #FFE4E6; border-color: #E11D48; }
.cd-btn.yes { background: linear-gradient(135deg, #22C55E, #15803D); color: #fff; border-color: transparent; }
.cd-btn.yes.on { box-shadow: 0 0 0 3px #BBF7D0 inset; }
`;
