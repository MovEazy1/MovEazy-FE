import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthContext";

const Ctx = createContext(null);
export function useLoginModal() { return useContext(Ctx); }

const SESSION_KEY = "moveasy_login_email";
// Light field styling, matching the /auth page (pages/SupabaseLogin.jsx) so the
// modal and the full page read as one system.
const inputCls = "w-full h-11 rounded-lg bg-white border border-[#D9D3C4] px-3.5 text-[14px] text-[#1A2421] placeholder:text-[#B3ADA0] outline-none transition focus:border-[#C8500F] focus:ring-[3px] focus:ring-[#FBEAE0] disabled:opacity-60";
const selCls = "w-full h-10 rounded-lg bg-white border border-[#D9D3C4] px-3 text-[13px] text-[#1A2421] outline-none transition focus:border-[#C8500F]";
const EASE = [0.22, 1, 0.36, 1];

const FLAT_TYPES   = ["1 BHK","2 BHK","3 BHK","4 BHK","Villa","PG / Hostel","Studio"];
const POPULAR_AREAS = ["HSR Layout","Koramangala","Bellandur","Whitefield","Marathalli","Indiranagar","BTM Layout","Hebbal","Electronic City","Hoodi"];
const PRIORITIES   = ["Rent","Spacious Rooms","Interiors","Locality","Proximity to Office"];

const INK = "#1A2421";
const LINE = "#D9D3C4";
const MUTED = "#8B8578";
const CORAL = "#C8500F"; // rust accent, shared with the /auth page

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function EyeToggle({ shown, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8578] hover:text-[#1A2421]">
      {shown
        ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
        : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      }
    </button>
  );
}

function LoginPopup({ onClose, onSuccess }) {
  const { login, signup, forgotPassword, resendVerificationEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Restore persisted email (prefill only)
  const savedEmail = sessionStorage.getItem(SESSION_KEY) || "";

  const [step, setStep]   = useState("login");
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
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [info,  setInfo]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [fbBusy,setFbBusy]= useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [showPw, setShowPw]         = useState(false);

  function goTo(next, d = 1) { setDir(d); setError(""); setInfo(""); setShowResend(false); setStep(next); }

  const done = (result) => {
    sessionStorage.removeItem(SESSION_KEY);
    if (result.emailWarning) sessionStorage.setItem("moveasy_onboarding_email_warning", result.emailWarning);
    onSuccess(result);
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
          goTo("signup", 1);
        } else {
          setError(msg || "Something went wrong.");
          setShowResend(!!r.unverified);
        }
      }
    } finally { setBusy(false); }
  };

  const onForgot = async () => {
    const t = email.trim();
    if (!t) { setError("Enter your email first, then tap Forgot Password."); return; }
    setError(""); setInfo(""); setFbBusy(true);
    const r = await forgotPassword(t);
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
    if (!email.trim()) { setError("Please enter your email."); return; }
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
        if (r.requiresVerification) { setPw(""); setInfo(r.info || "Verify then sign in."); goTo("login", -1); return; }
        done(r);
      } else {
        const msg = r.error || "";
        if (msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("already exists")) {
          setError("Account exists — please sign in."); goTo("login", -1);
        } else setError(msg || "Something went wrong.");
      }
    } finally { setBusy(false); }
  };

  // Google sign-in: kick off Supabase OAuth right here so the user goes straight to
  // the Google account picker. On return, AuthContext.handleSession creates the profile.
  const onGoogle = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setError(""); setInfo(""); setBusy(true);
    const r = await loginWithGoogle();
    // On success the browser redirects away to Google; nothing else runs.
    if (!r?.success) {
      setBusy(false);
      setError(r?.error || "Google sign-in is unavailable right now.");
    }
  };

  const alertBox = (info || error) ? (
    <div className={"mb-4 rounded-lg px-3 py-2.5 text-[12px] border " + (error ? "text-red-200 bg-red-500/10 border-red-400/30" : "text-amber-100 bg-amber-400/10 border-amber-300/30")}>
      {error || info}
      {!error && info && <span className="font-semibold"> Check spam too.</span>}
      {error && showResend && (
        <button type="button" onClick={onResend} disabled={resendBusy} className="mt-1 block font-semibold underline text-red-200 disabled:opacity-50">
          {resendBusy ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  ) : null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(26,36,33,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="relative w-full max-w-[420px] my-auto rounded-[22px] overflow-hidden"
        style={{
          background: "#FFFEFB",
          border: `1px solid ${LINE}`,
          boxShadow: "0 20px 60px rgba(26,36,33,0.16)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full flex items-center justify-center text-[#8B8578] hover:text-[#1A2421] hover:bg-[#F7F4ED] transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Spinner */}
        {busy && (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(255,254,251,0.72)" }}>
            <div className="h-7 w-7 rounded-full border-[3px] border-[#D9D3C4] border-t-white animate-spin" />
          </div>
        )}

        <div className="px-8 pt-11 pb-9">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ── LOGIN ── */}
            {step === "login" && (
              <motion.div key="login" custom={dir}
                initial={{ opacity: 0, x: dir > 0 ? 18 : -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir > 0 ? -18 : 18 }}
                transition={{ duration: 0.2, ease: EASE }}>
                <h2 className="text-center text-[#1A2421] text-[26px] leading-tight mb-7" style={{ fontFamily: "'Fredoka','Sora',sans-serif", fontWeight: 600 }}>
                  Login to your Account
                </h2>

                {alertBox}

                <button type="button" onClick={onGoogle} disabled={busy}
                  className="w-full h-12 rounded-xl border border-[#D9D3C4] bg-white text-[14px] font-medium text-[#1A2421] flex items-center justify-center gap-2.5 hover:bg-[#F7F4ED] transition disabled:opacity-60">
                  <GoogleIcon /> Continue with Google
                </button>

                <div className="my-5 flex items-center gap-3 text-[12px] text-[#8B8578]">
                  <span className="h-px flex-1 border-t border-dashed border-[#D9D3C4]" />
                  or Sign in with Email
                  <span className="h-px flex-1 border-t border-dashed border-[#D9D3C4]" />
                </div>

                <form onSubmit={onLogin}>
                  <label className="block text-[12px] text-[#8B8578] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required disabled={busy} autoFocus placeholder="you@example.com" className={inputCls} />

                  <label className="block text-[12px] text-[#8B8578] mb-1.5 mt-4">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                      required disabled={busy} placeholder="••••••••••••" minLength="6" className={inputCls + " pr-11"} />
                    <EyeToggle shown={showPw} onToggle={() => setShowPw(v => !v)} />
                  </div>

                  <div className="flex items-center justify-between mt-3.5 mb-6">
                    <button type="button" onClick={() => setRemember(v => !v)} className="flex items-center gap-2 text-[12.5px] text-[#1A2421]">
                      <span className="w-4 h-4 rounded-[5px] flex items-center justify-center border transition"
                        style={{ background: remember ? CORAL : "transparent", borderColor: remember ? CORAL : "rgba(217,211,196,1)" }}>
                        {remember && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      Remember Me
                    </button>
                    <button type="button" onClick={onForgot} disabled={fbBusy} className="text-[12.5px] text-[#8B8578] hover:text-[#1A2421] disabled:opacity-50">
                      {fbBusy ? "Sending…" : "Forgot Password?"}
                    </button>
                  </div>

                  <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl bg-[#1A2421] text-[15px] font-semibold text-white hover:bg-[#232F2B] transition disabled:opacity-60">
                    Login
                  </motion.button>
                </form>

                <p className="text-center mt-5 text-[13px] text-[#8B8578]">
                  Don&apos;t have an account?{" "}
                  <button type="button" onClick={() => goTo("signup", 1)} className="font-semibold" style={{ color: CORAL }}>Sign up</button>
                </p>
              </motion.div>
            )}

            {/* ── SIGN UP ── */}
            {step === "signup" && (
              <motion.div key="signup" custom={dir}
                initial={{ opacity: 0, x: dir > 0 ? 18 : -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir > 0 ? -18 : 18 }}
                transition={{ duration: 0.2, ease: EASE }}>
                <h2 className="text-center text-[#1A2421] text-[26px] leading-tight mb-6" style={{ fontFamily: "'Fredoka','Sora',sans-serif", fontWeight: 600 }}>
                  Create your Account
                </h2>

                {alertBox}

                <form onSubmit={onSignup}>
                  {/* Role */}
                  <label className="block text-[12px] text-[#8B8578] mb-1.5">I am a</label>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[["customer","Tenant / Buyer"],["seller","Seller / Broker"]].map(([id, label]) => {
                      const on = role === id;
                      return (
                        <button key={id} type="button" onClick={() => setRole(id)}
                          className="h-10 rounded-lg border text-[13px] font-semibold transition"
                          style={{ borderColor: on ? CORAL : "rgba(217,211,196,1)", background: on ? "rgba(200,80,15,0.10)" : "#FFFFFF", color: on ? "#C8500F" : MUTED }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <label className="block text-[12px] text-[#8B8578] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} placeholder="you@example.com" className={inputCls} />

                  <label className="block text-[12px] text-[#8B8578] mb-1.5 mt-3">Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required disabled={busy} placeholder="Your name" className={inputCls} />

                  <label className="block text-[12px] text-[#8B8578] mb-1.5 mt-3">Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required disabled={busy} placeholder="+91 98765 43210" className={inputCls} />

                  <label className="block text-[12px] text-[#8B8578] mb-1.5 mt-3">Password</label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} required disabled={busy} placeholder="Min 6 characters" minLength="6" className={inputCls + " pr-11"} />
                    <EyeToggle shown={showPw} onToggle={() => setShowPw(v => !v)} />
                  </div>

                  {/* Customer extras */}
                  {role === "customer" && (
                      <div>
                        <div className="flex items-center gap-2 mt-4 mb-3">
                          <span className="h-px flex-1 bg-[#D9D3C4]" />
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: CORAL }}>Flat Search Details</span>
                          <span className="h-px flex-1 bg-[#D9D3C4]" />
                        </div>
                        <label className="block text-[12px] text-[#8B8578] mb-1.5">Flat Type</label>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {FLAT_TYPES.map(f => (
                            <button key={f} type="button" onClick={() => setFt(ft === f ? "" : f)}
                              className="px-3 py-1 rounded-full text-[12px] font-semibold border transition"
                              style={{ borderColor: ft===f ? CORAL : "rgba(217,211,196,1)", background: ft===f ? "rgba(200,80,15,0.10)" : "#FFFFFF", color: ft===f ? "#C8500F" : MUTED }}>
                              {f}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="block text-[12px] text-[#8B8578] mb-1.5">Preferred Area</label>
                            <select value={area} onChange={e => setArea(e.target.value)} disabled={busy} className={selCls}>
                              <option value="">Select area…</option>
                              {POPULAR_AREAS.map(a => <option key={a}>{a}</option>)}
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[12px] text-[#8B8578] mb-1.5">Budget / mo (₹)</label>
                            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min="0" step="500" disabled={busy} placeholder="25000" className={selCls} />
                          </div>
                        </div>
                        <label className="block text-[12px] text-[#8B8578] mb-1.5">Move-in timeline</label>
                        <select value={mid} onChange={e => setMid(e.target.value)} disabled={busy} className={selCls + " mb-3"}>
                          <option value="">Select…</option>
                          <option value="Immediate">Immediate</option>
                          <option value="Within 2 weeks">Within 2 weeks</option>
                          <option value="Within 1 month">Within 1 month</option>
                          <option value="1–3 months">1–3 months</option>
                          <option value="Flexible">Flexible</option>
                        </select>
                        <label className="block text-[12px] text-[#8B8578] mb-1.5">My Main Priority</label>
                        <div className="flex flex-col gap-1.5 mb-1">
                          {PRIORITIES.map(p => (
                            <button key={p} type="button" onClick={() => setPrio(p)}
                              className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] font-medium text-left transition"
                              style={{ borderColor: prio===p ? CORAL : "rgba(217,211,196,1)", background: prio===p ? "rgba(200,80,15,0.10)" : "#FFFFFF", color: prio===p ? "#C8500F" : MUTED }}>
                              <span className="h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center" style={{ borderColor: prio===p ? CORAL : "rgba(217,211,196,1)" }}>
                                {prio === p && <span className="h-2 w-2 rounded-full" style={{ background: CORAL }} />}
                              </span>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                  )}

                  <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.98 }}
                    className="w-full h-12 rounded-xl bg-[#1A2421] text-[15px] font-semibold text-white hover:bg-[#232F2B] transition disabled:opacity-60 mt-4">
                    Create Account
                  </motion.button>
                </form>

                <p className="text-center mt-4 text-[13px] text-[#8B8578]">
                  Already have an account?{" "}
                  <button type="button" onClick={() => goTo("login", -1)} className="font-semibold" style={{ color: CORAL }}>Sign in</button>
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
