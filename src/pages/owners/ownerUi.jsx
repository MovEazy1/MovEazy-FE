/**
 * The owner app's visual kit. PRD §2: deep emerald for primary actions and
 * active states, champagne for restrained premium accents, mostly cream and
 * white. Calm rather than busy — a property assistant, not accounting software.
 *
 * One injected sheet scoped under .oz, so nothing leaks into the customer site,
 * the CRM or the broker partner app that share this bundle.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronLeft, Home, Menu, Star, Users, Wrench, X } from "lucide-react";
import { MediaItem, listingMedia } from "../partners/partnerMedia";
import { op } from "../../lib/owners";

const CSS = `
.oz { --deep:#063B2D; --em:#0A6B4E; --em2:#0D7F5D; --emt:#E7F2EC; --champ:#D6B77C; --champ2:#F4EBD8; --champ3:#8A6A2F;
  --cream:#F7F4EC; --white:#FFFFFF; --ink:#17211D; --dim:#5E6B66; --mute:#94A09B; --line:#E6E1D4; --line2:#EFEBE0;
  --red:#B42318; --redbg:#FDECEA; --amber:#9A6700; --amberbg:#FFF4D6; --blue:#1D4ED8; --bluebg:#E8EEFD;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--cream);
  min-height: 100dvh; -webkit-tap-highlight-color: transparent; }
.oz *, .oz *::before, .oz *::after { box-sizing: border-box; }
.oz-col { max-width: 520px; margin: 0 auto; min-height: 100dvh; background: var(--cream); position: relative;
  padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
@media (min-width: 560px) { .oz-col { border-left: 1px solid var(--line); border-right: 1px solid var(--line); } }
.oz-top { position: sticky; top: 0; z-index: 20; background: rgba(247,244,236,.94); backdrop-filter: blur(8px);
  padding: 10px 16px; display: flex; align-items: center; gap: 8px; min-height: 56px; }
.oz-top h1 { font-size: 19px; font-weight: 700; margin: 0; flex: 1; letter-spacing: -0.01em; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oz-iconbtn { width: 40px; height: 40px; border-radius: 12px; border: 0; background: transparent; display: grid; place-items: center;
  color: var(--ink); cursor: pointer; flex: none; text-decoration: none; position: relative; }
.oz-iconbtn:active { background: var(--emt); }
.oz-pad { padding: 12px 16px; }
.oz-card { background: var(--white); border: 1px solid var(--line2); border-radius: 16px; box-shadow: 0 1px 2px rgba(6,59,45,.04); }
.oz-section { background: var(--white); border: 1px solid var(--line2); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
.oz-h2 { font-size: 16px; font-weight: 700; margin: 0 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.oz-label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 6px; color: var(--ink); }
.oz-hint { font-size: 12px; color: var(--dim); }
.oz-meta { font-size: 13px; color: var(--dim); }
.oz-input, .oz-select, .oz-textarea { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 12px; font: inherit;
  font-size: 15px; padding: 12px 13px; color: var(--ink); outline: none; }
.oz-input:focus, .oz-select:focus, .oz-textarea:focus { border-color: var(--em); box-shadow: 0 0 0 3px var(--emt); }
.oz-field { margin-bottom: 14px; }
.oz-err { color: var(--red); font-size: 12px; margin-top: 4px; }
.oz-search { position: relative; }
.oz-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--mute); }
.oz-search input { padding-left: 38px; background: #fff; }
.oz-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 12px; border: 1px solid var(--line);
  background: #fff; color: var(--ink); font: inherit; font-weight: 600; font-size: 14px; padding: 10px 14px; cursor: pointer;
  text-decoration: none; min-height: 44px; }
.oz-btn:disabled { opacity: .55; cursor: default; }
.oz-btn--primary { background: var(--em); border-color: var(--em); color: #fff; }
.oz-btn--primary:active { background: var(--deep); }
.oz-btn--champ { background: var(--champ2); border-color: var(--champ2); color: var(--champ3); }
.oz-btn--soft { background: var(--emt); border-color: var(--emt); color: var(--deep); }
.oz-btn--ghost { border-color: transparent; background: transparent; color: var(--em); padding: 6px 8px; min-height: 0; }
.oz-btn--danger { color: var(--red); }
.oz-btn--block { width: 100%; min-height: 52px; font-size: 16px; border-radius: 14px; }
.oz-btn--sm { min-height: 34px; padding: 6px 11px; font-size: 13px; border-radius: 10px; }
.oz-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.oz-chips--scroll { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.oz-chips--scroll::-webkit-scrollbar { display: none; }
.oz-chip { border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 999px; padding: 7px 13px; font: inherit;
  font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.oz-chip--on { background: var(--em); border-color: var(--em); color: #fff; }
.oz-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600;
  white-space: nowrap; }
.oz-pill--green { background: var(--emt); color: var(--em); }
.oz-pill--red { background: var(--redbg); color: var(--red); }
.oz-pill--amber { background: var(--amberbg); color: var(--amber); }
.oz-pill--blue { background: var(--bluebg); color: var(--blue); }
.oz-pill--grey { background: #EFEDE6; color: var(--dim); }
.oz-pill--champ { background: var(--champ2); color: var(--champ3); }
.oz-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); padding: 0 12px; overflow-x: auto; scrollbar-width: none; }
.oz-tab { flex: 1 0 auto; border: 0; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: var(--dim);
  padding: 11px 8px 10px; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; }
.oz-tab--on { color: var(--deep); border-bottom-color: var(--em); }
.oz-list > * + * { margin-top: 12px; }
.oz-row { display: flex; align-items: center; gap: 10px; }
.oz-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.oz-avatar { width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center; font-size: 14px; font-weight: 700;
  flex: none; background: var(--emt); color: var(--deep); }
.oz-avatar--lg { width: 56px; height: 56px; font-size: 19px; }
.oz-thumb { width: 96px; height: 84px; border-radius: 12px; overflow: hidden; flex: none; background: #E9E4D6; display: grid; place-items: center; color: var(--mute); }
.oz-thumb img, .oz-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.oz-prop { display: flex; gap: 12px; padding: 10px; color: inherit; text-decoration: none; align-items: center; }
.oz-prop-title { font-size: 15.5px; font-weight: 700; margin: 0; }
.oz-rent { font-size: 15px; font-weight: 700; }
.oz-rent small { font-weight: 500; color: var(--dim); font-size: 12.5px; }
.oz-hero { background: radial-gradient(120% 140% at 100% 0%, #0E6A4F 0%, #063B2D 55%, #04291F 100%); color: #fff; border-radius: 22px;
  padding: 18px; position: relative; overflow: hidden; box-shadow: 0 12px 30px rgba(6,59,45,.25); }
.oz-hero::after { content: ""; position: absolute; right: -40px; top: -40px; width: 180px; height: 180px; border-radius: 999px;
  background: radial-gradient(circle, rgba(214,183,124,.28), rgba(214,183,124,0) 70%); }
.oz-hero-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; position: relative; z-index: 1; }
.oz-hero-action { background: rgba(255,255,255,.08); border: 1px solid rgba(214,183,124,.35); border-radius: 14px; color: #fff; text-decoration: none;
  padding: 12px 6px; display: flex; flex-direction: column; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; text-align: center; }
.oz-hero-action span.ic { width: 38px; height: 38px; border-radius: 11px; background: var(--champ2); color: var(--deep); display: grid; place-items: center; }
.oz-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.oz-tile { background: #fff; border: 1px solid var(--line2); border-radius: 14px; padding: 12px 4px; display: flex; flex-direction: column;
  align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink); text-decoration: none; cursor: pointer; font-family: inherit; position: relative; }
.oz-tile .ic { width: 36px; height: 36px; border-radius: 11px; background: var(--emt); color: var(--deep); display: grid; place-items: center; }
.oz-badge { position: absolute; top: 6px; right: 10px; min-width: 18px; height: 18px; border-radius: 999px; background: var(--red); color: #fff;
  font-size: 11px; font-weight: 700; display: grid; place-items: center; padding: 0 5px; }
.oz-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 520px; z-index: 30; background: #fff;
  border-top: 1px solid var(--line); display: grid; grid-template-columns: repeat(5, 1fr); padding: 7px 4px calc(7px + env(safe-area-inset-bottom)); }
.oz-nav a { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: var(--mute); text-decoration: none; padding: 3px 0; }
.oz-nav a.on { color: var(--deep); }
.oz-nav a.on svg { color: var(--em); }
.oz-sheet-bg { position: fixed; inset: 0; background: rgba(4,31,23,.45); z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
.oz-sheet { background: #fff; width: 100%; max-width: 520px; border-radius: 22px 22px 0 0; max-height: 92dvh; overflow: auto;
  padding: 0 0 calc(16px + env(safe-area-inset-bottom)); animation: ozUp .18s ease-out; }
.oz-sheet-head { position: sticky; top: 0; background: #fff; display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px;
  border-bottom: 1px solid var(--line2); z-index: 1; }
.oz-sheet-head h3 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; }
@keyframes ozUp { from { transform: translateY(24px); opacity: .6 } to { transform: none; opacity: 1 } }
.oz-menurow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border: 0; background: transparent; font: inherit;
  font-size: 15px; color: var(--ink); cursor: pointer; text-align: left; text-decoration: none; }
.oz-menurow + .oz-menurow { border-top: 1px solid var(--line2); }
.oz-menurow .oz-sub { display: block; font-size: 12.5px; color: var(--dim); margin-top: 2px; }
.oz-empty { text-align: center; color: var(--dim); padding: 36px 20px; font-size: 14px; line-height: 1.55; }
.oz-toast { position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 90;
  background: var(--deep); color: #fff; padding: 11px 16px; border-radius: 12px; font-size: 14px; max-width: calc(100% - 32px);
  box-shadow: 0 8px 20px rgba(0,0,0,.2); }
.oz-toast--error { background: var(--red); }
.oz-center { min-height: 100dvh; display: grid; place-items: center; padding: 24px; text-align: center; }
.oz-gallery { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; aspect-ratio: 4/3; background: #E9E4D6; border-radius: 18px; }
.oz-gallery::-webkit-scrollbar { display: none; }
.oz-gallery > * { flex: 0 0 100%; scroll-snap-align: start; width: 100%; height: 100%; }
.oz-gallery img, .oz-gallery video { width: 100%; height: 100%; object-fit: cover; display: block; }
.oz-kv { display: grid; grid-template-columns: 42% 1fr; gap: 0; }
.oz-kv > div { padding: 11px 0; border-bottom: 1px solid var(--line2); font-size: 14px; min-width: 0; overflow-wrap: anywhere; }
.oz-kv > div:nth-child(odd) { color: var(--dim); }
.oz-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.oz-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.oz-svc-ic { width: 54px; height: 54px; border-radius: 14px; background: var(--champ2); color: var(--deep); display: grid; place-items: center; flex: none; }
.oz-cat { background: #fff; border: 1.5px solid var(--line2); border-radius: 14px; padding: 14px 6px; display: flex; flex-direction: column;
  align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink); cursor: pointer; min-height: 88px; justify-content: center; }
.oz-cat--on { border-color: var(--em); background: var(--emt); color: var(--deep); }
.oz-stat { background: #fff; border: 1px solid var(--line2); border-radius: 14px; padding: 12px; }
.oz-stat b { display: block; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.oz-stat span { font-size: 12px; color: var(--dim); }
.oz-timeline { position: relative; padding-left: 18px; }
.oz-timeline::before { content: ""; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 2px; background: var(--line); }
.oz-timeline > div { position: relative; padding: 0 0 14px; }
.oz-timeline > div::before { content: ""; position: absolute; left: -17px; top: 5px; width: 10px; height: 10px; border-radius: 999px;
  background: var(--em); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--em); }
`;

export function OwnerStyles() {
  return <style>{CSS}</style>;
}

export const initials = (name = "") =>
  String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export function Avatar({ name, size }) {
  return <span className={`oz-avatar${size === "lg" ? " oz-avatar--lg" : ""}`} aria-hidden>{initials(name)}</span>;
}

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
    <header className="oz-top">
      {back !== undefined && back !== false && (
        <button type="button" className="oz-iconbtn" aria-label="Back"
          onClick={() => (typeof back === "string" ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate(op("/")))}>
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
    <div className="oz-sheet-bg" onClick={onClose} role="presentation">
      <div className="oz-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="oz-sheet-head">
          <button type="button" className="oz-iconbtn" aria-label="Close" onClick={onClose}><X size={22} /></button>
          <h3>{title}</h3>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A yes/no that has to be said out loud (logout, cancel a request, decline a quote). */
export function Confirm({ title, body, confirmLabel = "Confirm", danger, onConfirm, onClose, busy }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="oz-pad">
        {body && <p style={{ margin: "4px 0 16px", color: "var(--dim)", lineHeight: 1.55 }}>{body}</p>}
        <div className="oz-grid2">
          <button type="button" className="oz-btn" onClick={onClose} disabled={busy}>Not now</button>
          <button type="button" className={`oz-btn ${danger ? "oz-btn--danger" : "oz-btn--primary"}`} onClick={onConfirm} disabled={busy}
            style={danger ? { borderColor: "#F3C7C2" } : undefined}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function Chip({ on, children, ...rest }) {
  return <button type="button" className={`oz-chip${on ? " oz-chip--on" : ""}`} aria-pressed={!!on} {...rest}>{children}</button>;
}

export function Pill({ tone = "grey", children, style }) {
  return <span className={`oz-pill oz-pill--${tone}`} style={style}>{children}</span>;
}

export function Empty({ children, action, icon }) {
  return (
    <div className="oz-empty">
      {icon && <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--champ2)", color: "var(--deep)", display: "grid",
        placeItems: "center", margin: "0 auto 12px" }}>{icon}</div>}
      <div>{children}</div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return <div className="oz-empty">{label}</div>;
}

let toastSetter = null;
export function toast(message, kind = "ok") {
  toastSetter?.({ message, kind, at: Date.now() });
}
export function ToastHost() {
  const [t, setT] = useState(null);
  useEffect(() => { toastSetter = setT; return () => { toastSetter = null; }; }, []);
  useEffect(() => {
    if (!t) return undefined;
    const id = setTimeout(() => setT(null), 2800);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return <div className={`oz-toast${t.kind === "error" ? " oz-toast--error" : ""}`} role="status">{t.message}</div>;
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className="oz-row" style={{ gap: 4 }} role={onChange ? "radiogroup" : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const icon = <Star size={size} fill={on ? "#D6B77C" : "none"} color={on ? "#B8934D" : "#C9C3B3"} />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)} style={{ border: 0, background: "transparent", padding: 2, cursor: "pointer" }}>{icon}</button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
}

export function PropertyThumb({ property, style }) {
  const [first] = listingMedia(property);
  return (
    <div className="oz-thumb" style={style}>
      {first ? <MediaItem src={first} alt="" /> : <Building2 size={28} />}
    </div>
  );
}

export const OCCUPANCY_PILL = {
  occupied: { tone: "green", label: "Occupied" },
  listed: { tone: "champ", label: "Finding a tenant" },
  vacant: { tone: "amber", label: "Vacant" },
};

/** The bottom nav, per PRD: Home, Properties, Tenants, Services, More. */
export function BottomNav() {
  const { pathname } = useLocation();
  const base = op("/").replace(/\/$/, "");
  const rel = pathname.slice(base.length) || "/";
  const on = (k, also = []) =>
    (k === "/" ? rel === "/" || rel.startsWith("/increase-rent") || rel.startsWith("/notifications")
      : [k, ...also].some((p) => rel.startsWith(p))) ? "on" : "";
  return (
    <nav className="oz-nav" aria-label="Owner app">
      <Link to={op("/")} className={on("/")}><Home size={22} />Home</Link>
      <Link to={op("/properties")} className={on("/properties")}><Building2 size={22} />Properties</Link>
      <Link to={op("/tenants")} className={on("/tenants")}><Users size={22} />Tenants</Link>
      <Link to={op("/services")} className={on("/services", ["/repairs", "/designer-call"])}><Wrench size={22} />Services</Link>
      <Link to={op("/more")} className={on("/more", ["/documents", "/profile"])}><Menu size={22} />More</Link>
    </nav>
  );
}
