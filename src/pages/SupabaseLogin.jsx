/**
 * /auth — sign in.
 *
 * Google, and only Google. There is no separate sign-up because a first Google
 * sign-in is the sign-up: no password to set, forget or reset, no verification
 * email to chase, and no half-finished accounts sitting unverified.
 *
 * Styled to match the fork home (paper/rust/verified palette + Georgia serif).
 * Falls back gracefully if Supabase is not configured.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import MovEazyLogo from "../components/branding/MovEAZYLogo";
import { useAuth } from "../context/AuthContext";

const INK     = "#1A2421";
const PAPER   = "#F7F4ED";
const WHITE   = "#FFFEFB";
const LINE    = "#D9D3C4";
const MUTED   = "#8B8578";
const RUST    = "#C8500F";
const RUST_BG = "#FBEAE0";
const FOREST  = "#2D6A4F";
const EASE    = [0.22, 1, 0.36, 1];

/* ── Small primitives ────────────────────────────────────────────────────── */

function Label({ children, required }) {
  return (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>
      {children}{required && <span style={{ color: RUST, marginLeft: 2 }}>*</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: `1px solid ${LINE}`,
  background: WHITE,
  padding: "0 14px",
  fontSize: 14,
  color: INK,
  outline: "none",
  boxSizing: "border-box",
};

function Input({ label, required, wrapStyle, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14, ...wrapStyle }}>
      {label && <Label required={required}>{label}</Label>}
      <input
        {...props}
        style={{ ...inputStyle, borderColor: focused ? RUST : LINE, boxShadow: focused ? `0 0 0 3px ${RUST_BG}` : "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function PrimaryBtn({ children, loading, style = {} }) {
  return (
    <motion.button
      type="submit"
      whileHover={loading ? {} : { scale: 1.01 }}
      whileTap={loading ? {} : { scale: 0.98 }}
      disabled={loading}
      style={{
        width: "100%", height: 44, borderRadius: 10,
        background: INK, color: WHITE,
        fontSize: 14, fontWeight: 600, border: "none", cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1, fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      {loading ? "Loading…" : children}
    </motion.button>
  );
}

function GoogleBtn({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", height: 44, borderRadius: 10,
        border: `1px solid ${LINE}`, background: WHITE,
        fontSize: 14, fontWeight: 600, color: INK,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </button>
  );
}


function Alert({ type, children }) {
  const colors = {
    error: { bg: "#fff0f0", border: "#fca5a5", text: "#b91c1c" },
    success: { bg: "#f0faf4", border: "#86efac", text: FOREST },
    info: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  };
  const c = colors[type] || colors.info;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: c.text, marginBottom: 14, overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */


/* ── Sign-in form ──────────────────────────────────────────────────────────── */


/* ── Sign-up form ─────────────────────────────────────────────────────────── */


/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function SupabaseLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, supabaseSession, isSupabaseConfigured: sbConfigured } = useAuth();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setError("");
    setBusy(true);
    const r = await loginWithGoogle();
    // On success the browser leaves for Google's account picker and nothing
    // below runs; AuthContext picks the session up when it comes back.
    if (!r?.success) {
      setBusy(false);
      setError(r?.error || "Google sign-in is unavailable right now.");
    }
  };

  // If already logged in, redirect away
  useEffect(() => {
    if (!user && !supabaseSession) return;
    const next = searchParams.get("next");
    if (next) { navigate(next); return; }
    navigate(user ? "/profile" : "/");
  }, [user, supabaseSession, navigate, searchParams]);

  return (
    <div style={{ minHeight: "100dvh", background: PAPER, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>

      {/* Brand */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <MovEazyLogo variant="light" size="md" />
      </Link>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{ width: "100%", maxWidth: 400, background: WHITE, border: `1px solid ${LINE}`, borderRadius: 20, padding: "32px 28px", boxShadow: "0 20px 60px rgba(26,36,33,0.08)" }}
      >
        {!sbConfigured ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 14, color: RUST, marginBottom: 12 }}>
              Supabase is not configured yet.
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
              Add <code style={{ fontSize: 12, background: PAPER, padding: "1px 5px", borderRadius: 4 }}>VITE_SUPABASE_URL</code> and{" "}
              <code style={{ fontSize: 12, background: PAPER, padding: "1px 5px", borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code> to <code style={{ fontSize: 12, background: PAPER, padding: "1px 5px", borderRadius: 4 }}>fe/.env</code>.
            </div>
            <Link to="/login" style={{ fontSize: 13, fontWeight: 600, color: INK, textDecoration: "none" }}>
              Use Firebase login instead →
            </Link>
          </div>
        ) : (
          <>
            {/* Google is the only way in — there is no separate sign-up, because
                a first Google sign-in is the sign-up. No password to set, forget
                or reset, and no unverified half-accounts. */}
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 600, color: INK, marginBottom: 4, lineHeight: 1.2 }}>
              Welcome to MovEazy.
            </h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 22, lineHeight: 1.5 }}>
              Sign in with Google to find your next home or manage your listings.
              First time? This creates your account too.
            </p>

            {error && (
              <div style={{ marginBottom: 16, borderRadius: 10, border: "1px solid #FBD5C8", background: "#FDF1EC", padding: "10px 12px", fontSize: 13, color: "#9C3A1B" }}>
                {error}
              </div>
            )}

            <GoogleBtn onClick={onGoogle} loading={busy} />

            <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 16 }}>
              By continuing you agree to our{" "}
              <Link to="/terms" style={{ color: MUTED, textDecoration: "underline" }}>Terms</Link> &amp;{" "}
              <Link to="/privacy" style={{ color: MUTED, textDecoration: "underline" }}>Privacy</Link>.
            </p>

          </>
        )}
      </motion.div>

      {/* Trust badges */}
      <div style={{ marginTop: 24, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {["Verified listings", "Zero broker spam", "Direct handovers"].map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, fontWeight: 500 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="3" width="12" height="12">
              <path d="M4 12l5 5L20 7" />
            </svg>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
