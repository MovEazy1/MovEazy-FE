/**
 * The partner app's visual kit: tokens, the property card, sheets, chips and
 * the bottom nav. Mobile-first (PRD: one hand, fast); on a desktop the app is
 * the same phone-width column, centred, rather than a second layout.
 *
 * Styles are one injected sheet scoped under .pz so nothing leaks into the
 * customer site or the CRM that share this bundle.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Heart, Home, Lock, Menu, Plus, Users, UserRound, X, Building2, UserPlus,
} from "lucide-react";
import { SmartListingImage } from "./partnerMedia";
import { bhkLabel, inr, pp } from "../../lib/partners";

export const G = "#15803D";

const CSS = `
/* MovEazy Partners — Noir & Gold.
   noir    the frame: header, nav, primary buttons
   gold    money and action: WhatsApp, Join Premium, the + button
   emerald the MovEazy brand: availability, brokerage, success
   royal   AI only: the matcher, match scores, curated lists */
.pz { --noir:#0E0D12; --noir2:#1C1A24; --noir3:#2A2733;
  --gold:#D4A437; --goldg:linear-gradient(180deg,#F0CF7C,#D4A437); --gold2:#F6E7BF; --gold3:#7A5A12;
  --g:#0B6E4F; --g2:#08503A; --gl:#E4F2EC; --gl2:#CBE5D9;
  --ai:#6B4EFF; --ai2:#4930C9; --ail:#EFEBFF; --aig:linear-gradient(135deg,#7B5CFF,#4930C9);
  --ink:#16141C; --dim:#6B6776; --mute:#A09CAB;
  --line:#E7E4DD; --bg:#F5F3EE; --card:#FFFFFF; --warn:#B45309; --warnbg:#FEF3C7; --red:#B91C1C;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg);
  min-height: 100dvh; -webkit-tap-highlight-color: transparent; }
.pz *, .pz *::before, .pz *::after { box-sizing: border-box; }
.pz-col { max-width: 520px; margin: 0 auto; min-height: 100dvh; background: var(--bg); position: relative;
  padding-bottom: calc(76px + env(safe-area-inset-bottom)); }
@media (min-width: 560px) { .pz-col { border-left: 1px solid var(--line); border-right: 1px solid var(--line); } }
.pz-top { position: sticky; top: 0; z-index: 20; background: var(--noir); color: #fff; border-bottom: 1px solid var(--noir3);
  padding: 10px 16px; display: flex; align-items: center; gap: 10px; min-height: 54px; }
.pz-top h1 { font-size: 18px; font-weight: 700; margin: 0; flex: 1; letter-spacing: -0.01em; color: #fff; }
.pz-top .pz-iconbtn { color: #fff; }
.pz-top .pz-iconbtn:active { background: var(--noir3); }
.pz-top .pz-btn--ghost { color: var(--gold); }
.pz-top .pz-btn--primary { background: var(--goldg); border-color: transparent; color: #1F1605; }
.pz-top .pz-chip { background: var(--noir2); border-color: var(--noir3); color: #E9E6F0; }
.pz-top .pz-search input { background: var(--noir2); color: #fff; }
.pz-top .pz-search input::placeholder { color: var(--mute); }
.pz-top .pz-tabs { background: transparent; border-bottom: 0; }
.pz-top .pz-tab { color: #A7A3B3; }
.pz-top .pz-tab--on { color: #fff; border-bottom-color: var(--gold); }
.pz-iconbtn { width: 38px; height: 38px; border-radius: 10px; border: 0; background: transparent; display: grid;
  place-items: center; color: var(--ink); cursor: pointer; flex: none; }
.pz-iconbtn:active { background: var(--gl); }
.pz-pad { padding: 12px 16px; }
.pz-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.pz-section { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.pz-section h2 { font-size: 15px; font-weight: 700; margin: 0 0 10px; display: flex; align-items: center; justify-content: space-between; }
.pz-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin: 0 0 6px; }
.pz-hint { font-size: 12px; color: var(--dim); }
.pz-input, .pz-select, .pz-textarea { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 10px;
  font: inherit; font-size: 15px; padding: 11px 12px; color: var(--ink); outline: none; }
.pz-input:focus, .pz-select:focus, .pz-textarea:focus { border-color: var(--g); box-shadow: 0 0 0 3px var(--gl); }
.pz-field { margin-bottom: 14px; }
.pz-err { color: var(--red); font-size: 12px; margin-top: 4px; }
.pz-search { position: relative; }
.pz-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--mute); }
.pz-search input { padding-left: 38px; background: #F3F4F6; border-color: transparent; }
.pz-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; border: 1px solid var(--line);
  background: #fff; color: var(--ink); font: inherit; font-weight: 600; font-size: 14px; padding: 10px 14px; cursor: pointer;
  text-decoration: none; min-height: 42px; }
.pz-btn:disabled { opacity: .55; cursor: default; }
.pz-btn--primary { background: var(--noir); border-color: var(--noir); color: #fff; }
.pz-btn--primary:active { background: var(--noir3); }
.pz-btn--gold { background: var(--goldg); border-color: transparent; color: #1F1605; font-weight: 800; }
.pz-btn--ai { background: var(--aig); border-color: transparent; color: #fff; font-weight: 800; }
.pz-btn--soft { background: var(--gl); border-color: var(--gl); color: var(--g2); }
.pz-btn--ghost { border-color: transparent; background: transparent; color: var(--g); padding: 6px 8px; min-height: 0; }
.pz-btn--block { width: 100%; min-height: 50px; font-size: 16px; border-radius: 12px; }
.pz-btn--sm { min-height: 34px; padding: 6px 10px; font-size: 13px; }
.pz-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.pz-chips--scroll { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.pz-chips--scroll::-webkit-scrollbar { display: none; }
.pz-chip { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 7px 13px; font: inherit;
  font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.pz-chip--on { background: var(--noir); border-color: var(--noir); color: #fff; }
.pz-chip--soft { background: var(--gl); border-color: var(--gl); color: var(--g2); }
.pz-pill { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 3px 9px; font-size: 12px; font-weight: 600;
  background: var(--gl); color: var(--g2); white-space: nowrap; }
.pz-pill--solid { background: var(--g); color: #fff; }
.pz-pill--warn { background: var(--warnbg); color: var(--warn); }
.pz-pill--grey { background: #F3F4F6; color: var(--dim); }
.pz-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); background: var(--card); padding: 0 12px; }
.pz-tab { flex: 1; border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: var(--dim);
  padding: 11px 4px 10px; border-bottom: 2px solid transparent; cursor: pointer; }
.pz-tab--on { color: var(--ink); border-bottom-color: var(--gold); }
.pz-list > * + * { margin-top: 12px; }
.pz-prop { overflow: hidden; }
.pz-prop-img { position: relative; aspect-ratio: 16/9; background: #E9E6DF; overflow: hidden; }
.pz-prop-img img, .pz-prop-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.pz-prop-row { display: grid; grid-template-columns: 112px 1fr; height: 132px; }
.pz-prop-row .pz-prop-img { aspect-ratio: auto; height: 132px; }
.pz-prop-badge { position: absolute; top: 6px; left: 6px; }
.pz-prop-badge .pz-pill { font-size: 10.5px; padding: 2px 7px; }
.pz-prop-heart { position: absolute; bottom: 6px; left: 6px; width: 30px; height: 30px; border-radius: 999px; border: 0;
  background: rgba(255,255,255,.94); display: grid; place-items: center; cursor: pointer; color: var(--ink); }
.pz-prop-body { padding: 10px 12px; min-width: 0; display: flex; flex-direction: column; }
.pz-prop-title { font-size: 14.5px; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pz-prop-body .pz-rent { font-size: 17px; }
.pz-prop-body .pz-meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
.pz-prop-actions { display: flex; gap: 6px; margin-top: auto; }
.pz-prop-actions .pz-btn { min-height: 32px; padding: 5px 10px; font-size: 12.5px; border-radius: 9px; }
.pz-prop-extra { padding: 8px 12px 10px; border-top: 1px solid var(--line); }
.pz-rent { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.pz-rent small { font-size: 13px; font-weight: 500; color: var(--dim); }
.pz-meta { font-size: 13px; color: var(--dim); }
.pz-row { display: flex; align-items: center; gap: 10px; }
.pz-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pz-avatar { width: 34px; height: 34px; border-radius: 999px; background: #D1D5DB; color: #374151; display: grid; place-items: center;
  font-size: 13px; font-weight: 700; flex: none; }
.pz-avatar--lg { width: 48px; height: 48px; font-size: 16px; }
.pz-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.pz-wa { background: var(--goldg); border-color: transparent; color: #1F1605; font-weight: 800; }
.pz-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 520px; z-index: 30;
  background: var(--noir); border-top: 1px solid var(--noir3); display: grid; grid-template-columns: repeat(5, 1fr);
  padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
.pz-nav a, .pz-nav button { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; font-weight: 600;
  color: #8E8A9A; text-decoration: none; border: 0; background: transparent; font-family: inherit; cursor: pointer; padding: 4px 0; }
.pz-nav .on { color: var(--gold); }
.pz-nav-plus { width: 54px; height: 54px; border-radius: 999px; background: var(--goldg) !important; color: #1F1605 !important;
  margin-top: -22px; box-shadow: 0 6px 18px rgba(212,164,55,.45), 0 0 0 4px var(--noir); justify-content: center; align-self: center; }
.pz-sheet-bg { position: fixed; inset: 0; background: rgba(17,24,39,.45); z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
.pz-sheet { background: var(--card); width: 100%; max-width: 520px; border-radius: 18px 18px 0 0; max-height: 92dvh; overflow: auto;
  padding: 0 0 calc(16px + env(safe-area-inset-bottom)); animation: pzUp .18s ease-out; }
.pz-sheet-head { position: sticky; top: 0; background: var(--card); display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px;
  border-bottom: 1px solid var(--line); z-index: 1; }
.pz-sheet-head h3 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; }
@keyframes pzUp { from { transform: translateY(24px); opacity: .6 } to { transform: none; opacity: 1 } }
.pz-menurow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border: 0; background: transparent;
  font: inherit; font-size: 15px; color: var(--ink); cursor: pointer; text-align: left; text-decoration: none; }
.pz-menurow + .pz-menurow { border-top: 1px solid var(--line); }
.pz-menurow .pz-sub { display: block; font-size: 12.5px; color: var(--dim); margin-top: 2px; }
.pz-empty { text-align: center; color: var(--dim); padding: 36px 20px; font-size: 14px; line-height: 1.5; }
.pz-toast { position: fixed; left: 50%; bottom: calc(92px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 90;
  background: var(--noir); color: #fff; border: 1px solid var(--noir3); padding: 10px 16px; border-radius: 10px; font-size: 14px; max-width: calc(100% - 32px);
  box-shadow: 0 8px 20px rgba(0,0,0,.2); }
.pz-toast--error { background: var(--red); }
.pz-lockbar { display: flex; align-items: center; gap: 10px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px;
  padding: 10px 12px; font-size: 13px; color: #92400E; }
.pz-radio { display: flex; gap: 12px; align-items: flex-start; padding: 14px; cursor: pointer; }
.pz-radio input { width: 20px; height: 20px; accent-color: var(--g); margin-top: 2px; flex: none; }
.pz-check { width: 18px; height: 18px; accent-color: var(--g); flex: none; }
.pz-center { min-height: 100dvh; display: grid; place-items: center; padding: 24px; text-align: center; }
.pz-gallery { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; aspect-ratio: 4/3; background: #E5E7EB; }
.pz-gallery::-webkit-scrollbar { display: none; }
.pz-gallery > * { flex: 0 0 100%; scroll-snap-align: start; width: 100%; height: 100%; object-fit: cover; }
.pz-score { width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; font-size: 12px; font-weight: 800;
  border: 3px solid var(--ai); color: var(--ai2); background: var(--ail); flex: none; }
`;

export function PartnerStyles() {
  return <style>{CSS}</style>;
}

export const initials = (name = "") =>
  String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const AVATAR_TONES = ["#DBEAFE:#1E40AF", "#FCE7F3:#9D174D", "#E0E7FF:#3730A3", "#FEF3C7:#92400E", "#DCFCE7:#166534", "#F3E8FF:#6B21A8"];
export function Avatar({ name, size }) {
  const n = String(name || "");
  const tone = AVATAR_TONES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length].split(":");
  return (
    <span className={`pz-avatar${size === "lg" ? " pz-avatar--lg" : ""}`} style={{ background: tone[0], color: tone[1] }} aria-hidden>
      {initials(n)}
    </span>
  );
}

/** WhatsApp's glyph. lucide ships no brand marks. */
export function WhatsAppIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.44 9.44m8.04-17.48A11.3 11.3 0 0 0 12.04.7C5.77.7.67 5.8.67 12.07c0 2 .52 3.96 1.52 5.68L.57 23.7l6.08-1.6a11.3 11.3 0 0 0 5.4 1.38h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.9-3.33-8.05" />
    </svg>
  );
}

export function TopBar({ title, back, right, children }) {
  const navigate = useNavigate();
  return (
    <header className="pz-top">
      {back !== undefined && back !== false && (
        <button type="button" className="pz-iconbtn" aria-label="Back"
          onClick={() => (typeof back === "string" ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate(pp("/")))}>
          <ChevronLeft size={24} />
        </button>
      )}
      {title && <h1>{title}</h1>}
      {children}
      {right}
    </header>
  );
}

export function Sheet({ title, onClose, action, children }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="pz-sheet-bg" onClick={onClose} role="presentation">
      <div className="pz-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="pz-sheet-head">
          <button type="button" className="pz-iconbtn" aria-label="Close" onClick={onClose}><X size={22} /></button>
          <h3>{title}</h3>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({ on, soft, children, ...rest }) {
  return (
    <button type="button" className={`pz-chip${on ? " pz-chip--on" : soft ? " pz-chip--soft" : ""}`} aria-pressed={!!on} {...rest}>
      {children}
    </button>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="pz-empty">
      <div>{children}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return <div className="pz-empty">{label}</div>;
}

let toastSetter = null;
/** One toast for the whole app; any screen can call toast("Saved"). */
export function toast(message, kind = "ok") {
  toastSetter?.({ message, kind, at: Date.now() });
}
export function ToastHost() {
  const [t, setT] = useState(null);
  useEffect(() => { toastSetter = setT; return () => { toastSetter = null; }; }, []);
  useEffect(() => {
    if (!t) return undefined;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return <div className={`pz-toast${t.kind === "error" ? " pz-toast--error" : ""}`} role="status">{t.message}</div>;
}

export function BrokeragePill({ listing }) {
  const pct = Number(listing?.brokerage_pct);
  if (listing?.locked) {
    return <span className="pz-pill pz-pill--warn"><Lock size={12} /> {Number.isFinite(pct) ? `${pct}% ` : ""}with Premium</span>;
  }
  if (!Number.isFinite(pct) || listing?.brokerage_pct == null) return null;
  return <span className="pz-pill">{pct}% Brokerage</span>;
}

export function sourceLabel(l) {
  if (l.source === "mine") return "My listing";
  if (l.source === "moveazy") return "MovEazy";
  return l.lister_name || "Partner broker";
}

/**
 * The inventory card: compact and one fixed size (112px photo, 132px tall),
 * whatever the photo's shape — the photo is cropped to fit, never the card to
 * the photo. Enough to act without opening the property.
 */
export function PropertyCard({ listing: l, saved, onToggleSave, onWhatsApp, extra, detailsTo, onOpen }) {
  const navigate = useNavigate();
  const available = l.status === "published";
  const to = detailsTo || pp(`/property/${l.property_id}`);
  // onOpen: something other than the details page (demo mode explains instead).
  const open = (e) => { if (onOpen) { e?.preventDefault?.(); onOpen(); } else navigate(to); };
  const who = l.source === "moveazy" ? (l.locked ? "MovEazy · contacts with Premium" : "MovEazy inventory")
    : l.source === "mine" ? "Your listing" : l.lister_name || "Partner broker";
  return (
    <article className="pz-card pz-prop">
      <div className="pz-prop-row">
        <div className="pz-prop-img" onClick={open} role="link" tabIndex={-1} style={{ cursor: "pointer" }}>
          <SmartListingImage listing={l} />
          <span className="pz-prop-badge">
            {l.rent_flag === "potentially_rented"
              ? <span className="pz-pill" style={{ background: "#FFEDD5", color: "#9A3412" }}>Potentially rented</span>
              : available
              ? <span className="pz-pill pz-pill--solid">Available</span>
              : <span className="pz-pill pz-pill--grey" style={{ textTransform: "capitalize" }}>{l.status}</span>}
          </span>
          {onToggleSave && (
            <button type="button" className="pz-prop-heart" aria-label={saved ? "Remove from saved" : "Save"}
              onClick={(e) => { e.stopPropagation(); onToggleSave(); }}>
              <Heart size={16} fill={saved ? "#DC2626" : "none"} color={saved ? "#DC2626" : "currentColor"} />
            </button>
          )}
        </div>
        <div className="pz-prop-body">
          <div className="pz-between" style={{ alignItems: "flex-start", gap: 6 }}>
            <h3 className="pz-prop-title">{bhkLabel(l)} • {l.area || "Bengaluru"}</h3>
          </div>
          <div className="pz-rent">{inr(l.rent)} <small>/ mo</small></div>
          <div className="pz-meta">{who}{l.furnishing ? ` · ${l.furnishing}` : ""}</div>
          <div style={{ marginTop: 3 }}><BrokeragePill listing={l} /></div>
          <div className="pz-prop-actions">
            <button type="button" className="pz-btn pz-wa" onClick={onWhatsApp}><WhatsAppIcon size={15} /> WhatsApp</button>
            <Link to={to} onClick={onOpen ? open : undefined} className="pz-btn">Details</Link>
          </div>
        </div>
      </div>
      {extra && <div className="pz-prop-extra">{extra}</div>}
    </article>
  );
}

export const formatPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : String(p || "");
};

/** Inventory | Leads | + | Groups | More */
export function BottomNav({ onPlus }) {
  const { pathname } = useLocation();
  const base = pp("/").replace(/\/$/, "");
  const rel = pathname.slice(base.length) || "/";
  const on = (k) => (k === "/" ? rel === "/" || rel.startsWith("/property") : rel.startsWith(k)) ? "on" : "";
  return (
    <nav className="pz-nav" aria-label="Partner app">
      <Link to={pp("/")} className={on("/")}><Home size={22} />Inventory</Link>
      <Link to={pp("/leads")} className={on("/leads")}><UserRound size={22} />Leads</Link>
      <button type="button" className="pz-nav-plus" aria-label="Add property or lead" onClick={onPlus}><Plus size={28} /></button>
      <Link to={pp("/groups")} className={on("/groups")}><Users size={22} />Groups</Link>
      <Link to={pp("/more")} className={on("/more")}><Menu size={22} />More</Link>
    </nav>
  );
}

/** The + action creates only two things in V1: Property and Lead. */
export function CreateSheet({ onClose }) {
  const navigate = useNavigate();
  const go = (to) => { onClose(); navigate(to); };
  return (
    <Sheet title="Add new" onClose={onClose}>
      <button type="button" className="pz-menurow" onClick={() => go(pp("/add/property"))}>
        <span className="pz-avatar" style={{ background: "var(--gl)", color: "var(--g2)" }}><Building2 size={18} /></span>
        <span>Property<span className="pz-sub">Add a flat and choose who sees it</span></span>
      </button>
      <button type="button" className="pz-menurow" onClick={() => go(pp("/leads/new"))}>
        <span className="pz-avatar" style={{ background: "var(--gl)", color: "var(--g2)" }}><UserPlus size={18} /></span>
        <span>Lead<span className="pz-sub">Name and mobile is enough</span></span>
      </button>
    </Sheet>
  );
}
