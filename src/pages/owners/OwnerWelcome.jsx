/** Signed-out landing for the owner app. Google only; the mobile number is asked for right after. */
import { useState } from "react";
import { Sparkles, Users, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo/moveazy-logo-light.png";

export function GoogleButton({ label = "Continue with Google" }) {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true);
    setErr("");
    const res = await loginWithGoogle();
    if (!res?.success) {
      setErr(res?.error || "Google sign-in failed.");
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="oz-btn oz-btn--block" onClick={go} disabled={busy} style={{ borderColor: "#D8D2C2", fontSize: 15 }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? "Opening Google…" : label}
      </button>
      {err && <div className="oz-err" style={{ textAlign: "center" }}>{err}</div>}
    </>
  );
}

export default function OwnerWelcome() {
  return (
    <div className="oz-col" style={{ paddingBottom: 24 }}>
      <div style={{ padding: "44px 24px 20px", textAlign: "center" }}>
        <img src={logo} alt="MovEazy" style={{ height: 34, margin: "0 auto 22px", display: "block" }} />
        <span className="oz-pill oz-pill--champ" style={{ marginBottom: 12 }}>For property owners</span>
        <h1 style={{ fontSize: 27, margin: "10px 0 8px", letterSpacing: "-0.02em", color: "var(--deep)" }}>Your homes, handled.</h1>
        <p style={{ color: "var(--dim)", fontSize: 15, lineHeight: 1.55, margin: 0 }}>
          Manage your properties and tenants, find the next tenant, and get repairs done — in one calm place.
        </p>
      </div>
      <div style={{ padding: "0 20px" }}>
        {[
          [Users, "Find a tenant without the chase", "Interested renters and visit times, coordinated by MovEazy."],
          [Sparkles, "See what your flat could earn", "Rents for similar homes nearby, and a free Home Designer call."],
          [Wrench, "Repairs and home services", "AC, plumbing, cleaning, painting — tracked from request to done."],
        ].map(([Icon, t, s]) => (
          <div key={t} className="oz-row" style={{ padding: "12px 0", alignItems: "flex-start" }}>
            <span className="oz-avatar" style={{ background: "var(--champ2)" }}><Icon size={17} /></span>
            <span><strong style={{ display: "block", fontSize: 15 }}>{t}</strong><span className="oz-meta">{s}</span></span>
          </div>
        ))}
        <div style={{ marginTop: 22 }}><GoogleButton /></div>
        <p className="oz-hint" style={{ textAlign: "center", marginTop: 12 }}>
          By continuing you agree to MovEazy's <a href="https://www.moveazy.co.in/terms" style={{ color: "var(--em)" }}>terms</a>.
        </p>
      </div>
    </div>
  );
}
