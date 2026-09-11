import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthContext";

const Ctx = createContext(null);
export function useLoginModal() { return useContext(Ctx); }

const SESSION_KEY = "moveasy_login_email";
const EASE = [0.22, 1, 0.36, 1];

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

function LoginPopup({ onClose }) {
  const { loginWithGoogle } = useAuth();

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Google is the only way in, so there is one step and nothing to slide
  // between. `dir` survives only because the entry animation reads it.
  const step = "login";
  const dir = 1;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const info = "";

  // Google sign-in: kick off Supabase OAuth right here so the user goes straight to
  // the Google account picker. On return, AuthContext.handleSession creates the profile.
  const onGoogle = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    setError(""); setBusy(true);
    const r = await loginWithGoogle();
    // On success the browser redirects away to Google; nothing else runs.
    if (!r?.success) {
      setBusy(false);
      setError(r?.error || "Google sign-in is unavailable right now.");
    }
  };

  const alertBox = (info || error) ? (
    <div className={"mb-4 rounded-lg px-3 py-2.5 text-[12px] border " + (error ? "text-red-700 bg-red-50 border-red-200" : "text-amber-800 bg-amber-50 border-amber-200")}>
      {error || info}
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

                {/* Google is the only way in. Email and password, "remember me",
                    "forgot password" and the sign-up step were all removed: one
                    account per Google identity, nothing to reset, and no
                    half-finished signups to chase. */}
                <p className="text-center mt-5 text-[13px] text-[#8B8578]">
                  We&apos;ll never post anything or email you without asking.
                </p>
              </motion.div>
            )}

            {/* ── SIGN UP ── */}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

export function LoginModalProvider({ children }) {
  const [open, setOpen] = useState(false);

  /**
   * Callers still pass a "do this once they're in" callback, and it is still
   * accepted so none of them need changing — but it cannot fire any more.
   * Google sign-in redirects the browser to the account picker, which tears
   * this page down; by the time the user returns, the closure is gone. That
   * was already true of the Google path before it became the only one.
   * Anything that must happen after sign-in belongs in AuthContext's session
   * handler, which runs on return.
   */
  const openLogin = useCallback(() => setOpen(true), []);

  return (
    <Ctx.Provider value={{ openLogin }}>
      {children}
      <AnimatePresence>
        {open && <LoginPopup onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
