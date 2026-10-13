/**
 * Brokers → MovEazy partners: Premium paid by UPI (partner_premium_upi.sql).
 *
 *   PremiumPayments  — UTRs to check: Approve starts Premium (trial days kept)
 *                      and the referrer's 30-day reward timer; Reject tells the
 *                      partner why. Below, the last ones decided.
 *   ReferralPayouts  — rewards on the way and due, with the referrer's UPI or
 *                      bank details; Mark paid once sent.
 *   PlanRewards      — each plan's referral reward, for the settings panel.
 * All need partners.manage; the database checks it again.
 */
import { useCallback, useEffect, useState } from "react";
import { Btn, C, Chip, Empty, inr, relTime, shortDate } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import { friendlyError } from "../../lib/partners";
import {
  crmDecidePremiumPayment, crmMarkCommissionPaid, crmMarkReferralPaid, crmPlans, crmPremiumPayments, crmReferralCommissions, crmReferralPayouts,
  crmSetPlanReward, pctLabel,
} from "../../lib/partnerPlans";

const box = { display: "grid", gap: 10, background: C.bg };

export function PremiumPayments({ canManage, onToast, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [showDone, setShowDone] = useState(false);
  const load = useCallback(() => crmPremiumPayments().then(setData, (e) => { setData({ todo: [], done: [] }); onToast(friendlyError(e), "error"); }), [onToast]);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  if (!canManage) return null;

  const decide = async (p, approve) => {
    let note = "";
    if (!approve) {
      note = window.prompt(`Reject ${p.name}'s payment (UTR ${p.utr})? Say why — they'll see it.`, "Not found in our account");
      if (note === null) return;
    } else if (!window.confirm(`Approve ${inr(p.amount)} from ${p.name} (UTR ${p.utr})? Premium starts now.`)) return;
    setBusy(p.id);
    try {
      await crmDecidePremiumPayment(p.id, approve, note);
      onToast(approve ? `${p.name} is on Premium` : "Rejected — they've been told");
      await load();
      onChanged?.();
    } catch (e) {
      onToast(friendlyError(e), "error");
    } finally {
      setBusy("");
    }
  };

  const todo = data?.todo ?? [];
  return (
    <div className="crm-card" style={box}>
      <div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Premium payments to check{todo.length ? ` · ${todo.length}` : ""}</span>
        <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>
          Partners pay by UPI and enter the UTR. Find it in the bank account, then approve — Premium starts at once.
        </span>
      </div>
      {data === null ? <Empty pad={14}>Loading…</Empty> : todo.length === 0 ? <Empty pad={14}>Nothing waiting.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table className="crm-table">
            <thead><tr><th>Partner</th><th>Plan</th><th>Amount</th><th>UTR</th><th>Sent</th><th /></tr></thead>
            <tbody>
              {todo.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name || p.email}</div>
                    <div className="crm-mute" style={{ fontSize: 11 }}>
                      {[p.phone ? formatForDisplay(p.phone) : "", p.agency, p.referred_by ? `referred by ${p.referred_by}` : "", p.on_trial ? "on Trial Premium" : ""].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{p.plan}</td>
                  <td className="crm-num" style={{ fontWeight: 700 }}>{inr(p.amount)}</td>
                  <td className="crm-num" style={{ fontFamily: "ui-monospace, monospace" }}>{p.utr}</td>
                  <td className="crm-mute">{relTime(p.paid_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn sm variant="primary" disabled={!!busy} onClick={() => decide(p, true)}>Approve</Btn>
                      <Btn sm disabled={!!busy} onClick={() => decide(p, false)}>Reject</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data?.done ?? []).length > 0 && (
        <div>
          <Btn sm onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide" : "Show"} recent decisions · {data.done.length}</Btn>
          {showDone && (
            <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 12 }}>
              {data.done.map((d) => (
                <div key={d.id} className="crm-mute">
                  <b style={{ color: d.status === "approved" ? C.accent : C.coral, textTransform: "capitalize" }}>{d.status}</b>
                  {` · ${d.name} · ${d.plan} · ${inr(d.amount)} · UTR ${d.utr} · ${shortDate(d.decided_at)}${d.decided_by ? ` by ${d.decided_by}` : ""}${d.note ? ` — ${d.note}` : ""}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAYOUT_STATUS = { pending: ["On the way", C.gold], earned: ["Due — pay now", C.accent], paid: ["Paid", C.textMute] };

export function ReferralPayouts({ canManage, onToast }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("open");
  const load = useCallback(() => crmReferralPayouts().then(setRows, (e) => { setRows([]); onToast(friendlyError(e), "error"); }), [onToast]);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  if (!canManage) return null;

  const paid = async (r) => {
    if (!window.confirm(`Mark ${inr(r.amount)} to ${r.referrer} as paid? They'll be told.`)) return;
    setBusy(r.id);
    try { await crmMarkReferralPaid(r.id); onToast("Marked paid"); await load(); } catch (e) { onToast(friendlyError(e), "error"); } finally { setBusy(""); }
  };
  const shown = (rows ?? []).filter((r) => (filter === "open" ? r.status !== "paid" : r.status === filter));
  const due = (rows ?? []).filter((r) => r.status === "earned");
  return (
    <div className="crm-card" style={box}>
      <div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Referral rewards{due.length ? ` · ${due.length} due (${inr(due.reduce((t, r) => t + r.amount, 0))})` : ""}</span>
        <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>
          Earned on a referred partner's first paid plan; due 30 days after it was approved, unless they cancel. Send it to the details shown, then mark it paid.
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["open", "On the way + due"], ["earned", "Due"], ["paid", "Paid"]].map(([k, label]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{label}</Chip>)}
      </div>
      {rows === null ? <Empty pad={14}>Loading…</Empty> : shown.length === 0 ? <Empty pad={14}>Nothing here.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table className="crm-table">
            <thead><tr><th>Referrer</th><th>Brought</th><th>Reward</th><th>Due</th><th>Pay to</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => {
                const [label, tone] = PAYOUT_STATUS[r.status] ?? [r.status, C.textMute];
                const bank = r.bank && r.bank.account ? `${r.bank.name} · A/c ${r.bank.account} · ${r.bank.ifsc}` : "";
                return (
                  <tr key={r.id}>
                    <td><div style={{ fontWeight: 600 }}>{r.referrer}</div><div className="crm-mute" style={{ fontSize: 11 }}>{r.referrer_phone ? formatForDisplay(r.referrer_phone) : ""}</div></td>
                    <td>{r.referee}<div className="crm-mute" style={{ fontSize: 11 }}>{r.plan}</div></td>
                    <td className="crm-num" style={{ fontWeight: 700 }}>{inr(r.amount)}</td>
                    <td><span style={{ color: tone, fontWeight: 700 }}>{label}</span>
                      <div className="crm-mute" style={{ fontSize: 11 }}>{r.status === "paid" ? `${shortDate(r.paid_at)}${r.paid_by ? ` by ${r.paid_by}` : ""}` : shortDate(r.earn_after)}</div></td>
                    <td style={{ fontSize: 12 }}>{r.upi || bank || <span style={{ color: C.coral }}>No details yet — ask them</span>}</td>
                    <td>{r.status === "earned" && <Btn sm variant="primary" disabled={!!busy} onClick={() => paid(r)}>Mark paid</Btn>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const COMMISSION_STATUS = { held: ["Held — referrer not on Premium", C.gold], due: ["Due — pay now", C.accent], paid: ["Paid", C.textMute] };

/** Lifetime referral commission: a cut of MovEazy's share on deals by partners someone referred (partner_referral_commission.sql). */
export function ReferralCommissions({ canManage, onToast }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => crmReferralCommissions().then(setRows, (e) => { setRows([]); onToast(friendlyError(e), "error"); }), [onToast]);
  useEffect(() => { if (canManage) load(); }, [canManage, load]);
  if (!canManage || !rows?.length) return null;

  const paid = async (r) => {
    if (!window.confirm(`Mark ${inr(r.amount)} to ${r.referrer} as paid? They'll be told.`)) return;
    setBusy(r.id);
    try { await crmMarkCommissionPaid(r.id); onToast("Marked paid"); await load(); } catch (e) { onToast(friendlyError(e), "error"); } finally { setBusy(""); }
  };
  const due = rows.filter((r) => r.status === "due");
  return (
    <div className="crm-card" style={box}>
      <div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Lifetime referral commission{due.length ? ` · ${due.length} due (${inr(due.reduce((t, r) => t + r.amount, 0))})` : ""}</span>
        <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>
          Out of MovEazy's share on a MovEazy lead closed by a partner someone referred — earned when the closure is marked received
          (Lead requests → Closures). Held for 30 days when the referrer isn't on Premium.
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="crm-table">
          <thead><tr><th>Referrer</th><th>Deal by</th><th>Commission</th><th>Status</th><th>Pay to</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const [label, tone] = COMMISSION_STATUS[r.status] ?? [r.status, C.textMute];
              const bank = r.bank && r.bank.account ? `${r.bank.name} · A/c ${r.bank.account} · ${r.bank.ifsc}` : "";
              return (
                <tr key={r.id}>
                  <td><div style={{ fontWeight: 600 }}>{r.referrer}</div><div className="crm-mute" style={{ fontSize: 11 }}>{r.referrer_phone ? formatForDisplay(r.referrer_phone) : ""}</div></td>
                  <td>{r.referee}<div className="crm-mute" style={{ fontSize: 11 }}>rent {inr(r.rent)} · {r.deal_type} · {shortDate(r.created_at)}</div></td>
                  <td className="crm-num" style={{ fontWeight: 700 }}>{inr(r.amount)}<div className="crm-mute" style={{ fontSize: 11, fontWeight: 400 }}>{pctLabel(r.rate_pct)} of rent</div></td>
                  <td><span style={{ color: tone, fontWeight: 700 }}>{label}</span>
                    <div className="crm-mute" style={{ fontSize: 11 }}>{r.status === "paid" ? `${shortDate(r.paid_at)}${r.paid_by ? ` by ${r.paid_by}` : ""}` : r.status === "held" ? `until ${shortDate(r.hold_until)}` : ""}</div></td>
                  <td style={{ fontSize: 12 }}>{r.upi || bank || <span style={{ color: C.coral }}>No details yet — ask them</span>}</td>
                  <td>{r.status === "due" && <Btn sm variant="primary" disabled={!!busy} onClick={() => paid(r)}>Mark paid</Btn>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** For "Prices, shares & landing pages": what each plan earns the partner who referred the buyer. */
export function PlanRewards({ canManage, onToast }) {
  const [plans, setPlans] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState("");
  useEffect(() => { crmPlans().then((p) => { setPlans(p); setDraft(Object.fromEntries(p.map((x) => [x.id, String(x.referral_reward)]))); }, () => setPlans([])); }, []);
  if (!plans) return null;
  const save = async (p) => {
    setBusy(p.id);
    try {
      await crmSetPlanReward(p.id, draft[p.id]);
      setPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, referral_reward: Number(draft[p.id]) } : x)));
      onToast(`${p.label}: referrer earns ${inr(draft[p.id])}`);
    } catch (e) { onToast(friendlyError(e), "error"); } finally { setBusy(""); }
  };
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: C.bg }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Referral reward per plan</div>
      <div style={{ display: "grid", gap: 8 }}>
        {plans.filter((p) => p.active).map((p) => {
          const changed = String(p.referral_reward) !== draft[p.id];
          return (
            <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="crm-mute" style={{ fontSize: 11.5, flex: "1 1 160px" }}>{p.label} · {inr(p.price)} — referrer earns (₹)</span>
              <input className="crm-input crm-num" inputMode="numeric" style={{ width: 100, ...(changed ? { borderColor: C.gold } : {}) }}
                disabled={!canManage || !!busy} value={draft[p.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value.replace(/\D/g, "") }))} />
              {changed && <Btn sm variant="primary" disabled={!!busy || draft[p.id] === ""} onClick={() => save(p)}>Save</Btn>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
