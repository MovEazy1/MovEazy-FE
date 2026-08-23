/**
 * Shared site chrome for the movEAZY design system — the fixed top bar, the
 * mobile hamburger sheet and the mobile bottom action bar.
 *
 * Every page renders this so the navigation is identical site-wide. It carries
 * its own <style> block and scroll listener, so a page only has to drop it in.
 *
 * @param {"home"|"how"|"about"|"register-broker"|""} active — link to highlight
 * @param {boolean} transparentAtTop — true only on the dark hero home page, where
 *   the bar starts see-through and fades in a background as you scroll. Every
 *   other page keeps the solid bar so the light-background pages stay readable.
 * @param {() => void} [onFindFlat] — page-supplied "find a flat" handler. Home
 *   passes its own (preferences check → recommendations or the choice modal);
 *   elsewhere we deep-link to home's `?search=1`, which runs that same flow.
 * @param {() => void} [onGetAgent] — page-supplied "open the AI preferences
 *   chat" handler; pages holding their own <AIBroker/> pass it so the chat opens
 *   in place. Without one we deep-link to home's `?find=1`, which opens it there.
 */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLoginModal } from "../../context/LoginModalContext";
import { useVisitCart } from "../../context/VisitCartContext";
import logoMint from "../../assets/logo/moveazy-logo-mint-dark.png";

const LINK_BASE = {
  color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)",
  padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap", flex: "none",
};
const LINK_ACTIVE = {
  ...LINK_BASE, background: "#5EEAD4", color: "#04211D", fontWeight: 700,
  padding: "10px clamp(14px,1.6vw,20px)",
};

function FlatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <path d="M3.5 21V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V21" />
      <path d="M14.5 10h5a1 1 0 0 1 1 1v10" />
      <path d="M2 21h20" />
      <path d="M6.5 7.5h1.5M10 7.5h1.5M6.5 11.5h1.5M10 11.5h1.5M6.5 15.5h1.5M10 15.5h1.5" />
      <path d="M17 14h1M17 17.5h1" />
    </svg>
  );
}
function OwnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <path d="M3.5 10.6 12 4l8.5 6.6" />
      <path d="M5.5 12.4V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7.6" />
      <circle cx="12" cy="13.4" r="1.9" />
      <path d="M8.9 20a3.1 3.1 0 0 1 6.2 0" />
    </svg>
  );
}
function BrokerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="23" height="23">
      <circle cx="12" cy="5.2" r="3.1" />
      <path d="M6 21v-1.3c0-2.3 1.9-4.1 4.3-4.5" />
      <path d="M18 21v-1.3c0-2.3-1.9-4.1-4.3-4.5" />
      <path d="M10.3 9.3 12 11.1l1.7-1.8" />
      <path d="M12 11.1 10.9 14.6 12 17.6l1.1-3z" />
    </svg>
  );
}

export default function MovEazyNav({ active = "", transparentAtTop = false, onFindFlat, onGetAgent }) {
  const { user, logout } = useAuth();
  const { openLogin } = useLoginModal();
  const { count: cartCount } = useVisitCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const [navH, setNavH] = useState(72);

  // Close the sheet whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock page scroll and allow Escape to dismiss while the sheet is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  // Drives both the bar background and the scroll-progress strip.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(sy > 40);
      setProgress(total > 0 ? Math.max(0, Math.min(1, sy / total)) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => setNavH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const listMyFlat = () => (user ? navigate("/list-my-flat") : openLogin(() => navigate("/list-my-flat")));
  const findFlat = () => (onFindFlat ? onFindFlat() : navigate("/?search=1"));
  const getAgent = () => (onGetAgent ? onGetAgent() : navigate("/?find=1"));
  const closeThen = (fn) => () => { setMenuOpen(false); fn(); };

  // Solid whenever the page isn't a dark hero, or once the reader scrolls.
  const solid = !transparentAtTop || scrolled;

  return (
    <>
      <style>{`
        .mzn-nav-root a { text-decoration: none; }
        .mzn-nav-root button { font-family: inherit; cursor: pointer; }
        .mzn-nav-root button:focus-visible, .mzn-nav-root a:focus-visible { outline: 2px solid #5EEAD4; outline-offset: 3px; border-radius: 4px; }
        .mzn-nav-link:hover { color: #FFFFFF; background: rgba(255,255,255,.06); }
        .mzn-badge-new { background: linear-gradient(135deg,#FFE1A6,#E8A33D 45%,#B9782A); box-shadow: 0 0 0 1px rgba(255,255,255,.35) inset, 0 1px 4px rgba(232,163,61,.5); color: #1B1204; font-size: 8px; font-weight: 800; letter-spacing: .02em; padding: 1.5px 6px; border-radius: 100px; line-height: 1.6; align-self: flex-start; margin-top: -4px; }
        .mzn-burger { display: none; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; background: rgba(255,255,255,.08); border-radius: 50%; color: #F1F6F4; flex: none; }
        .mzn-burger svg { display: block; }
        .mzn-sheet, .mzn-backdrop, .mzn-bottombar { display: none; }

        @media (max-width: 900px) {
          .mzn-nav { padding: 12px 14px !important; gap: 10px !important; }
          /* The horizontally-scrolling pill can't fit on a phone — it collapses
             into the hamburger sheet instead. */
          .mzn-nav-links, .mzn-nav-cta, .mzn-nav-account { display: none !important; }
          .mzn-burger { display: inline-flex; margin-left: auto; }

          .mzn-backdrop {
            display: block; position: fixed; inset: 0; z-index: 170;
            background: rgba(2,16,14,.5); opacity: 0; pointer-events: none;
            transition: opacity .25s ease;
          }
          .mzn-backdrop.is-open { opacity: 1; pointer-events: auto; }
          .mzn-sheet {
            display: flex; flex-direction: column; gap: 4px;
            position: absolute; top: calc(100% + 6px); left: 14px; right: 14px; z-index: 185;
            background: #062D27; border: 1px solid rgba(255,255,255,.10);
            border-radius: 20px; padding: 10px;
            box-shadow: 0 24px 60px rgba(0,0,0,.55);
            transform: translateY(-10px) scale(.98); opacity: 0; pointer-events: none;
            transform-origin: top center;
            transition: transform .26s cubic-bezier(.22,1,.36,1), opacity .22s ease;
          }
          .mzn-sheet.is-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
          .mzn-nav-root .mzn-sheet-link {
            display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 16px;
            border-radius: 12px; font-size: 15px; font-weight: 600; color: #CBD9D5;
            background: none; border: none; width: 100%; text-align: left;
          }
          .mzn-nav-root .mzn-sheet-link.is-active { background: #5EEAD4; color: #04211D; font-weight: 700; }
          .mzn-nav-root .mzn-sheet-link:active { background: rgba(255,255,255,.07); }
          .mzn-nav-root .mzn-sheet-link.is-active:active { background: #5EEAD4; }
          .mzn-sheet-link .mzn-badge-new { align-self: center; margin-top: 0; }
          .mzn-sheet-cta {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            min-height: 48px; margin-top: 2px; border: none; border-radius: 100px;
            background: #5EEAD4; color: #04211D; font-size: 15px; font-weight: 700;
          }
          .mzn-sheet-divider { height: 1px; background: rgba(255,255,255,.10); margin: 6px 4px; }
          .mzn-sheet-signin {
            display: flex; align-items: center; justify-content: center; gap: 7px;
            min-height: 48px; border-radius: 100px; border: 1px solid rgba(255,255,255,.22);
            background: transparent; color: #F1F6F4; font-size: 15px; font-weight: 600;
          }

          /* Fixed bottom action bar. env(safe-area-inset-bottom) keeps it clear
             of the iOS home indicator. */
          .mzn-bottombar {
            display: grid; grid-template-columns: repeat(3, 1fr);
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 190;
            background: rgba(4,33,29,.95);
            -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
            border-top: 1px solid rgba(255,255,255,.10);
            padding: 8px 4px calc(8px + env(safe-area-inset-bottom, 0px));
          }
          .mzn-bottombar button {
            display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
            gap: 5px; padding: 6px 2px; background: none; border: none;
            color: #CBD9D5; font-size: 11px; font-weight: 700; line-height: 1.2;
            text-align: center; letter-spacing: -.01em;
          }
          .mzn-bottombar button:active { color: #5EEAD4; }
          .mzn-bottombar svg { flex: none; }

          /* Every page must clear the fixed bottom bar. */
          body { padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      <div className="mzn-nav-root">
        <div style={{ position: "fixed", top: 0, left: 0, height: 3, width: `${progress}%`, background: "linear-gradient(90deg,#5EEAD4,#E8A33D)", zIndex: 200 }} />

        <nav
          ref={navRef}
          className="mzn-nav"
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", zIndex: 180,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: solid ? "15px clamp(14px,3vw,50px)" : "24px clamp(14px,3vw,50px)",
            transition: "background .3s ease, padding .3s ease, border-color .3s ease",
            borderBottom: `1px solid ${solid ? "rgba(255,255,255,.08)" : "transparent"}`,
            background: solid ? "rgba(4,33,29,.86)" : "transparent",
            backdropFilter: solid ? "blur(14px)" : "none",
            WebkitBackdropFilter: solid ? "blur(14px)" : "none",
            gap: "clamp(6px,1.4vw,20px)",
          }}
        >
          <Link to="/" style={{ flex: "none", display: "flex", alignItems: "center" }} aria-label="movEAZY home">
            <img src={logoMint} alt="movEAZY" draggable={false} style={{ height: "clamp(26px,2.4vw,34px)", width: "auto", display: "block" }} />
          </Link>

          <div className="mzn-nav-links" style={{ display: "flex", alignItems: "center", gap: "clamp(2px,.6vw,8px)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 100, padding: 6, flex: 1, minWidth: 0, maxWidth: 780, overflowX: "auto", scrollbarWidth: "none", justifyContent: "center" }}>
            <Link to="/" className="mzn-nav-link" style={active === "home" ? LINK_ACTIVE : LINK_BASE}>Home</Link>
            <Link to="/how-it-works" className="mzn-nav-link" style={active === "how" ? LINK_ACTIVE : LINK_BASE}>How it Works</Link>
            <Link to="/about" className="mzn-nav-link" style={active === "about" ? LINK_ACTIVE : LINK_BASE}>About Us</Link>
            <button type="button" className="mzn-nav-link" onClick={listMyFlat} style={{ ...LINK_BASE, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none" }}>
              Register as an Owner<span className="mzn-badge-new">new</span>
            </button>
            <Link to="/register-broker" className="mzn-nav-link" style={{ ...(active === "register-broker" ? LINK_ACTIVE : LINK_BASE), display: "flex", alignItems: "center", gap: 6 }}>
              Register as a Broker<span className="mzn-badge-new">new</span>
            </Link>
          </div>

          <div className="mzn-nav-account" style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            {cartCount > 0 && (
              <button type="button" onClick={() => navigate("/visits")} aria-label={`${cartCount} site visits`}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "#F1F6F4", fontWeight: 700, fontSize: 13, padding: "10px 16px", borderRadius: 100, whiteSpace: "nowrap" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-2 4h12" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" />
                </svg>
                Site visits
                <span style={{ minWidth: 19, height: 19, padding: "0 5px", borderRadius: 100, background: "#5EEAD4", color: "#04211D", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>
              </button>
            )}
            <a href="#" className="mzn-nav-cta" onClick={(e) => { e.preventDefault(); findFlat(); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#5EEAD4", color: "#04211D", fontWeight: 700, fontSize: "clamp(12px,1.1vw,15px)", padding: "11px clamp(12px,1.6vw,22px)", borderRadius: 100, flex: "none", whiteSpace: "nowrap" }}>
              Start your move <span style={{ fontSize: 13 }}>&#8599;</span>
            </a>
            {user && (
              <button type="button" onClick={getAgent} title="Modify my Preferences" aria-label="Modify my Preferences"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "#CBD9D5", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,16px)", borderRadius: 100, whiteSpace: "nowrap" }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                </svg>
                Preferences
              </button>
            )}
            {user ? (
              <button type="button" onClick={() => navigate("/profile")} aria-label="My profile"
                style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.10)", color: "#F1F6F4", fontWeight: 800, fontSize: 13, flex: "none" }}>
                {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
              </button>
            ) : (
              <button type="button" onClick={() => openLogin()}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,.22)", color: "#F1F6F4", fontWeight: 600, fontSize: "clamp(12px,1.05vw,14px)", padding: "10px clamp(12px,1.4vw,18px)", borderRadius: 100, whiteSpace: "nowrap" }}>
                Sign In
              </button>
            )}
          </div>

          {/* Mobile hamburger — desktop keeps the pill nav above. */}
          <button type="button" className="mzn-burger" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </button>

          {/* Mobile slide-down menu — every nav destination plus sign-in at the end. */}
          <div className={`mzn-sheet ${menuOpen ? "is-open" : ""}`} role="menu">
            <Link to="/" className={`mzn-sheet-link ${active === "home" ? "is-active" : ""}`}>Home</Link>
            <Link to="/how-it-works" className={`mzn-sheet-link ${active === "how" ? "is-active" : ""}`}>How it Works</Link>
            <Link to="/about" className={`mzn-sheet-link ${active === "about" ? "is-active" : ""}`}>About Us</Link>
            <button type="button" className="mzn-sheet-link" onClick={closeThen(listMyFlat)}>
              Register as an Owner<span className="mzn-badge-new">new</span>
            </button>
            <Link to="/register-broker" className={`mzn-sheet-link ${active === "register-broker" ? "is-active" : ""}`}>
              Register as a Broker<span className="mzn-badge-new">new</span>
            </Link>
            {cartCount > 0 && (
              <button type="button" className="mzn-sheet-link" onClick={closeThen(() => navigate("/visits"))}>Site visits ({cartCount})</button>
            )}
            <button type="button" className="mzn-sheet-cta" onClick={closeThen(findFlat)}>
              Start your move <span style={{ fontSize: 13 }}>&#8599;</span>
            </button>
            <div className="mzn-sheet-divider" />
            {user ? (
              <>
                <button type="button" className="mzn-sheet-link" onClick={closeThen(getAgent)}>Modify my Preferences</button>
                <button type="button" className="mzn-sheet-link" onClick={closeThen(() => navigate("/profile"))}>My Profile</button>
                <button type="button" className="mzn-sheet-signin" onClick={closeThen(() => logout())}>Sign Out</button>
              </>
            ) : (
              <button type="button" className="mzn-sheet-signin" onClick={closeThen(() => openLogin())}>
                Sign In
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
                </svg>
              </button>
            )}
          </div>
        </nav>
        <div className={`mzn-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden />

        {/* The bar is fixed, so it takes no flow space. The dark-hero home page
            deliberately sits underneath it; every other page needs a spacer or
            its first section would start beneath the bar. */}
        {!transparentAtTop && <div aria-hidden style={{ height: navH }} />}

        {/* Mobile bottom action bar — the three primary entry points. */}
        <nav className="mzn-bottombar" aria-label="Primary actions">
          <button type="button" onClick={findFlat}><FlatIcon /><span>Find My Flat</span></button>
          <button type="button" onClick={listMyFlat}><OwnerIcon /><span>List as Owner</span></button>
          <button type="button" onClick={() => navigate("/register-broker")}><BrokerIcon /><span>Register as Broker</span></button>
        </nav>
      </div>
    </>
  );
}
