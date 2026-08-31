/**
 * /login/supabase — Supabase-first sign-in page.
 * Styled to match the fork home (paper/rust/verified palette + Georgia serif).
 * Falls back gracefully if Supabase is not configured.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getSupabaseAuthSettings } from "../lib/supabase";

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

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: LINE }} />
      <span style={{ fontSize: 12, color: MUTED, fontFamily: "JetBrains Mono, monospace" }}>or</span>
      <div style={{ flex: 1, height: 1, background: LINE }} />
    </div>
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

function TabBar({ tab, setTab }) {
  return (
    <div style={{ display: "flex", background: PAPER, borderRadius: 10, padding: 4, marginBottom: 20 }}>
      {["sign-in", "sign-up"].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          style={{
            flex: 1, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === t ? WHITE : "transparent",
            color: tab === t ? INK : MUTED,
            fontSize: 13, fontWeight: tab === t ? 700 : 500,
            boxShadow: tab === t ? `0 1px 4px rgba(0,0,0,0.1)` : "none",
            transition: "all 0.15s",
          }}
        >
          {t === "sign-in" ? "Sign in" : "Create account"}
        </button>
      ))}
    </div>
  );
}

/* ── Sign-in form ──────────────────────────────────────────────────────────── */

function SignInForm({ onSuccess, googleEnabled }) {
  const { loginWithSupabase, loginWithSupabaseGoogle, forgotPasswordSupabase } = useAuth();
  const [email, setEmail]   = useState("");
  const [pw,    setPw]      = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState("");
  const [info,   setInfo]   = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    setBusy(true);
    const r = await loginWithSupabase(email, pw);
    setBusy(false);
    if (r.success) { onSuccess(r.role || "tenant"); }
    else { setError(r.error || "Sign-in failed."); }
  };

  const onGoogle = async () => {
    setError("");
    setBusy(true);
    const r = await loginWithSupabaseGoogle();
    setBusy(false);
    if (!r.success) setError(r.error || "Google sign-in failed.");
    // on success the browser redirects — no further action needed
  };

  const onForgot = async () => {
    if (!email) { setError("Enter your email first."); return; }
    setError(""); setInfo("");
    setBusy(true);
    const r = await forgotPasswordSupabase(email);
    setBusy(false);
    if (r.success) setInfo(r.info || "Reset email sent.");
    else setError(r.error || "Could not send reset email.");
  };

  return (
    <form onSubmit={onSubmit}>
      <AnimatePresence>
        {error && <Alert type="error" key="e">{error}</Alert>}
        {info  && <Alert type="info"  key="i">{info}</Alert>}
      </AnimatePresence>

      <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoFocus disabled={busy} />

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <Label>Password</Label>
          <button type="button" onClick={onForgot} disabled={busy}
            style={{ fontSize: 12, fontWeight: 600, color: RUST, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Forgot?
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required disabled={busy} placeholder="Your password" minLength={6}
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
          </button>
        </div>
      </div>

      <PrimaryBtn loading={busy}>Sign in →</PrimaryBtn>
      {googleEnabled && <><Divider /><GoogleBtn onClick={onGoogle} loading={busy} /></>}
    </form>
  );
}

/* ── Sign-up form ─────────────────────────────────────────────────────────── */

function SignUpForm({ onSuccess, googleEnabled }) {
  const { signupWithSupabase, loginWithSupabaseGoogle } = useAuth();
  const [phone, setPhone]  = useState("");
  const [name,  setName]   = useState("");
  const [email, setEmail]  = useState("");
  const [pw,    setPw]     = useState("");
  const [role,  setRole]   = useState("tenant");
  const [showPw, setShowPw] = useState(false);
  const [busy,   setBusy]  = useState(false);
  const [error,  setError] = useState("");
  const [info,   setInfo]  = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) { setError("Please enter your phone number."); return; }
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError(""); setInfo("");
    setBusy(true);
    const r = await signupWithSupabase(email, pw, name.trim(), role, phone.trim());
    setBusy(false);
    if (r.success) {
      if (r.requiresVerification) { setInfo(r.info || "Verify your email, then sign in."); }
      else { onSuccess(r.role || role); }
    } else {
      setError(r.error || "Sign-up failed.");
    }
  };

  const onGoogle = async () => {
    setError("");
    setBusy(true);
    const r = await loginWithSupabaseGoogle();
    setBusy(false);
    if (!r.success) setError(r.error || "Google sign-in failed.");
  };

  return (
    <form onSubmit={onSubmit}>
      <AnimatePresence>
        {error && <Alert type="error" key="e">{error}</Alert>}
        {info  && <Alert type="success" key="i">{info}</Alert>}
      </AnimatePresence>

      {/* Role picker */}
      <div style={{ marginBottom: 14 }}>
        <Label>I am a</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[{ id: "tenant", label: "Tenant" }, { id: "owner", label: "Owner" }, { id: "broker", label: "Broker" }].map((c) => (
            <button
              key={c.id} type="button" onClick={() => setRole(c.id)}
              style={{
                height: 38, borderRadius: 8, border: `1.5px solid ${role === c.id ? RUST : LINE}`,
                background: role === c.id ? RUST_BG : WHITE,
                color: role === c.id ? RUST : MUTED,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Input label="Phone Number" required type="tel"      value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoFocus disabled={busy} />
      <Input label="Full Name"   required type="text"     value={name}  onChange={(e) => setName(e.target.value)}  placeholder="Your name"      disabled={busy} />
      <Input label="Email"       required type="email"    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"  disabled={busy} />

      <div style={{ marginBottom: 14 }}>
        <Label required>Password</Label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={pw} onChange={(e) => setPw(e.target.value)}
            required disabled={busy} placeholder="Min 6 characters" minLength={6}
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <button type="button" onClick={() => setShowPw(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
          </button>
        </div>
      </div>

      <PrimaryBtn loading={busy}>Create account →</PrimaryBtn>
      {googleEnabled && <><Divider /><GoogleBtn onClick={onGoogle} loading={busy} /></>}
    </form>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */

export default function SupabaseLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, supabaseSession, isSupabaseConfigured: sbConfigured } = useAuth();
  const [tab, setTab] = useState("sign-in");
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Check which providers are enabled
  useEffect(() => {
    getSupabaseAuthSettings().then((s) => {
      setGoogleEnabled(Boolean(s?.external?.google));
    });
  }, []);

  // If already logged in, redirect away
  useEffect(() => {
    if (!user && !supabaseSession) return;
    const next = searchParams.get("next");
    if (next) { navigate(next); return; }
    navigate(user ? "/profile" : "/");
  }, [user, supabaseSession, navigate, searchParams]);

  function onSuccess(role) {
    const next = searchParams.get("next");
    if (next) { navigate(next); return; }
    // Route based on user role
    if (role === "tenant") navigate("/recommendations");
    else if (role === "owner") navigate("/my-properties");
    else if (role === "broker") navigate("/broker");
    else navigate("/profile");
  }

  return (
    <div style={{ minHeight: "100dvh", background: PAPER, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>

      {/* Brand */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <div style={{ width: 30, height: 30, border: `1.5px solid ${INK}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: INK, fontWeight: 500 }}>
          MZ
        </div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 600, color: INK }}>
          Moveazy
        </div>
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
            <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 600, color: INK, marginBottom: 4, lineHeight: 1.2 }}>
              {tab === "sign-in" ? "Welcome back." : "Join Moveazy."}
            </h1>
            <p style={{ fontSize: 14, color: MUTED, marginBottom: 22, lineHeight: 1.5 }}>
              {tab === "sign-in"
                ? "Sign in to find your next home or manage your listings."
                : "Create a free account — it takes 30 seconds."}
            </p>

            <TabBar tab={tab} setTab={setTab} />

            <AnimatePresence mode="wait">
              {tab === "sign-in" ? (
                <motion.div key="in" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2, ease: EASE }}>
                  <SignInForm onSuccess={onSuccess} googleEnabled={googleEnabled} />
                </motion.div>
              ) : (
                <motion.div key="up" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2, ease: EASE }}>
                  <SignUpForm onSuccess={onSuccess} googleEnabled={googleEnabled} />
                </motion.div>
              )}
            </AnimatePresence>

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
