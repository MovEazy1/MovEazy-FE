/**
 * Home dashboard (partner_referral_mapping.sql → partner_my_team):
 *   · "Who invited you?" — a referrer's code or mobile, only in the first 20
 *     minutes after sign-in, once; MovEazy approves it in the CRM.
 *   · Your partners — what the partners you brought in are doing: flats
 *     uploaded, visits they did, visits on their flats, closures, and your
 *     lifetime commission. Shown once you have brought someone in.
 * Loaded after the page is drawn; never blocks Home.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { claimReferrer, fetchMyTeam } from "../../lib/partnerPlans";
import { friendlyError, pp } from "../../lib/partners";

export function useMyTeam(skip) {
  const [t, setT] = useState(null);
  useEffect(() => {
    if (skip) return undefined;
    let alive = true;
    fetchMyTeam().then((r) => alive && setT(r), () => {});
    return () => { alive = false; };
  }, [skip]);
  return [t, setT];
}

/** "Who invited you?" while the 20 minutes last; then the request's state until MovEazy decides. */
export function WhoInvitedCard({ team, onClaimed }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [, tick] = useState(0);
  const until = team?.claim_until ? new Date(team.claim_until).getTime() : 0;
  // Hide the box the moment the 20 minutes are up.
  useEffect(() => {
    if (!until) return undefined;
    const left = until - Date.now();
    if (left <= 0) return undefined;
    const id = setTimeout(() => tick((n) => n + 1), left + 500);
    return () => clearTimeout(id);
  }, [until]);

  if (team?.claim?.status === "pending") {
    return (
      <div className="tc-note"><UserPlus size={16} />
        <span>Waiting for MovEazy to confirm <b>{team.claim.referrer}</b> as the partner who invited you.</span>
      </div>
    );
  }
  if (!until || Date.now() >= until) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!val.trim()) { setErr("Enter their referral code or mobile number."); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await claimReferrer(val);
      onClaimed?.({ status: "pending", referrer: r?.referrer || "your referrer" });
    } catch (ex) {
      setErr(friendlyError(ex, "Couldn't save that. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return (
    <form className="tc-who" onSubmit={submit}>
      <b><UserPlus size={17} /> Who invited you?</b>
      <span className="tc-sub">Did a MovEazy partner bring you here? Enter their referral code or mobile number. You can add this for the next {mins} min.</span>
      <div className="tc-row">
        <input className="pz-input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Code or 10-digit mobile"
          autoCapitalize="characters" maxLength={20} aria-label="Referral code or mobile number" />
        <button type="submit" className="pz-btn pz-btn--gold" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {err && <span className="tc-err">{err}</span>}
    </form>
  );
}

/** What the partners you brought in are doing. */
export function TeamCard({ team }) {
  const t = team?.team;
  if (!t || !(t.partners > 0)) return null;
  return (
    <Link to={pp("/referrals")} className="tc-team" aria-label="Your partners">
      <span className="tc-head">
        <span><Users size={17} /> Your partners · {t.partners}</span>
        <span className="tc-life">₹{Math.round(Number(team.lifetime) || 0).toLocaleString("en-IN")} lifetime <ChevronRight size={16} /></span>
      </span>
      <span className="tc-grid">
        <span><b>{t.listings}</b>Flats uploaded</span>
        <span><b>{t.visits_done}</b>Visits done</span>
        <span><b>{t.visits_on_flats}</b>Visits on their flats</span>
        <span><b>{t.closures}</b>Closures</span>
      </span>
    </Link>
  );
}

export const TEAM_CSS = `
.tc-who { display: grid; gap: 8px; padding: 14px; border-radius: 16px; background: #FEF7E6; border: 1px solid #F1D99B; }
.tc-who b { display: flex; align-items: center; gap: 7px; font-size: 15.5px; color: #1F1605; }
.tc-sub { font-size: 13px; color: #5C4A1F; line-height: 1.45; }
.tc-row { display: flex; gap: 8px; }
.tc-row .pz-input { flex: 1; min-width: 0; text-transform: uppercase; }
.tc-err { font-size: 12.5px; color: var(--red); }
.tc-note { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 14px; background: var(--card);
  border: 1px solid var(--line); font-size: 13px; line-height: 1.45; }
.tc-note svg { flex: none; margin-top: 2px; color: #8A6419; }
.tc-team { display: grid; gap: 10px; padding: 14px; border-radius: 18px; background: var(--card); border: 1px solid var(--line);
  text-decoration: none; color: var(--ink); box-shadow: 0 2px 10px rgba(22,20,28,.05); }
.tc-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 800; font-size: 15px; }
.tc-head > span:first-child { display: flex; align-items: center; gap: 7px; }
.tc-life { display: flex; align-items: center; gap: 2px; font-size: 13px; color: #8A6419; white-space: nowrap; }
.tc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.tc-grid > span { display: grid; gap: 1px; padding: 8px 6px; border-radius: 12px; background: var(--bg); font-size: 10.5px; color: var(--dim); line-height: 1.25; }
.tc-grid b { font-size: 17px; color: var(--ink); }
`;
