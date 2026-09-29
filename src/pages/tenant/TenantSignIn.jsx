/**
 * The tenant app's front door — tenant.moveazy.co.in (and /tenant) when signed
 * out. One job: sign in with Google, which comes straight back here, where the
 * site's own gate asks for a mobile number and the tenant home takes over.
 */
import { useState } from "react";
import { BadgeCheck, CalendarCheck, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { TN_CSS, TenantCard } from "./tenantUi";
import logoOnLight from "../../assets/logo/moveazy-logo-mint-light.png";

export default function TenantSignIn() {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    setErr("");
    const res = await loginWithGoogle();
    if (!res?.success) { setErr(res?.error || "Google sign-in failed. Please try again."); setBusy(false); }
  };

  return (
    <div className="tn tn-in">
      <style>{TN_CSS + CSS}</style>
      <div className="tn-col tn-in-col">
        <img src={logoOnLight} alt="MovEazy" className="tn-in-logo" height="30" />
        <h1>Your tenant home.</h1>
        <p className="tn-in-sub">Your profile, your matches and your visits — in one place.</p>
        <div className="tn-in-card"><TenantCard profile={{ name: "Your name" }} /></div>
        <ul className="tn-in-list">
          <li><span className="ic"><BadgeCheck size={17} /></span>A profile owners trust</li>
          <li><span className="ic"><Search size={17} /></span>AI-matched homes in 6 hours</li>
          <li><span className="ic"><CalendarCheck size={17} /></span>Visits in one tap</li>
        </ul>
        <button type="button" className="tn-in-google" onClick={go} disabled={busy}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {busy ? "Opening Google…" : "Continue with Google"}
        </button>
        {err && <p className="tn-in-err" role="alert">{err}</p>}
        <p className="tn-in-terms">By continuing you agree to MovEazy’s <a href="https://www.moveazy.co.in/terms">terms</a>.</p>
      </div>
    </div>
  );
}

const CSS = `
.tn-in { background: radial-gradient(90% 50% at 100% 0%, rgba(94,234,212,.25), transparent 60%), var(--cream); }
.tn-in-col { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding-top: 36px; padding-bottom: 36px; }
.tn .tn-in-logo { height: 30px; width: auto; align-self: flex-start; }
.tn-in h1 { font-size: 38px; line-height: 1.04; letter-spacing: -.04em; font-weight: 800; margin-top: 26px !important; }
.tn-in-sub { margin: 8px 0 0; font-size: 16px; line-height: 1.5; color: var(--dim); }
.tn-in-card { margin: 24px 0 8px; pointer-events: none; }
.tn-in-list { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
.tn-in-list li { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; }
.tn-in-list .ic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--wash); color: var(--teal); flex: none; }
.tn-in-google { margin-top: 26px; display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; min-height: 56px; border-radius: 16px; cursor: pointer;
  border: 0; background: var(--ink); color: #fff; font: inherit; font-size: 16px; font-weight: 800; box-shadow: 0 14px 30px rgba(4,33,29,.25); }
.tn-in-google svg { background: #fff; border-radius: 99px; padding: 2px; flex: none; }
.tn-in-google:disabled { opacity: .7; }
.tn-in-err { margin: 10px 0 0; font-size: 13px; color: #B42318; text-align: center; }
.tn-in-terms { margin: 14px 0 0; font-size: 12.5px; color: var(--dim); text-align: center; }
.tn-in-terms a { color: var(--teal); font-weight: 700; }
`;
