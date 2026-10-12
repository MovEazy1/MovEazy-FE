/**
 * Screen 11 — Payout Details: the member's UPI ID. The format is checked
 * here; MovEazy confirms the ID by paying into it, so it's never shown as
 * "verified". Without one, earnings wait.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Info } from "lucide-react";
import { isUpiId, saveSocietyProfile, societyError, sp } from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Field, FormHead, toast } from "./societyUi";

export default function UpiSetup() {
  const { member, society, reload } = useSociety();
  const navigate = useNavigate();
  const [upi, setUpi] = useState(member.upi_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = isUpiId(upi);

  const save = async () => {
    if (!ok) { setErr("Enter your UPI ID, like name@okaxis."); return; }
    setBusy(true);
    try {
      await saveSocietyProfile({ upi: upi.trim().toLowerCase() });
      await reload();
      toast("UPI ID saved");
      navigate(sp("/earnings"));
    } catch (e) {
      setErr(societyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sx-page up">
      <style>{CSS}</style>
      <FormHead title="Payout Details" />
      <div className="sx-banner sx-banner--mint"><Info size={20} /><span>Add your UPI ID to receive your share of brokerage earnings.</span></div>
      <Field label="UPI ID" error={err} hint={ok && !err ? "Looks right. MovEazy confirms it with your first payout." : ""}>
        <span className="up-in">
          <input className="sx-input" value={upi} onChange={(e) => { setUpi(e.target.value.trim()); setErr(""); }} placeholder="name@okaxis"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" />
          {ok && <CheckCircle2 size={22} className="up-ok" aria-label="Format looks right" />}
        </span>
      </Field>
      <p className="sx-sub" style={{ marginTop: 12 }}>Payment will be sent via UPI to this ID after each successful rental.</p>
      <div className="sx-banner sx-banner--amber" style={{ marginTop: 18 }}>
        <Info size={20} />
        <span>Your society&apos;s total share is <b>{Math.round(society.pool_pct ?? 70)}%</b> of the brokerage amount, distributed among all eligible members.</span>
      </div>
      <div className="sx-btn-bar" style={{ marginTop: 24 }}>
        <button type="button" className="sx-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save UPI ID"}</button>
      </div>
    </div>
  );
}

const CSS = `
.up-in { position: relative; display: block; }
.up-in input { padding-right: 46px; }
.up-ok { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #fff; fill: var(--em); }
`;
