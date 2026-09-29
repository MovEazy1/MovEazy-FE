/**
 * "Become Partner" — the number first, then Google (lib/partnerSignup.js).
 * A sheet on phones, a centred card on wider screens; dismissible, since the
 * visitor owes us nothing yet.
 */
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { formatForDisplay, normalizeIndianMobile } from "../../lib/mobile";
import { startPartnerSignup } from "../../lib/partnerSignup";

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ background: "#fff", borderRadius: 999, padding: 1, flex: "none" }}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** The 10 digits of what was typed or pasted — "+91 98765 43210" and "098765 43210" included. */
function digitsOf(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export default function BecomePartnerSheet({ open, onClose }) {
  const { loginWithGoogle } = useAuth();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setErr("");
    setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  const ready = Boolean(normalizeIndianMobile(value));

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) { setErr("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    try {
      await startPartnerSignup(value);
      const res = await loginWithGoogle();
      if (!res?.success) { setErr(res?.error || "Google sign-in failed. Please try again."); setBusy(false); }
    } catch (ex) {
      setErr(ex?.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="bp-scrim" role="presentation" onClick={onClose}>
      <style>{CSS}</style>
      <form className="bp" role="dialog" aria-modal="true" aria-labelledby="bp-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <button type="button" className="bp-x" aria-label="Close" onClick={onClose}><X size={20} /></button>
        <span className="bp-kicker">MovEazy Partners</span>
        <h2 id="bp-title">Become a Partner</h2>
        <p className="bp-sub">Start with your mobile number — it’s how tenants and MovEazy reach you.</p>
        <label className="bp-label" htmlFor="bp-phone">Mobile number</label>
        <div className={`bp-field${err ? " bad" : ""}`}>
          <span>+91</span>
          <input id="bp-phone" ref={inputRef} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" enterKeyHint="go"
            value={formatForDisplay(value)} onChange={(e) => { setValue(digitsOf(e.target.value)); setErr(""); }} />
          {ready && <ShieldCheck size={18} className="bp-ok" aria-label="Valid number" />}
        </div>
        {err && <p className="bp-err" role="alert">{err}</p>}
        <button type="submit" className="bp-go" disabled={busy}>
          <GoogleG /> {busy ? "Opening Google…" : "Verify & continue with Google"}
        </button>
        <p className="bp-terms">Next you’ll sign in with Google. By continuing you agree to MovEazy’s <a href="https://www.moveazy.co.in/terms" target="_blank" rel="noreferrer">terms</a>.</p>
      </form>
    </div>
  );
}

const CSS = `
.bp-scrim { position: fixed; inset: 0; z-index: 100; background: rgba(3,20,14,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 16px; animation: bpfade .2s ease; }
@keyframes bpfade { from { opacity: 0; } }
@keyframes bpup { from { transform: translateY(24px); opacity: 0; } }
.bp { position: relative; width: min(440px, 100%); background: radial-gradient(120% 90% at 0% 0%, #145C43, #0A3A2A 55%, #05241A); color: #fff;
  border-radius: 24px; padding: 28px 24px 22px; box-shadow: 0 30px 80px rgba(0,0,0,.45); animation: bpup .25s ease; font-family: inherit; }
.bp-x { position: absolute; top: 12px; right: 12px; width: 38px; height: 38px; border-radius: 99px; border: 0; background: rgba(255,255,255,.1); color: #fff; display: grid; place-items: center; cursor: pointer; }
.bp-kicker { font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #E4B659; }
.bp h2 { margin: 6px 0 6px; font-size: 28px; letter-spacing: -0.02em; font-weight: 800; color: #fff; }
.bp-sub { margin: 0 0 18px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,.78); }
.bp-label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: rgba(255,255,255,.85); }
.bp-field { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 14px; padding: 0 14px; min-height: 54px; border: 2px solid transparent; }
.bp-field.bad { border-color: #F87171; }
.bp-field span { color: #13201B; font-weight: 800; font-size: 17px; }
.bp-field input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 18px; font-weight: 700; letter-spacing: .02em; color: #13201B; background: transparent; padding: 14px 0; }
.bp-ok { color: #15803D; flex: none; }
.bp-err { margin: 8px 0 0; color: #FCA5A5; font-size: 13.5px; font-weight: 600; }
.bp-go { margin-top: 16px; width: 100%; min-height: 54px; border: 0; border-radius: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
  background: linear-gradient(180deg, #F2CD7A, #E4B659); color: #1F1605; font: inherit; font-size: 16px; font-weight: 800; box-shadow: 0 12px 26px rgba(228,182,89,.35); }
.bp-go:disabled { opacity: .7; cursor: default; }
.bp-terms { margin: 12px 0 0; font-size: 12px; color: rgba(255,255,255,.6); text-align: center; }
.bp-terms a { color: #E4B659; font-weight: 700; }
@media (max-width: 560px) {
  .bp-scrim { align-items: flex-end; padding: 0; }
  .bp { width: 100%; border-radius: 24px 24px 0 0; padding-bottom: calc(22px + env(safe-area-inset-bottom)); }
}
`;
