import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthContext";
import MovEazyLogo from "../components/branding/MovEAZYLogo";

const Ctx = createContext(null);
export function useLoginModal() { return useContext(Ctx); }

const SESSION_KEY = "moveasy_login_email";
const inputCls = "w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100 disabled:opacity-60";
const EASE = [0.22, 1, 0.36, 1];
const slide = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 18 : -18 }),
  center: { opacity: 1, x: 0 },
  exit:  (d) => ({ opacity: 0, x: d > 0 ? -18 : 18 }),
};

const FLAT_TYPES   = ["1 BHK","2 BHK","3 BHK","4 BHK","Villa","PG / Hostel","Studio"];
const POPULAR_AREAS = ["HSR Layout","Koramangala","Bellandur","Whitefield","Marathalli","Indiranagar","BTM Layout","Hebbal","Electronic City","Hoodi"];
const PRIORITIES   = ["Rent","Spacious Rooms","Interiors","Locality","Proximity to Office"];

function LoginPopup({ onClose, onSuccess }) {
  const { login, signup, forgotPassword, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Restore persisted email
  const savedEmail = sessionStorage.getItem(SESSION_KEY) || "";

  const [step, setStep]   = useState(savedEmail ? "checking" : "email");
  const [dir,  setDir]    = useState(1);
  const [email, setEmail] = useState(savedEmail);
  const [pw,    setPw]    = useState("");
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [role,  setRole]  = useState("customer");
  const [ft,    setFt]    = useState("");
  const [area,  setArea]  = useState("");
  const [mid,   setMid]   = useState("");
  const [budget,setBudget]= useState("");
  const [prio,  setPrio]  = useState("");
  const [error, setError] = useState("");
  const [info,  setInfo]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [fbBusy,setFbBusy]= useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [showPw, setShowPw]         = useState(false);

  // If we have a saved email, skip straight to password step
  useEffect(() => {
    if (savedEmail) goTo("login", 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(next, d = 1) { setDir(d); setError(""); setInfo(""); setShowResend(false); setStep(next); }

  const done = (result) => {
    sessionStorage.removeItem(SESSION_KEY);
    if (result.emailWarning) sessionStorage.setItem("moveasy_onboarding_email_warning", result.emailWarning);
    onSuccess(result);
  };

  const onEmailContinue = (e) => {
    e.preventDefault();
    const t = email.trim();
    if (!t) return;
    sessionStorage.setItem(SESSION_KEY, t);
    goTo("login", 1);
  };

  const onLogin = async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setInfo(""); setShowResend(false);
    try {
      const r = await login(email, pw);
      if (r.success) {
        if (r.requiresVerification) { setPw(""); setInfo(r.info || "Verify your email first."); return; }
        done(r);
      } else {
        const msg = r.error || "";
        // Account doesn't exist → switch to signup automatically
        if (msg.toLowerCase().includes("user not found") || msg.toLowerCase().includes("no user") || msg.toLowerCase().includes("user-not-found")) {
          setPw("");
          goTo("signup", 1);
        } else {
          setError(msg || "Something went wrong.");
          setShowResend(!!r.unverified);
        }
      }
    } finally { setBusy(false); }
  };

  const onForgot = async () => {
    setError(""); setInfo(""); setFbBusy(true);
    const r = await forgotPassword(email.trim());
    setFbBusy(false);
    if (r.success) setInfo(r.info || "Reset email sent."); else setError(r.error || "Could not send.");
  };

  const onResend = async () => {
    setError(""); setInfo(""); setShowResend(false); setResendBusy(true);
    const r = await resendVerificationEmail(email, pw);
    setResendBusy(false);
    if (r.success) setInfo(r.info || "Sent."); else setError(r.error || "Could not resend.");
  };

  const onSignup = async (e) => {
    e.preventDefault();
    if (!name.trim())  { setError("Please enter your name.");  return; }
    if (!phone.trim()) { setError("Please enter your phone."); return; }
    if (role === "customer" && !prio) { setError("Please pick your main priority."); return; }
    setBusy(true); setError("");
    const searchProfile = role === "customer" ? {
      bhk: ft, preferredAreas: area ? [area] : [], moveInDate: mid,
      budgetMax: budget ? Number(budget) : null, budgetMin: null, priority: prio,
    } : null;
    try {
      const r = await signup(email, pw, name.trim(), role, phone.trim(), searchProfile);
      if (r.success) {
        if (r.requiresVerification) { setPw(""); setInfo(r.info || "Verify then sign in."); goTo("login", 1); return; }
        done(r);
      } else {
        const msg = r.error || "";
        if (msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("already exists")) {
          setError("Account exists — please sign in."); goTo("login", 1);
        } else setError(msg || "Something went wrong.");
      }
    } finally { setBusy(false); }
  };

  // Google sign-in redirects the whole page away; hand off to the dedicated /auth page
  // so it can pick the flow back up when the browser returns, instead of losing modal state.
  const onGoogle = () => {
    sessionStorage.removeItem(SESSION_KEY);
    const next = location.pathname + location.search;
    onClose();
    navigate(`/auth?next=${encodeURIComponent(next)}`);
  };

  const emailChip = (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
      <span className="text-[13px] text-gray-700 flex-1 truncate font-medium">{email}</span>
      <button type="button" onClick={() => { sessionStorage.removeItem(SESSION_KEY); goTo("email", -1); }}
        className="text-[12px] font-semibold text-rose-500 hover:text-rose-600 shrink-0">Change</button>
    </div>
  );

  const titles = { email: "Sign in / Register", checking: "Checking…", login: "Welcome back", signup: "Create your account" };
  const subs   = { email: "Enter your email to continue", checking: "", login: "Enter your password to continue", signup: "Just a few details to get started" };
  const stepN  = step === "email" || step === "checking" ? 1 : 2;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="relative w-full max-w-[440px] my-auto bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.35)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1" style={{ background: "linear-gradient(90deg,#dc2626,#ef4444,#f97316)" }} />

        {/* Spinner overlay */}
        {busy && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 rounded-3xl">
            <div className="h-7 w-7 rounded-full border-[3px] border-gray-200 border-t-rose-500 animate-spin" />
          </div>
        )}

        {/* Header */}
        <div className="px-7 pt-6 pb-4 flex items-start justify-between">
          <div>
            <MovEazyLogo size="nav" />
            <p className="text-[15px] font-semibold text-gray-800 mt-0.5">{titles[step]}</p>
            {subs[step] && <p className="text-[12px] text-gray-400 mt-0.5">{subs[step]}</p>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-1">
              {[1,2].map(n => (
                <span key={n} className="rounded-full transition-all duration-300"
                  style={{ width: n === stepN ? 16 : 6, height: 6, background: n === stepN ? "#dc2626" : "#e5e7eb" }} />
              ))}
            </div>
            <button onClick={onClose} className="ml-1 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-100 mx-7" />

        {/* Alerts */}
        <div className="px-7 pt-4">
          <AnimatePresence>
            {info && (
              <motion.div key="info" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                className="mb-3 rounded-xl px-3 py-2.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 overflow-hidden">
                {info} <span className="font-semibold">Check spam too.</span>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.div key="err" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                className="mb-3 rounded-xl px-3 py-2.5 text-[12px] text-red-700 bg-red-50 border border-red-200 overflow-hidden">
                {error}
                {showResend && (
                  <button type="button" onClick={onResend} disabled={resendBusy}
                    className="mt-1 block font-semibold text-red-600 underline disabled:opacity-50">
                    {resendBusy ? "Sending…" : "Resend verification email"}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body */}
        <div className="px-7 pb-7 overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>

            {/* EMAIL */}
            {(step === "email" || step === "checking") && (
              <motion.div key="email" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE }}>
                <form onSubmit={onEmailContinue} className="mt-4">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required disabled={busy} autoFocus placeholder="you@gmail.com" className={inputCls} />
                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl text-[15px] font-bold text-white mt-3 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Continue →
                  </motion.button>
                </form>
                <div className="my-4 flex items-center gap-3 text-[12px] text-gray-400">
                  <span className="h-px flex-1 bg-gray-100" /> or <span className="h-px flex-1 bg-gray-100" />
                </div>
                <button type="button" onClick={onGoogle} disabled={busy}
                  className="w-full h-12 rounded-xl border border-gray-200 bg-white text-[14px] font-semibold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-60">
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              </motion.div>
            )}

            {/* LOGIN */}
            {step === "login" && (
              <motion.div key="login" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE }}>
                <form onSubmit={onLogin} className="mt-4">
                  {emailChip}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Password</label>
                      <button type="button" onClick={onForgot} disabled={fbBusy}
                        className="text-[12px] font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50">
                        {fbBusy ? "Sending…" : "Forgot?"}
                      </button>
                    </div>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                        required disabled={busy} autoFocus placeholder="Your password" minLength="6" className={inputCls + " pr-11"} />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw
                          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                          : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl text-[15px] font-bold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Sign In
                  </motion.button>
                </form>
                <p className="text-center mt-4 text-[13px] text-gray-400">
                  No account?{" "}
                  <button type="button" onClick={() => goTo("signup", 1)} className="font-semibold text-red-600 hover:text-red-700">Sign up free</button>
                </p>
              </motion.div>
            )}

            {/* SIGN UP */}
            {step === "signup" && (
              <motion.div key="signup" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: EASE }}>
                <form onSubmit={onSignup} className="mt-4">
                  {emailChip}

                  {/* Role */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">I am a</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[["customer","Tenant / Buyer"],["seller","Seller / Broker"]].map(([id, label]) => {
                        const on = role === id;
                        return (
                          <button key={id} type="button" onClick={() => setRole(id)}
                            className="h-10 rounded-xl border text-[13px] font-semibold transition-all"
                            style={{ borderColor: on?"#e85a4f":"#e5e7eb", background: on?"#fff5f2":"white", color: on?"#e85a4f":"#6b7280", boxShadow: on?"0 0 0 1px #e85a4f":"none" }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Full Name <span className="text-rose-400">*</span></label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required disabled={busy} autoFocus placeholder="Your name" className={inputCls} />
                  </div>
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Phone <span className="text-rose-400">*</span></label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required disabled={busy} placeholder="+91 98765 43210" className={inputCls} />
                  </div>
                  <div className="mb-4">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Password <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} required disabled={busy} placeholder="Min 6 characters" minLength="6" className={inputCls + " pr-11"} />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw
                          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                          : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Customer extras */}
                  <AnimatePresence>
                    {role === "customer" && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }} className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="h-px flex-1 bg-gray-100" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Flat Search Details</span>
                          <span className="h-px flex-1 bg-gray-100" />
                        </div>
                        <div className="mb-3">
                          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Flat Type</label>
                          <div className="flex flex-wrap gap-1.5">
                            {FLAT_TYPES.map(f => (
                              <button key={f} type="button" onClick={() => setFt(ft === f ? "" : f)}
                                className="px-3 py-1 rounded-full text-[12px] font-semibold border transition-all"
                                style={{ borderColor: ft===f?"#e85a4f":"#e5e7eb", background: ft===f?"#fff5f2":"white", color: ft===f?"#e85a4f":"#6b7280" }}>
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Preferred Area</label>
                            <select value={area} onChange={e => setArea(e.target.value)} disabled={busy}
                              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none focus:border-rose-400">
                              <option value="">Select area…</option>
                              {POPULAR_AREAS.map(a => <option key={a}>{a}</option>)}
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Budget / mo (₹)</label>
                            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min="0" step="500" disabled={busy} placeholder="25000"
                              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none focus:border-rose-400" />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Move-in timeline</label>
                          <select value={mid} onChange={e => setMid(e.target.value)} disabled={busy}
                            className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900 outline-none focus:border-rose-400">
                            <option value="">Select…</option>
                            <option value="Immediate">Immediate</option>
                            <option value="Within 2 weeks">Within 2 weeks</option>
                            <option value="Within 1 month">Within 1 month</option>
                            <option value="1–3 months">1–3 months</option>
                            <option value="Flexible">Flexible</option>
                          </select>
                        </div>
                        <div className="mb-4">
                          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">My Main Priority <span className="text-rose-400">*</span></label>
                          <div className="flex flex-col gap-1.5">
                            {PRIORITIES.map(p => (
                              <button key={p} type="button" onClick={() => setPrio(p)}
                                className="flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] font-medium text-left transition-all"
                                style={{ borderColor: prio===p?"#e85a4f":"#e5e7eb", background: prio===p?"#fff5f2":"white", color: prio===p?"#c2410c":"#374151" }}>
                                <span className="h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center"
                                  style={{ borderColor: prio===p?"#e85a4f":"#d1d5db" }}>
                                  {prio === p && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                                </span>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit" disabled={busy}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl text-[15px] font-bold text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                    Create Account
                  </motion.button>
                </form>
                <p className="text-center mt-3 text-[13px] text-gray-400">
                  Have an account?{" "}
                  <button type="button" onClick={() => goTo("login", -1)} className="font-semibold text-red-600 hover:text-red-700">Sign in</button>
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export function LoginModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const callbackRef = useRef(null);

  const openLogin = useCallback((onSuccess) => {
    callbackRef.current = onSuccess || null;
    setOpen(true);
  }, []);

  const handleSuccess = useCallback((result) => {
    setOpen(false);
    if (callbackRef.current) { callbackRef.current(result); callbackRef.current = null; }
  }, []);

  return (
    <Ctx.Provider value={{ openLogin }}>
      {children}
      <AnimatePresence>
        {open && <LoginPopup onClose={() => setOpen(false)} onSuccess={handleSuccess} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
