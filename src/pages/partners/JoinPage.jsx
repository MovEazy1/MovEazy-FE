/**
 * /join/:token — where a WhatsApp invite lands.
 *
 * Signed out: shows the group and who invited you, then Google sign-in, which
 * returns to this same URL. Signed in: remembers the token and hands over to
 * the gate, which registers the partner (after the phone modal) and redeems it.
 */
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { previewInvite, pp } from "../../lib/partners";
import { GoogleButton } from "./PartnerWelcome";
import { INVITE_KEY } from "./PartnerApp";
import { captureSource } from "../../lib/partnerSignup";
import logo from "../../assets/logo/moveazy-logo-light.png";

export default function JoinPage({ redirectWhenReady = false }) {
  const { token } = useParams();
  const [preview, setPreview] = useState(undefined);

  useEffect(() => {
    try { sessionStorage.setItem(INVITE_KEY, token); } catch { /* private tab: joining still works signed in */ }
    captureSource("group_invite");
  }, [token]);

  useEffect(() => {
    if (redirectWhenReady) return;
    previewInvite(token).then(setPreview, () => setPreview(null));
  }, [token, redirectWhenReady]);

  if (redirectWhenReady) return <Navigate to={pp("/")} replace />;

  const valid = preview?.valid;
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <img src={logo} alt="MovEazy" style={{ height: 32, margin: "0 auto 28px", display: "block" }} />
      <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--gl)", color: "var(--g)", display: "grid",
        placeItems: "center", margin: "0 auto 16px" }}><Users size={32} /></div>
      {preview === undefined ? (
        <p className="pz-meta">Checking your invite…</p>
      ) : preview && valid ? (
        <>
          <p className="pz-meta" style={{ margin: 0 }}>{preview.invited_by} invited you to join</p>
          <h1 style={{ fontSize: 26, margin: "6px 0 4px" }}>{preview.group_name}</h1>
          <p className="pz-meta">{preview.member_count} broker{preview.member_count === 1 ? "" : "s"} on MovEazy Partners</p>
          <div style={{ margin: "28px 0 10px" }}><GoogleButton label="Join with Google" /></div>
          <p className="pz-hint">Next, verify your mobile number — then you're in.</p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>This invite has expired</h1>
          <p className="pz-meta" style={{ lineHeight: 1.5 }}>
            Invite links work once and last 7 days. Ask the broker who sent it for a new one — or sign in to MovEazy Partners anyway.
          </p>
          <div style={{ marginTop: 24 }}><GoogleButton /></div>
        </>
      )}
    </div>
  );
}
