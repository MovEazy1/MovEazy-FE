/**
 * Signed-out landing for the partner app. Google only — the phone number is
 * asked for right after, by the site-wide RequirePhoneModal.
 */
import { useState } from "react";
import { Building2, IndianRupee, Users } from "lucide-react";
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
      <button type="button" className="pz-btn pz-btn--block" onClick={go} disabled={busy}
        style={{ borderColor: "#D1D5DB", fontSize: 15 }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? "Opening Google…" : label}
      </button>
      {err && <div className="pz-err" style={{ textAlign: "center" }}>{err}</div>}
    </>
  );
}

export default function PartnerWelcome() {
  return (
    <div className="pz-col" style={{ paddingBottom: 24 }}>
      <div style={{ padding: "48px 24px 24px", textAlign: "center" }}>
        <img src={logo} alt="MovEazy" style={{ height: 36, margin: "0 auto 20px", display: "block" }} />
        <h1 style={{ fontSize: 26, margin: "0 0 8px", letterSpacing: "-0.02em" }}>MovEazy Partners</h1>
        <p style={{ color: "var(--dim)", fontSize: 15, lineHeight: 1.55, margin: 0 }}>
          Rental inventory for brokers — yours, your groups', and MovEazy's 1000+ listings updated daily.
        </p>
      </div>
      <div style={{ padding: "0 20px" }}>
        {[
          [Building2, "Find inventory in seconds", "Search by area, BHK, rent and brokerage share."],
          [Users, "Share with your association", "Group-only listings stay inside the group."],
          [IndianRupee, "See the brokerage upfront", "Every card shows the share you earn."],
        ].map(([Icon, t, s]) => (
          <div key={t} className="pz-row" style={{ padding: "12px 0", alignItems: "flex-start" }}>
            <span className="pz-avatar" style={{ background: "var(--gl)", color: "var(--g2)" }}><Icon size={17} /></span>
            <span><strong style={{ display: "block", fontSize: 15 }}>{t}</strong><span className="pz-meta">{s}</span></span>
          </div>
        ))}
        <div style={{ marginTop: 24 }}><GoogleButton /></div>
        <p className="pz-hint" style={{ textAlign: "center", marginTop: 12 }}>
          By continuing you agree to MovEazy's <a href="https://www.moveazy.co.in/terms" style={{ color: "var(--g)" }}>terms</a>.
        </p>
      </div>
    </div>
  );
}
