import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLoginModal } from "../../context/LoginModalContext";
import ProfileNavLink from "../account/UserAccountMenu";
import agentAvatar from "../../assets/images/aman.png";

/**
 * Shared floating pill nav — used on every page (marketing home, map/listings, etc.)
 * so the header looks and behaves identically site-wide.
 * @param {"home"|"dashboard"|"how"|"about"|""} active — which link to highlight, if any.
 * @param {() => void} [onGetAgent] — called when "Get My Free Agent" is clicked. Each page
 *   supplies its own (already auth-gated) handler that opens its AI chat modal; falls back
 *   to just navigating home if a page hasn't wired one up.
 */
export default function SiteHeader({ active = "", onGetAgent }) {
  const { user, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();

  const handleGetAgent = () => {
    if (onGetAgent) {
      onGetAgent();
    } else if (user) {
      navigate("/");
    } else {
      openLogin(() => navigate("/"));
    }
  };

  return (
    <>
      <style>{`
        .sh-navwrap { position: sticky; top: 0; z-index: 1200; padding: 18px 22px 0; }
        .sh-nav {
          max-width: 1220px; margin: 0 auto; display: flex; align-items: center; gap: 16px;
          background: #ffffff; border-radius: 999px; padding: 9px 10px 9px 22px;
          box-shadow: 0 10px 34px rgba(20,18,16,0.10);
        }
        .sh-brand { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .sh-brand-icon { width: 26px; height: 26px; color: #23201d; display: block; }
        .sh-brand-name { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 21px; color: #23201d; letter-spacing: -0.01em; }
        .sh-brand-accent { color: #ef5a45; }
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

        @media (max-width: 900px) {
          .sh-navwrap { padding: 12px 14px 0; }
          .sh-links { display: none; }
        }
      `}</style>

      <header className="sh-navwrap">
        <div className="sh-nav">
          <Link to="/" className="sh-brand" aria-label="MovEazy home">
            <svg className="sh-brand-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 21V8.5L10 4v3l8-4v18H3zm3-2h2v-2H6v2zm0-4h2v-2H6v2zm0-4h2V9H6v2zm6 8h2v-2h-2v2zm0-4h2v-2h-2v2zm0-4h2V9h-2v2zm4 8h2v-2h-2v2zm0-4h2v-2h-2v2z" />
            </svg>
            <span className="sh-brand-name">Mov<span className="sh-brand-accent">Eazy</span></span>
          </Link>

          <nav className="sh-links">
            <Link to="/" className={`sh-link ${active === "home" ? "sh-link-active" : ""}`}>Home</Link>
            <button
              type="button"
              className={`sh-link ${active === "dashboard" ? "sh-link-active" : ""}`}
              onClick={() => (user ? navigate("/profile") : openLogin(() => navigate("/profile")))}
            >
              Dashboard
            </button>
            <Link to="/how-it-works" className={`sh-link ${active === "how" ? "sh-link-active" : ""}`}>How it works</Link>
            <Link to="/about" className={`sh-link ${active === "about" ? "sh-link-active" : ""}`}>About us</Link>
          </nav>

          <div className="sh-actions">
            <button type="button" className="sh-agent" onClick={handleGetAgent}>
              <img src={agentAvatar} alt="" className="sh-agent-avatar" />
              Train My Broker
              <span className="sh-agent-star" aria-hidden>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden>
                  <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                </svg>
              </span>
            </button>
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
        </div>
      </header>
    </>
  );
}
