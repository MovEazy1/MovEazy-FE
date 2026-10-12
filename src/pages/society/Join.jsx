/**
 * society.moveazy.co.in/join/<token>: which society and role this link is
 * for, before signing in. The token is remembered (SocietyApp), so after
 * mobile + Google the gate joins them — to that society, with that role.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLES, peekSocietyInvite, sp } from "../../lib/society";
import { forgetInvite } from "./societySignup";
import { HELP_WHATSAPP, Loading, SocietyLogo } from "./societyUi";

const WHY = { expired: "This invite has expired.", revoked: "This invite was cancelled.", unknown: "This invite link isn't valid." };

export default function Join({ token }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    peekSocietyInvite(token).then((r) => setInfo(r || { valid: false, reason: "unknown" }), () => setInfo({ valid: false, reason: "unknown" }));
  }, [token]);

  useEffect(() => { if (info && !info.valid) forgetInvite(); }, [info]);

  if (!info) return <Loading />;
  return (
    <div className="sx-col" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", paddingBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 0 30px" }}><SocietyLogo size={38} /></div>
      {info.valid ? (
        <>
          <div style={{ width: 84, height: 84, borderRadius: 99, background: "var(--mint)", color: "var(--em)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Users size={36} /></div>
          <h1 style={{ textAlign: "center", fontSize: 26, margin: 0 }}>Join {info.society}</h1>
          <p className="sx-sub" style={{ textAlign: "center" }}>as {ROLES[info.role]}{info.area ? ` · ${info.area}` : ""}</p>
          <p style={{ textAlign: "center", lineHeight: 1.5, color: "#3D4A45", marginTop: 18 }}>Add the society&apos;s available flats and earn a share of MovEazy&apos;s brokerage when they&apos;re rented.</p>
          <button type="button" className="sx-btn" style={{ marginTop: "auto" }} onClick={() => navigate(sp("/"), { replace: true })}>
            {user ? "Join now" : "Continue"}
          </button>
        </>
      ) : (
        <>
          <div style={{ width: 84, height: 84, borderRadius: 99, background: "#FDECEC", color: "#B42318", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><ShieldAlert size={36} /></div>
          <h1 style={{ textAlign: "center", fontSize: 24, margin: 0 }}>{WHY[info.reason] || WHY.unknown}</h1>
          <p className="sx-sub" style={{ textAlign: "center" }}>Ask your society manager to send you a new invite link.</p>
          <a className="sx-btn sx-btn--ghost" style={{ marginTop: "auto" }} href={`https://wa.me/${HELP_WHATSAPP}`} target="_blank" rel="noreferrer">Need help? Message MovEazy</a>
        </>
      )}
    </div>
  );
}
