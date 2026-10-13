/**
 * The frame every main screen shares (the Square Connect-style layout):
 *   - the top bar: menu (profile) button · logo · To-Let · bell · wallet;
 *   - the menu that slides in from the left, everything grouped — Flats,
 *     Clients, Grow, money, help;
 *   - the bottom bar (Home · Inventory · Leads · Groups · Premium) and the
 *     floating + for a new flat or client.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, Crown, Download, HelpCircle, Home, LayoutDashboard, LogOut, MessageCircle, Plus, TrendingUp, UserRound, Users, Wallet, X, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "./PartnerApp";
import { Avatar } from "./partnerUi";
import { NotificationBell } from "./PartnerInbox";
import { useGoldLogo } from "./PremiumJourney";
import logo from "../../assets/logo/moveazy-logo-mint-dark.png";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { PUBLIC_ORIGIN, isPartnerHost, pp } from "../../lib/partners";
import { fetchMyRating } from "../../lib/storefront";
import { openInstall, useInstall } from "./InstallApp";

/** The partner's path inside the app: "/leads", "/" … */
export function useRel() {
  const { pathname } = useLocation();
  return pathname.slice(pp("/").replace(/\/$/, "").length) || "/";
}

/** The menu button doubles as the profile icon, as on Square Connect. */
function MenuGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M17 9h4M17 13h4M18.5 17H21" />
    </svg>
  );
}

/** The top bar of Home, Inventory and Leads. `children`: a row under it (search, chips). */
export function PartnerHeader({ children }) {
  const { status, unread, openMenu } = usePartner();
  const gold = Boolean(status?.plan?.active && status?.profile?.completed_at);
  const goldLogo = useGoldLogo(gold ? logo : "");
  return (
    <header className="pc-head">
      <div className="pc-bar">
        <button type="button" className="pc-menu" aria-label="Open menu" onClick={openMenu}><MenuGlyph /></button>
        <Link to={pp("/")} aria-label="MovEazy Partners home" style={{ lineHeight: 0 }}>
          <img src={goldLogo || logo} alt="MovEazy" height="21" style={{ height: 21, width: "auto" }} />
        </Link>
        <span style={{ flex: 1 }} />
        <Link to={pp("/qr")} className="pz-tolet" aria-label="To-Let QR poster">To-Let</Link>
        <NotificationBell count={unread} />
        <Link to={pp("/referrals")} className="pz-iconbtn" aria-label="Wallet"><Wallet size={21} /></Link>
      </div>
      {children}
    </header>
  );
}

const BAR_TABS = [
  { to: "/", label: "Home", icon: Home, on: (r) => r === "/" },
  { to: "/inventory", label: "Inventory", icon: Building2, on: (r) => /^\/(inventory|property|my-flats|saved)/.test(r) },
  { to: "/leads", label: "Leads", icon: UserRound, on: (r) => /^\/(leads|tenants|ai-matcher|curated)/.test(r) },
  { to: "/groups", label: "Groups", icon: MessageCircle, on: (r) => r.startsWith("/groups") },
  { to: "/premium", label: "Premium", icon: Crown, on: (r) => r.startsWith("/premium") },
];

/** The bottom bar: five tabs, the open one marked in gold. */
export function BottomNav() {
  const rel = useRel();
  return (
    <nav className="pz-nav" aria-label="Partner app">
      {BAR_TABS.map(({ to, label, icon: Icon, on }) => {
        const active = on(rel);
        return (
          <Link key={to} to={pp(to)} className={active ? "on" : ""} aria-current={active ? "page" : undefined}>
            <Icon size={23} strokeWidth={active ? 2.1 : 1.8} />{label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Where the floating + shows: the main tabs. */
export const FAB_ON = /^\/(inventory|leads|groups)?$/;

/** The floating + — a flat or a client. Sits above the demo's Join bar when that shows. */
export function AddFab({ onClick, raised = false }) {
  return (
    <button type="button" className={`pc-fab${raised ? " pc-fab--raised" : ""}`} aria-label="Add a flat or a client" onClick={onClick}>
      <Plus size={28} strokeWidth={2.4} />
    </button>
  );
}

/** The menu: everything in the app, grouped, with sign-out at the foot. */
export function MenuDrawer({ open, onClose }) {
  const { logout } = useAuth();
  const { me, status, demo } = usePartner();
  const rel = useRel();
  const p = me?.partner;
  const [rating, setRating] = useState(null);
  const install = useInstall();
  useEffect(() => {
    if (!open || rating != null) return;
    fetchMyRating().then((r) => setRating(r?.rating ?? 0), () => setRating(0));
  }, [open, rating]);

  // Closes when a link inside takes you somewhere, and on Escape.
  const lastRel = useRef(rel);
  useEffect(() => {
    if (lastRel.current !== rel) { lastRel.current = rel; onClose(); }
  }, [rel, onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;

  const plan = status?.plan?.active ? "Premium" : status?.trial?.active ? "Trial Premium" : "Free plan";
  const sub = (to, label, extra) => <Link to={pp(to)} className="pc-sub">{label}{extra}</Link>;
  return (
    <div className="pc-scrim" onClick={onClose} role="presentation">
      <nav className="pc-drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="pc-dhead">
          <Avatar name={p?.name || "You"} size="lg" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{p?.name || "Partner"}</b>
            <span>{rating ? `★ ${Number(rating).toFixed(1)} · ` : ""}{plan}</span>
          </span>
          <Link to={pp("/more")} className="pc-profile">Profile</Link>
          <button type="button" className="pz-iconbtn" aria-label="Close menu" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="pc-group">
          <span className="pc-gh"><Building2 size={19} /> Flats</span>
          {sub("/inventory", "Browse inventory")}
          {sub("/add/property", "Add a flat")}
          {sub("/my-flats", "My flats")}
          {sub("/saved", "Saved flats")}
        </div>
        <div className="pc-group">
          <span className="pc-gh"><Users size={19} /> Clients</span>
          {sub("/leads", "My leads")}
          {sub("/leads/new", "Add a client")}
          {sub("/leads?tab=moveazy", "MovEazy leads")}
          {sub("/ai-matcher", "AI Property Matcher")}
        </div>
        <div className="pc-group">
          <span className="pc-gh"><TrendingUp size={19} /> Grow</span>
          {sub("/qr", "To-Let poster")}
          {sub("/insights", "Leads dashboard")}
          {sub("/building-leads", "Building visits")}
          {sub("/groups", "Broker groups")}
        </div>
        <div className="pc-group">
          <Link to={pp("/referrals")} className="pc-main"><Wallet size={19} color="#8A6419" /> Wallet · Refer &amp; Earn</Link>
          <Link to={pp("/premium")} className="pc-main"><Crown size={19} color="#8A6419" /> Premium plans</Link>
          {install.available && (
            <button type="button" className="pc-main pc-btn" onClick={() => { onClose(); openInstall(); }}><Download size={19} /> Install the app</button>
          )}
          <a className="pc-main" href={`${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent("Hi MovEazy, I need help with the partner app.")}`}
            target="_blank" rel="noreferrer"><HelpCircle size={19} /> Help on WhatsApp</a>
          {me?.staff && (
            <>
              <a className="pc-main" href={`${isPartnerHost() ? PUBLIC_ORIGIN : ""}/crm/brokers`} target="_blank" rel="noreferrer"><LayoutDashboard size={19} /> Open CRM</a>
              <Link to={pp("/sales-funnel")} className="pc-main"><TrendingUp size={19} /> Sales funnel</Link>
              <a className="pc-main" href={`${pp("/")}?demo=${demo ? "0" : "1"}`}><Eye size={19} /> {demo ? "Leave demo preview" : "Preview demo mode"}</a>
            </>
          )}
        </div>

        <div className="pc-foot">
          <button type="button" className="pc-out" onClick={() => logout()}><LogOut size={19} /> Log out</button>
          <a href={`${PUBLIC_ORIGIN}/terms`} target="_blank" rel="noreferrer" className="pc-terms">Terms</a>
        </div>
      </nav>
    </div>
  );
}

export const CHROME_CSS = `
.pc-head { position: relative; background: var(--noir); color: #fff; }
.pc-bar { display: flex; align-items: center; gap: 6px; min-height: 60px; padding: 0 10px 0 10px; }
.pc-head .pz-iconbtn { color: #fff; }
.pc-menu { width: 42px; height: 42px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.7); background: transparent; color: #fff;
  display: grid; place-items: center; padding: 0; cursor: pointer; margin-right: 4px; flex: none; }
.pc-menu:active { background: var(--noir3); }
.pc-band { background: #ECE9E2; padding: 10px 0 10px 12px; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.pc-band::-webkit-scrollbar { display: none; }
.pc-pill { flex: none; height: 42px; padding: 0 17px; border-radius: 999px; border: 1px solid #E0DCD3; background: #fff; color: var(--ink);
  font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.pc-pill.on { background: var(--noir); border-color: var(--noir); color: #fff; }
.pc-pill--gold { border-color: #F1D99B; background: #FEF7E6; color: #7A5A12; }
.pc-pill--gold.on { background: var(--noir); border-color: var(--noir); color: #F0CF7C; }
.pc-pill:last-child { margin-right: 12px; }
.pc-search { flex: none; height: 42px; padding: 0 14px; border-radius: 999px; background: #fff; display: flex; align-items: center; gap: 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06); color: #C8102E; }
.pc-search input { width: 150px; border: 0; outline: 0; font: inherit; font-size: 14.5px; background: transparent; color: var(--ink); }
.pc-fab { position: fixed; z-index: 31; bottom: calc(90px + env(safe-area-inset-bottom)); right: max(16px, calc(50% - 260px + 16px));
  width: 60px; height: 60px; border-radius: 999px; border: 0; background: var(--goldg); color: #1F1605; display: grid; place-items: center;
  box-shadow: 0 10px 24px rgba(212,164,55,.45); cursor: pointer; }
.pc-fab--raised { bottom: calc(150px + env(safe-area-inset-bottom)); }
.pc-fab:active { transform: scale(.96); }
.pc-scrim { position: fixed; inset: 0; z-index: 70; background: rgba(14,13,18,.55); animation: pcfade .16s ease; }
@keyframes pcfade { from { opacity: 0; } }
.pc-drawer { position: absolute; top: 0; bottom: 0; left: max(0px, calc(50% - 260px)); width: min(84vw, 320px); background: #fff; overflow-y: auto;
  display: flex; flex-direction: column; box-shadow: 8px 0 30px rgba(0,0,0,.25); animation: pcin .2s ease-out; padding-bottom: env(safe-area-inset-bottom); }
@keyframes pcin { from { transform: translateX(-24px); opacity: 0; } }
.pc-dhead { display: flex; align-items: center; gap: 10px; padding: 14px 8px 14px 14px; background: var(--noir); color: #fff; }
.pc-dhead b { display: block; font-size: 16px; }
.pc-dhead span span { font-size: 12.5px; color: #F0CF7C; font-weight: 700; }
.pc-dhead .pz-iconbtn { color: #fff; }
.pc-profile { color: #fff; font-size: 13px; font-weight: 800; text-decoration: underline; }
.pc-group { display: flex; flex-direction: column; padding: 6px 0; border-bottom: 1px solid #EFECE6; }
.pc-gh { display: flex; align-items: center; gap: 12px; padding: 8px 18px 4px; font-size: 15.5px; font-weight: 800; color: var(--ink); }
.pc-gh svg { color: var(--g); }
.pc-sub { padding: 9px 18px 9px 49px; font-size: 14.5px; color: var(--ink); text-decoration: none; }
.pc-sub:active, .pc-main:active { background: var(--bg); }
.pc-main { display: flex; align-items: center; gap: 12px; padding: 11px 18px; font-size: 15px; font-weight: 800; color: var(--ink); text-decoration: none; }
.pc-btn { width: 100%; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
.pc-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding: 12px 18px 16px; }
.pc-out { display: flex; align-items: center; gap: 10px; border: 0; background: none; padding: 6px 0; font: inherit; font-size: 15px; font-weight: 800;
  color: #C8102E; cursor: pointer; }
.pc-terms { font-size: 12.5px; color: var(--dim); }
`;
