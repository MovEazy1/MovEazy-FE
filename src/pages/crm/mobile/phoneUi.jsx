/**
 * The CRM on a phone: when it applies, its top bar and bottom bar, its sheet
 * of styles, and the small pieces its screens share. On a computer none of
 * this renders and the CRM is exactly as it was.
 */
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, LayoutGrid, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { C } from "../crmUi";
import { PHONE_TABS, sectionFor } from "../crmSections";
import { telLink, waLink } from "../../../lib/partners";
import { PHONE_QUERY, isPhoneNow } from "./phoneQuery";
// The official wordmark drawn for light grounds: the bar is white, and
// /logo-moveazy-bar.png carries a black plate that showed as a box on it.
import logoOnLight from "../../../assets/logo/moveazy-logo-mint-light.png";

export { PHONE_QUERY, isPhoneNow };

/** True on a phone-width screen; follows rotation and resizing. */
export function usePhone() {
  const [phone, setPhone] = useState(isPhoneNow);
  useEffect(() => {
    const m = window.matchMedia?.(PHONE_QUERY);
    if (!m) return undefined;
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return phone;
}

const ROOTS = new Set(PHONE_TABS.map((t) => t.to));

/** Title, a way back, and the way to every section (Home's grid). */
export function PhoneTopBar({ onRefresh, refreshing }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const sec = sectionFor(pathname);
  const root = ROOTS.has(pathname);
  const back = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/crm/home");
  };
  return (
    <header className="crm-ph-top">
      {root ? (
        <img src={logoOnLight} alt="MovEazy" className="crm-ph-logo" />
      ) : (
        <button type="button" className="crm-ph-icon" onClick={back} aria-label="Back"><ChevronLeft size={22} /></button>
      )}
      <h1>{sec?.label === "Home" ? "CRM" : sec?.label || "CRM"}</h1>
      {onRefresh && (
        <button type="button" className="crm-ph-icon" onClick={onRefresh} aria-label="Refresh" disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? "crm-ph-spin" : ""} />
        </button>
      )}
      {pathname !== "/crm/home" && (
        <Link to="/crm/home" className="crm-ph-icon" aria-label="All sections"><LayoutGrid size={19} /></Link>
      )}
    </header>
  );
}

export function PhoneNav({ badge = 0 }) {
  const { pathname } = useLocation();
  return (
    <nav className="crm-ph-nav" aria-label="CRM">
      {PHONE_TABS.map((t) => {
        const on = pathname === t.to || pathname.startsWith(`${t.to}/`);
        const Icon = t.icon;
        return (
          <NavLink key={t.to} to={t.to} className={on ? "crm-ph-tab crm-ph-tab--on" : "crm-ph-tab"}>
            <span className="crm-ph-tab-ic">
              <Icon size={21} strokeWidth={on ? 2.4 : 2} />
              {t.badge && badge > 0 && <span className="crm-ph-badge">{badge > 99 ? "99+" : badge}</span>}
            </span>
            {t.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** A number you can tap: Home's and Notifications' metrics. */
export function Metric({ label, value, sub, to, onClick, tone, on }) {
  const body = (
    <>
      <b className="crm-num" style={tone ? { color: tone } : undefined}>{value ?? "—"}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </>
  );
  const cls = on ? "crm-ph-metric crm-ph-metric--on" : "crm-ph-metric";
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function PhSection({ title, right, children }) {
  return (
    <section className="crm-ph-sec">
      <div className="crm-ph-sec-head"><h2>{title}</h2>{right}</div>
      {children}
    </section>
  );
}

/** Call and WhatsApp, full-size for a thumb. */
export function ContactButtons({ phone, text = "", label = "" }) {
  if (!String(phone || "").trim()) return <span className="crm-mute" style={{ fontSize: 12 }}>No number</span>;
  return (
    <span className="crm-ph-contact">
      <a href={telLink(phone)} className="crm-ph-cbtn" aria-label={`Call ${label}`.trim()}><Phone size={15} /> Call</a>
      <a href={waLink(phone, text)} target="_blank" rel="noreferrer" className="crm-ph-cbtn crm-ph-cbtn--wa"
        aria-label={`WhatsApp ${label}`.trim()}><MessageCircle size={15} /> WhatsApp</a>
    </span>
  );
}

/** A row of choices, one on. */
export function Segment({ value, onChange, options }) {
  return (
    <div className="crm-ph-seg" role="tablist">
      {options.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id}
          className={value === id ? "crm-ph-seg-b crm-ph-seg-b--on" : "crm-ph-seg-b"} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** "Updated 10:42" under a screen that refreshes itself. */
export const updatedAt = (d) =>
  d ? `Updated ${new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "";

export const PHONE_CSS = `
.crm--phone { font-size:14px; }
.crm-ph-top { flex:none; display:flex; align-items:center; gap:6px; height:52px; padding:0 8px 0 12px;
  background:${C.bg}; border-bottom:1px solid ${C.line}; padding-top:env(safe-area-inset-top); box-sizing:content-box; }
.crm-ph-top h1 { flex:1; min-width:0; margin:0; font-size:16.5px; font-weight:800; letter-spacing:-.01em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.crm-ph-logo { height:22px; width:auto; display:block; }
.crm .crm-ph-icon { width:40px; height:40px; display:grid; place-items:center; border-radius:10px; color:${C.text}; flex:none; }
.crm .crm-ph-icon:active { background:${C.surfaceAlt}; }
.crm-ph-spin { animation:crmspin 1s linear infinite; }
@keyframes crmspin { to { transform:rotate(360deg); } }
.crm-ph-main { flex:1; min-height:0; display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden;
  -webkit-overflow-scrolling:touch; }
.crm-ph-nav { flex:none; display:grid; grid-template-columns:repeat(5, 1fr); background:${C.bg};
  border-top:1px solid ${C.line}; padding-bottom:env(safe-area-inset-bottom); }
.crm .crm-ph-tab { display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 2px 6px;
  font-size:10.5px; font-weight:600; color:${C.textMute}; text-decoration:none; }
.crm .crm-ph-tab--on { color:${C.accent}; }
.crm-ph-tab-ic { position:relative; display:grid; place-items:center; }
.crm-ph-badge { position:absolute; top:-5px; left:13px; min-width:17px; height:17px; padding:0 4px; border-radius:999px;
  background:${C.coral}; color:#fff; font-size:10px; font-weight:800; display:grid; place-items:center; line-height:1; }

.crm-ph-page { padding:14px 14px 28px; display:flex; flex-direction:column; gap:18px; }
.crm-ph-sec-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin:0 0 8px; }
.crm-ph-sec h2 { margin:0; font-size:12px; letter-spacing:.09em; text-transform:uppercase; color:${C.textMute}; font-weight:700; }
.crm-ph-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
.crm-ph-grid--3 { grid-template-columns:repeat(3, minmax(0, 1fr)); }
.crm .crm-ph-metric { display:flex; flex-direction:column; gap:1px; text-align:left; padding:11px 12px; border-radius:12px;
  border:1px solid ${C.line}; background:${C.bg}; color:${C.text}; text-decoration:none; min-width:0; }
.crm .crm-ph-metric:active { background:${C.surface}; }
.crm .crm-ph-metric--on { border-color:${C.accent}; background:${C.accentSoft}; }
.crm-ph-metric b { font-size:22px; font-weight:800; line-height:1.15; }
.crm-ph-metric span { font-size:12px; color:${C.textDim}; font-weight:600; line-height:1.3; }
.crm-ph-metric small { font-size:11px; color:${C.textMute}; line-height:1.3; }
.crm .crm-ph-tile { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px 4px;
  border-radius:12px; border:1px solid ${C.line}; background:${C.surface}; color:${C.text}; text-decoration:none;
  font-size:11.5px; font-weight:600; text-align:center; line-height:1.25; min-height:78px; }
.crm .crm-ph-tile:active { background:${C.surfaceAlt}; }
.crm-ph-tile svg { color:${C.accent}; }

.crm-ph-card { border:1px solid ${C.line}; border-radius:12px; background:${C.bg}; padding:12px; display:flex; flex-direction:column; gap:7px; }
.crm-ph-card + .crm-ph-card { margin-top:8px; }
.crm-ph-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.crm-ph-card-top b { font-size:14.5px; }
.crm-ph-meta { font-size:12px; color:${C.textDim}; line-height:1.45; }
.crm-ph-pill { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px;
  background:${C.surface}; border:1px solid ${C.line}; color:${C.textDim}; white-space:nowrap; }
.crm-ph-contact { display:flex; gap:8px; flex-wrap:wrap; }
.crm .crm-ph-cbtn { flex:1; min-width:110px; display:inline-flex; align-items:center; justify-content:center; gap:6px; height:38px;
  border-radius:10px; border:1px solid ${C.accent}; color:${C.accent}; background:${C.bg}; font-weight:700; font-size:13px; text-decoration:none; }
.crm .crm-ph-cbtn--wa { background:${C.wa}; border-color:${C.wa}; color:#fff; }
.crm .crm-ph-cbtn--plain { border-color:${C.line}; color:${C.text}; }
.crm-ph-seg { display:flex; gap:4px; padding:3px; border-radius:11px; background:${C.surface}; border:1px solid ${C.line}; }
.crm .crm-ph-seg-b { flex:1; height:34px; border-radius:8px; font-size:12.5px; font-weight:700; color:${C.textDim}; }
.crm .crm-ph-seg-b--on { background:${C.bg}; color:${C.accent}; box-shadow:0 1px 3px rgba(16,34,30,.12); }
.crm-ph-chips { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
.crm-ph-chips::-webkit-scrollbar { display:none; }
.crm .crm-ph-chip { flex:none; display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:999px;
  border:1px solid ${C.line}; background:${C.bg}; color:${C.textDim}; font-size:12.5px; font-weight:600; white-space:nowrap; }
.crm .crm-ph-chip--on { border-color:${C.accent}; background:${C.accentSoft}; color:${C.accent}; }
.crm-ph-chip b { font-weight:800; }
.crm-ph-note { font-size:12px; color:${C.textMute}; margin:0; }

/* Every existing screen, made to fit: inputs that don't zoom the page, buttons
   big enough for a thumb, wide tables that scroll sideways instead of spilling,
   and side-by-side panes stacked. */
/* A screen is one page that scrolls, not panes that each scroll on their own. */
.crm-ph-main > * { flex:none !important; min-height:auto !important; }
.crm--phone .crm-scroll { overflow:visible; }
.crm--phone .crm-col { min-height:auto; }
.crm--phone input.crm-input, .crm--phone select.crm-input, .crm--phone textarea.crm-input { font-size:16px; padding:9px 11px; }
.crm--phone .crm-btn { padding:8px 13px; font-size:13px; }
.crm--phone .crm-btn--sm { padding:6px 10px; font-size:12px; }
.crm--phone .crm-chip { padding:6px 12px; font-size:12.5px; }
.crm--phone table.crm-table { display:block; overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%; }
.crm--phone .crm-stack { flex-direction:column !important; grid-template-columns:minmax(0, 1fr) !important; }
.crm--phone .crm-stack > * { width:auto !important; min-width:0 !important; max-width:100% !important; flex:none !important; }
.crm--phone .crm-fill { width:100% !important; flex:1 1 auto !important; border-right:0 !important; }
.crm--phone .crm-wrap { flex-wrap:wrap !important; }
.crm--phone .crm-first { order:-1; }
/* Pop-up menus open as a sheet above the bottom bar, never off the left edge. */
.crm--phone .crm-pop { position:fixed !important; left:12px !important; right:12px !important; top:auto !important;
  bottom:calc(70px + env(safe-area-inset-bottom)) !important; width:auto !important; max-height:60vh !important; overflow:auto !important; z-index:70 !important; }
/* A building's flat row: photo and name on one line, the inputs under them. */
.crm--phone .crm-flatrow { grid-template-columns:auto 48px minmax(0,1fr) !important; }
.crm--phone .crm-flatrow > :nth-child(n+4) { grid-column:2 / -1; }
.crm--phone .crm-wrap > input, .crm--phone .crm-wrap > select { min-width:0 !important; flex:1 1 160px !important; }
.crm--phone .crm-colhead { padding:10px 14px; }
`;
