import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLoginModal } from "../../context/LoginModalContext";
import { useVisitCart } from "../../context/VisitCartContext";
import ProfileNavLink from "../account/UserAccountMenu";
import MovEazyLogo from "../branding/MovEAZYLogo";
import agentAvatar from "../../assets/images/aman.png";

/**
 * Shared floating pill nav — used on every page (marketing home, map/listings, etc.)
 * so the header looks and behaves identically site-wide.
 *
 * Desktop is unchanged. On ≤768px the links + actions collapse behind a hamburger
 * that opens a full-width slide-down menu (closes on navigation).
 * @param {"home"|"dashboard"|"how"|"about"|""} active — which link to highlight, if any.
 * @param {() => void} [onGetAgent] — called when "Train My Broker" is clicked. Each page
 *   supplies its own (already auth-gated) handler that opens its AI chat modal; falls back
 *   to just navigating home if a page hasn't wired one up.
 */
export default function SiteHeader({ active = "", onGetAgent }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const { count: cartCount } = useVisitCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const handleGetAgent = () => {
    setMenuOpen(false);
    if (onGetAgent) {
      onGetAgent();
    } else if (user) {
      navigate("/");
    } else {
      openLogin(() => navigate("/"));
    }
  };

  const goDashboard = () => {
    setMenuOpen(false);
    user ? navigate("/profile") : openLogin(() => navigate("/profile"));
  };

  return (
    <>
      <style>{`
        .sh-navwrap { position: sticky; top: 0; z-index: 1200; padding: 18px 22px 0; }
        .sh-nav {
          max-width: 1220px; margin: 0 auto; display: flex; align-items: center; gap: 16px;
          background: #ffffff; border-radius: 999px; padding: 9px 10px 9px 22px;
          box-shadow: 0 10px 34px rgba(20,18,16,0.10); position: relative;
        }
        .sh-brand { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }
        .sh-brand-logo img { height: 30px; width: auto; max-width: 168px; display: block; }
        .sh-links { display: flex; align-items: center; gap: 2px; margin: 0 auto; background: #f3f0ea; border-radius: 999px; padding: 4px; }
        .sh-link { padding: 9px 16px; border-radius: 999px; font-size: 13.5px; font-weight: 500; color: #4a443d; text-decoration: none; white-space: nowrap; background: none; border: none; cursor: pointer; font-family: inherit; }
        .sh-link:hover { color: #1c1a17; }
        .sh-link-active { background: #1c1a17; color: #fff; }
        .sh-link-active:hover { color: #fff; }
        .sh-actions { display: flex; align-items: center; gap: 10px; }
        .sh-agent { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px 6px 6px; border-radius: 999px; border: 1px solid #d9a441; background: linear-gradient(135deg, #f3cd6a 0%, #d9a441 55%, #c98f2c 100%); color: #3a2a0a; font-size: 13px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px rgba(201,143,44,0.35); }
        .sh-agent:hover { filter: brightness(1.04); }
        .sh-agent-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.85); flex-shrink: 0; display: block; }
        .sh-agent-star { position: absolute; top: -5px; right: -5px; width: 17px; height: 17px; border-radius: 50%; background: #1c1a17; color: #f3cd6a; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
        .sh-signin { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 999px; border: none; background: #1c1a17; color: #fff; font-size: 13.5px; font-weight: 500; white-space: nowrap; cursor: pointer; font-family: inherit; }
        .sh-signin:hover { background: #000; }
        .sh-cart { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px; border: none; background: linear-gradient(135deg,#ff6b57,#ef5a45); color: #fff; font-size: 13.5px; font-weight: 700; white-space: nowrap; cursor: pointer; font-family: inherit; box-shadow: 0 3px 12px rgba(216,65,43,0.32); }
        .sh-cart:hover { filter: brightness(1.05); }
        .sh-cart-badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #1c1a17; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }

        /* Hamburger — desktop hidden, mobile shown */
        .sh-burger { display: none; align-items: center; justify-content: center; width: 44px; height: 44px; border: none; background: #f3f0ea; border-radius: 50%; cursor: pointer; color: #1c1a17; flex-shrink: 0; }
        .sh-burger svg { display: block; }
        .sh-mobile-only { display: none; }
        .sh-backdrop, .sh-sheet { display: none; }

        /* Tablet + mobile: collapse the whole nav behind the hamburger */
        @media (max-width: 900px) {
          .sh-navwrap { padding: 12px 14px 0; }
          .sh-nav { gap: 10px; }
          .sh-links { display: none; }
          .sh-actions { display: none; }
          .sh-burger { display: inline-flex; margin-left: auto; }

          /* Slide-down full-width mobile menu */
          .sh-backdrop {
            display: block; position: fixed; inset: 0; z-index: 1190;
            background: rgba(20,18,16,0.32); opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease;
          }
          .sh-backdrop.is-open { opacity: 1; pointer-events: auto; }
          .sh-sheet {
            display: flex; flex-direction: column; gap: 6px;
            position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 1200;
            background: #fff; border-radius: 22px; padding: 12px;
            box-shadow: 0 18px 50px rgba(20,18,16,0.18);
            transform: translateY(-10px) scale(0.98); opacity: 0; pointer-events: none;
            transform-origin: top center;
            transition: transform 0.26s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease;
          }
          .sh-sheet.is-open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
          .sh-sheet-link {
            display: flex; align-items: center; min-height: 48px; padding: 0 16px;
            border-radius: 14px; font-size: 15.5px; font-weight: 600; color: #2a2621;
            text-decoration: none; background: none; border: none; width: 100%;
            text-align: left; cursor: pointer; font-family: inherit;
          }
          .sh-sheet-link:active { background: #f3f0ea; }
          .sh-sheet-link-active { background: #1c1a17; color: #fff; }
          .sh-sheet-divider { height: 1px; background: #eee7dc; margin: 6px 4px; }
          .sh-sheet .sh-agent { justify-content: center; min-height: 48px; font-size: 14px; padding: 6px 18px 6px 8px; }
          .sh-sheet .sh-signin { justify-content: center; min-height: 48px; font-size: 15px; }
          .sh-sheet-profile { display: flex; justify-content: center; padding: 4px 0 2px; }
        }

        @media (max-width: 768px) {
          .sh-nav { padding: 8px 8px 8px 16px; }
          .sh-brand-logo img { height: 26px; max-width: 140px; }
        }
      `}</style>

      <header className="sh-navwrap">
        <div className="sh-nav">
          <Link to="/" className="sh-brand" aria-label="MovEazy home">
            <MovEazyLogo variant="light" size="nav" className="sh-brand-logo" />
          </Link>

          <nav className="sh-links">
            <Link to="/" className={`sh-link ${active === "home" ? "sh-link-active" : ""}`}>Home</Link>
            {user && (
              <button
                type="button"
                className={`sh-link ${active === "dashboard" ? "sh-link-active" : ""}`}
                onClick={goDashboard}
              >
                Dashboard
              </button>
            )}
            <Link to="/how-it-works" className={`sh-link ${active === "how" ? "sh-link-active" : ""}`}>How it works</Link>
            <Link to="/about" className={`sh-link ${active === "about" ? "sh-link-active" : ""}`}>About us</Link>
            {user?.role === "admin" && (
              <Link to="/admin" className={`sh-link ${active === "admin" ? "sh-link-active" : ""}`}>Admin</Link>
            )}
          </nav>

          <div className="sh-actions">
            {cartCount > 0 ? (
              <button type="button" className="sh-cart" onClick={() => navigate("/visits")} aria-label={`${cartCount} site visits`}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-2 4h12" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" />
                </svg>
                Site visits
                <span className="sh-cart-badge">{cartCount}</span>
              </button>
            ) : (
              <button type="button" className="sh-agent" onClick={handleGetAgent}>
                <img src={agentAvatar} alt="" className="sh-agent-avatar" />
                Train My Broker
                <span className="sh-agent-star" aria-hidden>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden>
                    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                  </svg>
                </span>
              </button>
            )}
            {loading ? (
              <div style={{ width: 34, height: 34 }} aria-hidden />
            ) : user ? (
              <ProfileNavLink user={user} compact />
            ) : (
              <button type="button" className="sh-signin" onClick={() => openLogin()}>
                Sign In
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="sh-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </button>

          {/* Mobile slide-down sheet */}
          <div className={`sh-sheet ${menuOpen ? "is-open" : ""}`} role="menu">
            <Link to="/" className={`sh-sheet-link ${active === "home" ? "sh-sheet-link-active" : ""}`}>Home</Link>
            {user && (
              <button type="button" className={`sh-sheet-link ${active === "dashboard" ? "sh-sheet-link-active" : ""}`} onClick={goDashboard}>Dashboard</button>
            )}
            <Link to="/how-it-works" className={`sh-sheet-link ${active === "how" ? "sh-sheet-link-active" : ""}`}>How it works</Link>
            <Link to="/about" className={`sh-sheet-link ${active === "about" ? "sh-sheet-link-active" : ""}`}>About us</Link>
            {user?.role === "admin" && (
              <Link to="/admin" className={`sh-sheet-link ${active === "admin" ? "sh-sheet-link-active" : ""}`}>Admin</Link>
            )}
            <div className="sh-sheet-divider" />
            {cartCount > 0 ? (
              <button type="button" className="sh-cart" onClick={() => { setMenuOpen(false); navigate("/visits"); }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-2 4h12" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" />
                </svg>
                Site visits ({cartCount})
              </button>
            ) : (
              <button type="button" className="sh-agent" onClick={handleGetAgent}>
                <img src={agentAvatar} alt="" className="sh-agent-avatar" />
                Train My Broker
                <span className="sh-agent-star" aria-hidden>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden>
                    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                  </svg>
                </span>
              </button>
            )}
            {!loading && (user ? (
              <div className="sh-sheet-profile"><ProfileNavLink user={user} compact /></div>
            ) : (
              <button type="button" className="sh-signin" onClick={() => { setMenuOpen(false); openLogin(); }}>
                Sign In
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className={`sh-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden />
    </>
  );
}
