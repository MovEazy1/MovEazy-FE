/**
 * Who brought each partner in (partner_referral_mapping.sql):
 *   · ReferralClaims — "Who invited you?" requests new partners send from the
 *     app in their first 20 minutes, to approve or reject;
 *   · ReferrerSelect — the Referred-by cell in the partners table: set,
 *     change or clear any partner's referrer (any approved partner;
 *     Premium marked).
 */
import { useCallback, useEffect, useState } from "react";
import { Btn, C, shortDate } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import { friendlyError } from "../../lib/partners";
import { crmDecideReferralClaim, crmReferralClaims, crmSetReferrer } from "../../lib/partnerPlans";

const VIA = { link: "invite link", phone: "invite link (number)", claim: "partner said, approved", crm: "set in CRM" };

export function ReferralClaims({ canManage, onToast, onChanged }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => crmReferralClaims().then(setRows, () => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  if (!rows?.length) return null;

  const decide = async (r, approve) => {
    if (approve && !window.confirm(`Save ${r.referrer} as the partner who brought ${r.partner} in? ${r.referrer} earns lifetime commission on ${r.partner}'s MovEazy deals.`)) return;
    if (!approve && !window.confirm(`Reject ${r.partner}'s request? They'll be told.`)) return;
    setBusy(r.user_id);
    try {
      await crmDecideReferralClaim(r.user_id, approve);
      onToast(approve ? `${r.partner} is now ${r.referrer}'s partner` : "Rejected");
      await load();
      onChanged?.();
    } catch (e) {
      onToast(friendlyError(e), "error");
    } finally {
      setBusy("");
    }
  };
  const pending = rows.filter((r) => r.status === "pending").length;
  return (
    <div className="crm-card" style={{ display: "grid", gap: 10, background: C.bg }}>
      <div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Referrer added by incoming partner{pending ? ` · ${pending} to check` : ""}</span>
        <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>
          New partners can say who invited them (a code or mobile) in their first 20 minutes. Nothing is saved until you approve.
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="crm-table">
          <thead><tr><th>New partner</th><th>Says they were invited by</th><th>They typed</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td><div style={{ fontWeight: 600 }}>{r.partner}</div>
                  <div className="crm-mute" style={{ fontSize: 11 }}>{r.partner_phone ? formatForDisplay(r.partner_phone) : ""} · joined {shortDate(r.joined_at)}</div></td>
                <td><div style={{ fontWeight: 600 }}>{r.referrer}</div>
                  <div className="crm-mute" style={{ fontSize: 11 }}>{r.referrer_phone ? formatForDisplay(r.referrer_phone) : ""}</div></td>
                <td className="crm-num">{r.entered}</td>
                <td>
                  <span style={{ fontWeight: 700, color: r.status === "pending" ? C.gold : r.status === "approved" ? C.accent : C.coral, textTransform: "capitalize" }}>{r.status}</span>
                  {r.decided_at && <div className="crm-mute" style={{ fontSize: 11 }}>{shortDate(r.decided_at)}{r.decided_by ? ` by ${r.decided_by}` : ""}</div>}
                </td>
                <td>
                  {r.status === "pending" && (
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn sm variant="primary" disabled={!canManage || !!busy} onClick={() => decide(r, true)}>Approve</Btn>
                      <Btn sm disabled={!canManage || !!busy} onClick={() => decide(r, false)}>Reject</Btn>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The Referred-by cell: a dropdown of approved partners (Premium marked), or the name for read-only staff. */
export function ReferrerSelect({ partner, current, partners, canManage, onToast, onChanged }) {
  const [busy, setBusy] = useState(false);
  const via = current?.via ? VIA[current.via] || current.via : "";
  if (!canManage) {
    return current ? <span>{current.referrer_name}{via && <div className="crm-mute" style={{ fontSize: 10.5 }}>{via}</div>}</span> : <span className="crm-mute">—</span>;
  }
  const options = partners.filter((p) => p.status === "approved" && p.user_id !== partner.user_id);
  const change = async (id) => {
    const next = options.find((p) => p.user_id === id);
    const msg = next
      ? `Save ${next.name} as the partner who brought ${partner.name} in? ${next.name} earns lifetime commission on ${partner.name}'s MovEazy deals from now on.`
      : `Remove ${current?.referrer_name || "the referrer"} from ${partner.name}? Commission already earned stays.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await crmSetReferrer(partner.user_id, id || null);
      onToast(next ? `${partner.name} ← ${next.name}` : "Referrer removed");
      onChanged?.();
    } catch (e) {
      onToast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span>
      <select className="crm-input" style={{ width: 170, fontSize: 12 }} value={current?.referrer_id || ""} disabled={busy}
        onChange={(e) => change(e.target.value)} aria-label={`Who brought ${partner.name} in`}>
        <option value="">— Nobody —</option>
        {options.map((p) => (
          <option key={p.user_id} value={p.user_id}>{p.name || p.phone}{p.premium_until || p.trial_until ? " ★ Premium" : ""}</option>
        ))}
      </select>
      {via && <div className="crm-mute" style={{ fontSize: 10.5 }}>{via}</div>}
    </span>
  );
}
