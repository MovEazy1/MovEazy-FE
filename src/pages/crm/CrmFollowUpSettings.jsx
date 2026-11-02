/**
 * Settings → Follow-ups: round-robin of new MovEazy leads across the team
 * (crm_follow_ups.sql). Off while the team is small — everyone works every
 * client; the super admin turns it on once there are more people.
 */
import { useEffect, useState } from "react";
import { Btn, C } from "./crmUi";
import { fetchFollowUpSettings, setRoundRobin } from "../../lib/followUps";

export default function CrmFollowUpSettings({ isSuperAdmin, onToast }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchFollowUpSettings({ fresh: true }).then(setS, () => setS({ round_robin: false, team: [] })); }, []);
  if (!s) return null;
  const flip = async () => {
    setBusy(true);
    try { setS(await setRoundRobin(!s.round_robin)); onToast?.(!s.round_robin ? "Round-robin on" : "Round-robin off"); }
    catch (e) { onToast?.(e?.message || "Couldn't change it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="crm-card" style={{ maxWidth: 620, display: "grid", gap: 8 }}>
      <span className="crm-label">Follow-ups · who owns new leads</span>
      <p className="crm-mute" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.55 }}>
        {s.round_robin
          ? "On: each new MovEazy lead goes to the team member with the fewest open clients, and lands in their Follow-ups (Mine)."
          : "Off: new leads have no owner and everyone works every client. Owners can still be set by hand on any follow-up."}
      </p>
      <span style={{ fontSize: 12.5 }}>Team: {(s.team ?? []).join(", ") || "—"}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn sm variant={s.round_robin ? undefined : "primary"} disabled={!isSuperAdmin || busy} onClick={flip}>
          {s.round_robin ? "Turn round-robin off" : "Turn round-robin on"}
        </Btn>
        {!isSuperAdmin && <span className="crm-mute" style={{ fontSize: 11, color: C.textMute }}>Only the super admin can change this.</span>}
      </div>
    </div>
  );
}
