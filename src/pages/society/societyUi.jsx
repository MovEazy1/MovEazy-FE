/**
 * MovEazy Society — look and building blocks. The PRD's palette: deep
 * emerald, emerald, teal, cream; big tap targets, one strong button a screen.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Home, Users, Wallet } from "lucide-react";
import { sp } from "../../lib/society";
import logoLight from "../../assets/logo/moveazy-logo-mint-light.png";
import logoDark from "../../assets/logo/moveazy-logo-mint-dark.png";

export const HELP_WHATSAPP = "918090911024";

/** The official wordmark, with "Society" under it. */
export function SocietyLogo({ dark = false, size = 34 }) {
  return (
    <span className="sx-logo">
      <img src={dark ? logoDark : logoLight} alt="MovEazy" style={{ height: size }} />
      <span style={{ color: dark ? "#7FE3D7" : "#0A6B4E" }}>Society</span>
    </span>
  );
}

/** Towers among trees — the splash and the home card. */
export function BuildingArt({ className = "", tone = "light" }) {
  const wall = tone === "light" ? "#EFE6D2" : "#F4EEDF";
  const side = tone === "light" ? "#DCCFB4" : "#E3D8C0";
  const win = tone === "light" ? "#9DB7AE" : "#7FA79A";
  const tree = "#2F7D5B";
  const windows = (x, y, cols, rows, w = 9, h = 11, gx = 6, gy = 9) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(<rect key={`${x}-${r}-${c}`} x={x + c * (w + gx)} y={y + r * (h + gy)} width={w} height={h} rx="1.5" fill={win} />);
    return out;
  };
  return (
    <svg className={className} viewBox="0 0 320 210" role="img" aria-label="Apartment towers">
      <defs>
        <linearGradient id="sxsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity="0" /><stop offset="1" stopColor="#E7F1EA" /></linearGradient>
      </defs>
      {tone === "light" && <rect x="0" y="0" width="320" height="210" fill="url(#sxsky)" />}
      <rect x="40" y="70" width="70" height="125" fill={wall} /><rect x="110" y="70" width="12" height="125" fill={side} />
      {windows(48, 82, 4, 5)}
      <rect x="132" y="28" width="86" height="167" fill={wall} /><rect x="218" y="28" width="14" height="167" fill={side} />
      <rect x="128" y="22" width="108" height="8" rx="2" fill={side} />
      {windows(141, 42, 5, 7)}
      <rect x="240" y="92" width="52" height="103" fill={wall} /><rect x="292" y="92" width="10" height="103" fill={side} />
      {windows(247, 104, 3, 4)}
      {[[28, 178, 20], [70, 186, 14], [122, 182, 18], [208, 186, 15], [252, 180, 19], [300, 186, 13]].map(([cx, cy, r]) => (
        <g key={cx}><rect x={cx - 2} y={cy} width="4" height="18" fill="#5B4636" /><circle cx={cx} cy={cy - r / 3} r={r} fill={tree} opacity=".92" /></g>
      ))}
      {tone === "light" && <rect x="0" y="196" width="320" height="14" fill="#D9E8DF" />}
    </svg>
  );
}

/** The top of a screen: back, title, and something on the right. */
export function TopBar({ title, back, right, sub }) {
  const navigate = useNavigate();
  const goBack = () => (typeof back === "string" ? navigate(back) : navigate(-1));
  return (
    <header className="sx-top">
      <div className="sx-top-row">
        {back && <button type="button" className="sx-icon" onClick={goBack} aria-label="Back"><ArrowLeft size={22} /></button>}
        <h1>{title}</h1>
        {right && <span className="sx-top-right">{right}</span>}
      </div>
      {sub && <p className="sx-sub">{sub}</p>}
    </header>
  );
}

/** Add Flat / Invite style: a chevron above a big title. */
export function FormHead({ title, sub, onBack }) {
  const navigate = useNavigate();
  return (
    <header className="sx-formhead">
      <button type="button" className="sx-icon" onClick={onBack || (() => navigate(-1))} aria-label="Back"><ChevronLeft size={24} /></button>
      <h1>{title}</h1>
      {sub && <p className="sx-sub">{sub}</p>}
    </header>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const rel = pathname.replace(/^\/society/, "") || "/";
  const tabs = [
    ["/", "Home", Home], ["/flats", "Flats", Building2], ["/earnings", "Earnings", Wallet], ["/members", "Members", Users],
  ];
  return (
    <nav className="sx-nav" aria-label="Main">
      {tabs.map(([to, label, Icon]) => {
        const on = to === "/" ? rel === "/" : rel.startsWith(to);
        return (
          <Link key={to} to={sp(to)} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon size={22} strokeWidth={on ? 2.4 : 1.8} /><span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className={`sx-field${error ? " bad" : ""}`}>
      <span className="sx-label">{label}</span>
      {children}
      {error ? <span className="sx-err">{error}</span> : hint ? <span className="sx-hint">{hint}</span> : null}
    </label>
  );
}

/** Segmented choice (Furnished / Semi / Unfurnished, Available / Occupied). */
export function Seg({ options, value, onChange, pill = false, label }) {
  return (
    <div className={`sx-seg${pill ? " sx-seg--pill" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ occupancy }) {
  return occupancy === "occupied" ? <span className="sx-pill sx-pill--occ">Occupied</span> : <span className="sx-pill">Available</span>;
}

export function FlatThumb({ flat, className = "sx-thumb" }) {
  const src = flat?.cover_image_url || flat?.images?.[0];
  return <span className={className}>{src ? <img src={src} alt="" loading="lazy" /> : <Building2 size={24} />}</span>;
}

export function FlatRow({ flat, to }) {
  return (
    <Link to={to} className="sx-row">
      <FlatThumb flat={flat} />
      <span className="sx-row-main">
        <b>{flat.label}</b>
        <span>{String(flat.bhk || "").replace(/\s+/g, "")} • ₹{Math.round(flat.rent || 0).toLocaleString("en-IN")}</span>
        <StatusPill occupancy={flat.occupancy} />
      </span>
      <ChevronRight size={20} className="sx-chev" />
    </Link>
  );
}

export function Avatar({ name, size = 44 }) {
  return <span className="sx-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>{(String(name || "").trim()[0] || "M").toUpperCase()}</span>;
}

export function Loading({ label = "Loading…" }) {
  return <div className="sx-loading" role="status"><span />{label}</div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="sx-empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ── Toasts ── */
let pushToast = null;
export function toast(text, kind = "ok") { pushToast?.({ text, kind, id: Date.now() + Math.random() }); }
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3600);
    };
    return () => { pushToast = null; };
  }, []);
  return <div className="sx-toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`sx-toast ${t.kind}`}>{t.text}</div>)}</div>;
}

/** A sheet from the bottom (member actions, confirmations). */
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sx-sheet-back" onClick={onClose} role="presentation">
      <div className="sx-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sx-grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function SocietyStyles() {
  return <style>{CSS}</style>;
}

const CSS = `
.sx { --deep: #063B2D; --em: #0A6B4E; --teal: #00BFAE; --cream: #F7F4EC; --ink: #17211D; --dim: #5E6B66; --line: #E7E2D6;
  --card: #FFFFFF; --mint: #E3F4EC; --mintink: #127A55; --amber: #FFF4E0; --amberink: #9A5B00;
  min-height: 100vh; min-height: 100dvh; background: var(--cream); color: var(--ink);
  font-family: Manrope, Inter, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
.sx *, .sx *::before, .sx *::after { box-sizing: border-box; }
.sx-col { max-width: 520px; margin: 0 auto; padding: 0 18px; }
.sx-page { max-width: 520px; margin: 0 auto; padding: 0 18px 110px; }
.sx button { font: inherit; }
:where(.sx) a { color: inherit; }
.sx-logo { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.sx-logo img { width: auto; display: block; }
.sx-logo span { font-weight: 700; font-size: 17px; letter-spacing: .01em; }
.sx-icon { width: 42px; height: 42px; border-radius: 99px; border: 0; background: transparent; display: grid; place-items: center; color: var(--ink); cursor: pointer; flex: none; }
.sx-icon:active { background: #ECE7DA; }
.sx-top { padding: 14px 0 6px; }
.sx-top-row { display: flex; align-items: center; gap: 4px; margin-left: -8px; }
.sx-top h1 { font-size: 22px; font-weight: 800; margin: 0; flex: 1; letter-spacing: -0.01em; }
.sx-top-right { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.sx-sub { color: var(--dim); font-size: 14px; margin: 6px 0 0; line-height: 1.45; }
.sx-formhead { padding: 12px 0 6px; }
.sx-formhead .sx-icon { margin-left: -10px; }
.sx-formhead h1 { font-size: 30px; font-weight: 800; margin: 6px 0 0; letter-spacing: -0.02em; }
.sx-h2 { font-size: 16px; font-weight: 800; margin: 22px 0 10px; }
.sx-section-head { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 10px; }
.sx-section-head h2 { font-size: 17px; font-weight: 800; margin: 0; }
.sx-link { color: var(--em); font-weight: 700; font-size: 14.5px; text-decoration: none; background: none; border: 0; cursor: pointer; padding: 6px 0; }
.sx-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 56px; border-radius: 14px; border: 0; cursor: pointer;
  background: linear-gradient(180deg, #0E7A57, var(--em) 55%, #08593F); color: #fff; font-size: 17px; font-weight: 700; text-decoration: none;
  box-shadow: 0 8px 20px rgba(6,59,45,.22); }
.sx-btn:disabled { opacity: .55; cursor: default; box-shadow: none; }
.sx-btn--ghost { background: #fff; color: var(--em); border: 1.5px solid #CFE5DA; box-shadow: none; }
.sx-btn--wa { background: linear-gradient(180deg, #2BCB6A, #1EA854); }
.sx-btn--danger { background: #fff; color: #C2410C; border: 1.5px solid #F6D2BF; box-shadow: none; }
.sx-btn-bar { position: sticky; bottom: 0; padding: 14px 0 calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(247,244,236,0), var(--cream) 30%); }
.sx-field { display: grid; gap: 6px; margin-top: 14px; }
.sx-label { font-size: 13.5px; color: var(--dim); font-weight: 600; }
.sx-input, .sx-select, .sx-textarea { width: 100%; min-height: 52px; border: 1.5px solid var(--line); border-radius: 12px; background: #fff; padding: 0 14px;
  font: inherit; font-size: 16.5px; color: var(--ink); outline: none; }
.sx-textarea { padding: 12px 14px; min-height: 92px; resize: vertical; line-height: 1.45; }
.sx-select { appearance: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2317211D' stroke-width='2.4'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center; padding-right: 40px; }
.sx-input:focus, .sx-select:focus, .sx-textarea:focus { border-color: var(--em); box-shadow: 0 0 0 3px rgba(10,107,78,.12); }
.sx-field.bad .sx-input, .sx-field.bad .sx-select { border-color: #E5484D; }
.sx-err { color: #C62828; font-size: 13px; font-weight: 600; }
.sx-hint { color: var(--dim); font-size: 12.5px; }
.sx-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sx-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 1.5px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
.sx-seg button { min-height: 50px; border: 0; background: transparent; color: var(--ink); font-size: 15.5px; font-weight: 600; cursor: pointer; border-left: 1.5px solid var(--line); }
.sx-seg button:first-child { border-left: 0; }
.sx-seg button.on { background: var(--em); color: #fff; }
.sx-seg--pill { border-radius: 99px; background: #EFEBE0; border: 0; padding: 4px; gap: 4px; }
.sx-seg--pill button { border: 0; border-radius: 99px; min-height: 46px; color: var(--ink); }
.sx-seg--pill button.on { background: var(--em); color: #fff; box-shadow: 0 4px 12px rgba(6,59,45,.25); }
.sx-pill { display: inline-block; align-self: flex-start; padding: 3px 10px; border-radius: 99px; background: var(--mint); color: var(--mintink); font-size: 12.5px; font-weight: 700; }
.sx-pill--occ { background: #F0ECE3; color: #6B6253; }
.sx-pill--warn { background: var(--amber); color: var(--amberink); }
.sx-card { background: var(--card); border-radius: 18px; border: 1px solid #EEE9DD; box-shadow: 0 6px 20px rgba(23,33,29,.05); }
.sx-row { display: flex; align-items: center; gap: 14px; padding: 12px; margin-bottom: 12px; background: #fff; border-radius: 16px; border: 1px solid #EEE9DD;
  box-shadow: 0 4px 14px rgba(23,33,29,.04); text-decoration: none; color: inherit; }
.sx-thumb { width: 84px; height: 72px; border-radius: 12px; overflow: hidden; flex: none; background: #E9E3D3; display: grid; place-items: center; color: #9B917C; }
.sx-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sx-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.sx-row-main b { font-size: 17px; }
.sx-row-main > span:not(.sx-pill) { color: #3D4A45; font-size: 14.5px; }
.sx-chev { color: #8C958F; flex: none; }
.sx-avatar { border-radius: 99px; background: #CFE7DC; color: var(--em); display: grid; place-items: center; font-weight: 800; flex: none; }
.sx-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: grid; grid-template-columns: repeat(4, 1fr); background: #fff;
  border-top: 1px solid #ECE7DB; padding: 8px max(8px, calc((100% - 520px) / 2)) calc(8px + env(safe-area-inset-bottom)); }
.sx-nav a { display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; color: #7C8782; font-size: 12.5px; font-weight: 600; padding: 4px 0; }
.sx-nav a.on { color: var(--em); font-weight: 800; }
.sx-loading { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--dim); font-weight: 600; }
.sx-loading span { width: 34px; height: 34px; border-radius: 99px; border: 3px solid #DCD6C6; border-top-color: var(--em); animation: sxspin .8s linear infinite; }
@keyframes sxspin { to { transform: rotate(360deg); } }
.sx-empty { text-align: center; padding: 36px 16px; color: var(--dim); }
.sx-empty b { display: block; color: var(--ink); font-size: 17px; margin-bottom: 6px; }
.sx-empty p { margin: 0 0 16px; line-height: 1.5; }
.sx-toasts { position: fixed; left: 0; right: 0; bottom: 92px; z-index: 80; display: grid; justify-items: center; gap: 8px; pointer-events: none; padding: 0 16px; }
.sx-toast { background: var(--deep); color: #fff; padding: 12px 16px; border-radius: 12px; font-weight: 600; font-size: 14.5px; max-width: 480px; box-shadow: 0 10px 26px rgba(0,0,0,.2); }
.sx-toast.error { background: #B42318; }
.sx-sheet-back { position: fixed; inset: 0; z-index: 70; background: rgba(10,20,16,.45); display: flex; align-items: flex-end; justify-content: center; }
.sx-sheet { width: 100%; max-width: 520px; background: var(--cream); border-radius: 22px 22px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom)); max-height: 88dvh; overflow-y: auto; }
.sx-grab { width: 42px; height: 5px; border-radius: 99px; background: #D6CFBF; margin: 0 auto 12px; }
.sx-sheet h2 { font-size: 20px; margin: 0 0 6px; }
.sx-banner { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; margin-top: 14px; }
.sx-banner svg { flex: none; margin-top: 1px; }
.sx-banner--mint { background: var(--mint); color: #0E5A40; }
.sx-banner--amber { background: var(--amber); color: #7A4A00; border: 1px solid #F5DDB0; }
.sx-banner--red { background: #FDECEC; color: #8A1C1C; }
.sx-banner b { font-weight: 800; }
`;
