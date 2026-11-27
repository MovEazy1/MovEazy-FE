/**
 * /rent/sign/:token — a party (owner or tenant) opens their link, signs in with
 * Google, reviews the stamped agreement, and e-signs. Binding the account to the
 * party here is what brings the agreement into their owner/tenant app and gets
 * them onto MovEazy.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RentStyles, StatusBadge, Steps, SignaturePad } from "../components/rent/rentUi";
import { openSignLink, signAgreement, signedDocUrl, fmtINR, fmtDate, ROLE_LABEL } from "../lib/rentAgreements";

export default function RentSign() {
  const { token } = useParams();
  const { user, loading, loginWithGoogle } = useAuth();
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [sig, setSig] = useState(null);
  const [docUrl, setDocUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await openSignLink(token);
      setA(data);
      if (data?.document_path) signedDocUrl(data.document_path).then(setDocUrl);
    } catch (e) { setErr(e.message || "This link is not valid."); }
  }, [token]);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading) return <Shell><div className="ra-muted">Loading…</div></Shell>;

  if (!user) {
    return (
      <Shell>
        <div className="ra-h">Your rent agreement</div>
        <div className="ra-sub">Sign in with Google to review and e-sign. We use your account to verify who signed.</div>
        <button className="ra-btn primary" onClick={() => loginWithGoogle()}>Sign in with Google</button>
      </Shell>
    );
  }

  if (err) return <Shell><div className="ra-err">{err}</div></Shell>;
  if (!a) return <Shell><div className="ra-muted">Loading your agreement…</div></Shell>;

  const mine = a.my_party;
  const alreadySigned = mine?.signed || done;
  const ready = a.status === "ready_to_sign" || a.status === "partially_signed";

  const submit = async () => {
    if (!sig) return;
    setBusy(true);
    try { await signAgreement(token, sig.type, sig.data); setDone(true); await load(); }
    catch (e) { setErr(e.message || "Could not sign."); }
    finally { setBusy(false); }
  };

  return (
    <Shell>
      <div className="ra-row">
        <div className="ra-h">Rent agreement</div>
        <StatusBadge status={a.status} />
      </div>
      <div className="ra-sub">You are signing as the <b>{ROLE_LABEL[mine?.role] || "party"}</b>.</div>
      <Steps status={a.status} />

      <div className="ra-card">
        <div style={{ fontWeight: 700 }}>{a.details?.flat_type ? `${a.details.flat_type} · ` : ""}{a.details?.address || a.city}</div>
        <div className="ra-muted" style={{ marginTop: 6, lineHeight: 1.8 }}>
          Rent <b>{fmtINR(a.rent)}</b>/month · Deposit <b>{fmtINR(a.deposit)}</b><br />
          Term <b>{fmtDate(a.start_date)}</b> → <b>{fmtDate(a.renewal_date)}</b> ({a.duration_months} months)<br />
          {a.details?.notice_months != null && <>Notice {a.details.notice_months} month(s) · </>}
          {a.details?.increment_pct != null && <>Increment {a.details.increment_pct}%</>}
        </div>
        <div className="ra-muted" style={{ marginTop: 8 }}>
          {(a.parties || []).map((p) => `${ROLE_LABEL[p.role]}: ${p.signed ? "✓ signed" : "awaiting"}`).join("  ·  ")}
        </div>
      </div>

      {docUrl
        ? <a className="ra-btn ghost" href={docUrl} target="_blank" rel="noreferrer">Open the stamped agreement (PDF)</a>
        : a.has_document ? <div className="ra-muted">Preparing the document link…</div> : null}

      {!ready ? (
        <div className="ra-card ra-muted" style={{ marginTop: 12 }}>
          The vendor is still preparing your stamped agreement. You'll be able to sign here once it's uploaded.
        </div>
      ) : alreadySigned ? (
        <div className="ra-ok" style={{ marginTop: 12 }}>
          ✓ You've signed. {a.status === "completed" ? "Everyone has signed — the agreement is saved." : "We'll let you know when the other party signs."}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div className="ra-sec">Your signature</div>
          <div className="ra-muted" style={{ marginBottom: 8 }}>By signing you agree to the terms above. Your name, time and device are recorded.</div>
          <SignaturePad defaultName={mine?.name} onChange={setSig} />
          <div style={{ marginTop: 12 }}>
            <button className="ra-btn primary" disabled={!sig || busy} onClick={submit}>{busy ? "Signing…" : "E-sign the agreement"}</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="ra-wrap" style={{ minHeight: "70vh" }}><RentStyles />{children}</div>;
}
