/**
 * CRM → Partner payments (the phone's Payments tab): every partner who signed
 * up, by how far they got with paying — never tapped Pay, tapped and didn't
 * pay, UTR waiting, on trial, on Premium — and the same for the ₹2,000 lead
 * pack. Call or WhatsApp whoever is stuck; approve or reject a Premium UTR
 * here (partners.manage, as on Brokers). ?step= opens one step.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCrm } from "../CrmShell";
import { C, Empty, Loading, Toast, inr, relTime, shortDate } from "../crmUi";
import { SCOPES } from "../../../lib/adminScopes";
import { friendlyError } from "../../../lib/partners";
import { crmDecidePremiumPayment } from "../../../lib/partnerPlans";
import {
  PACK_STEPS, PREMIUM_STEPS, countSteps, daysLeft, fetchPaymentsFlow, lastUnpaidTap, packStep, paymentNudge, premiumStep,
} from "../../../lib/crmMobile";
import { ContactButtons, Segment, updatedAt } from "./phoneUi";

const PLAN_NAME = { trial_1m: "1 month", pro_5m: "5 months", pro_12m: "12 months" };
const planName = (id) => PLAN_NAME[id] || String(id || "").replace(/_/g, " ");

export default function CrmPartnerPayments() {
  const { access } = useCrm();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [at, setAt] = useState(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);
  const kind = params.get("kind") === "pack" ? "pack" : "premium";
  const steps = kind === "pack" ? PACK_STEPS : PREMIUM_STEPS;
  const stepOf = kind === "pack" ? packStep : premiumStep;
  const step = steps.some((s) => s.id === params.get("step")) ? params.get("step") : "all";
  const canDecide = access.has(SCOPES.PARTNERS_MANAGE);

  const load = useCallback(async () => {
    try {
      setRows(await fetchPaymentsFlow());
      setAt(new Date());
      setErr("");
    } catch (e) {
      setErr(friendlyError(e, "Couldn't load partner payments."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3200);
  };
  const setQ = (next) => setParams((p) => {
    const q = new URLSearchParams(p);
    for (const [k, v] of Object.entries(next)) { if (v) q.set(k, v); else q.delete(k); }
    return q;
  }, { replace: true });

  const counts = useMemo(() => countSteps(rows ?? [], stepOf, steps), [rows, stepOf, steps]);
  const shown = useMemo(() => (rows ?? []).filter((b) => step === "all" || stepOf(b) === step), [rows, step, stepOf]);

  const decide = async (b, pay, approve) => {
    let note = "";
    if (!approve) {
      note = window.prompt(`Reject ${b.name}'s payment (UTR ${pay.utr})? Say why — they'll see it.`, "Not found in our account");
      if (note === null) return;
    } else if (!window.confirm(`Approve ${inr(pay.amount)} from ${b.name} (UTR ${pay.utr})? Premium starts now.`)) return;
    setBusy(pay.id);
    try {
      await crmDecidePremiumPayment(pay.id, approve, note);
      showToast(approve ? `${b.name} is on Premium` : "Rejected — they've been told");
      await load();
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setBusy("");
    }
  };

  if (err && !rows) return <Empty>{err}</Empty>;
  if (!rows) return <Loading label="Loading partner payments…" />;

  return (
    <div className="crm-ph-page" style={{ gap: 12 }}>
      <Segment value={kind} onChange={(k) => setQ({ kind: k === "pack" ? "pack" : "", step: "" })}
        options={[["premium", "Premium plans"], ["pack", "₹2,000 lead pack"]]} />

      <div className="crm-ph-chips">
        <button type="button" className={step === "all" ? "crm-ph-chip crm-ph-chip--on" : "crm-ph-chip"} onClick={() => setQ({ step: "" })}>
          All <b>{rows.length}</b>
        </button>
        {steps.map((s) => (
          <button key={s.id} type="button" className={step === s.id ? "crm-ph-chip crm-ph-chip--on" : "crm-ph-chip"}
            onClick={() => setQ({ step: s.id })}>
            {s.label} <b>{counts[s.id] ?? 0}</b>
          </button>
        ))}
      </div>
      <p className="crm-ph-note">
        {step === "all" ? `Every partner who signed up, by where they are with ${kind === "pack" ? "the lead pack" : "paying for Premium"}.`
          : steps.find((s) => s.id === step)?.hint}
        {at ? ` · ${updatedAt(at)}` : ""}
      </p>

      {/* The funnel at a glance: how many reached each step. */}
      <div className="crm-ph-card" style={{ gap: 6 }}>
        {steps.map((s) => {
          const n = counts[s.id] ?? 0;
          const pct = rows.length ? Math.round((n / rows.length) * 100) : 0;
          return (
            <button key={s.id} type="button" onClick={() => setQ({ step: s.id })}
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, textAlign: "left", width: "100%" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</span>
              <span className="crm-num" style={{ fontSize: 12.5, fontWeight: 800 }}>{n}</span>
              <span style={{ gridColumn: "1 / -1", height: 6, borderRadius: 4, background: C.surfaceAlt, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: s.id === "utr" ? C.gold : C.accent }} />
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Empty pad={20}>Nobody here.</Empty>
      ) : (
        <div>
          {shown.map((b) => {
            const st = stepOf(b);
            const label = steps.find((s) => s.id === st)?.label;
            const tap = kind === "premium" ? lastUnpaidTap(b) : (b.lead_pack ?? []).find((q) => q.status === "awaiting_payment");
            const utrs = kind === "premium"
              ? (b.premium ?? []).filter((p) => p.status === "payment_check")
              : (b.lead_pack ?? []).filter((q) => q.status === "payment_check");
            const left = b.plan_until ? daysLeft(b.plan_until) : 0;
            return (
              <div key={b.user_id} className="crm-ph-card">
                <div className="crm-ph-card-top">
                  <div style={{ minWidth: 0 }}>
                    <b>{b.name || "A partner"}</b>
                    <div className="crm-ph-meta">{[b.agency, `joined ${shortDate(b.created_at)}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="crm-ph-pill" style={st === "utr" ? { color: C.gold, borderColor: "#E7D3AE", background: "#FBF3E4" }
                    : st === "tapped" ? { color: C.coral, borderColor: "#E8C4BC", background: "#FBEEEB" } : undefined}>{label}</span>
                </div>

                {b.plan_source && (
                  <div className="crm-ph-meta">
                    {b.plan_source === "trial" ? "Trial" : "Premium"}: {left} day{left === 1 ? "" : "s"} left
                    {b.plan_source === "trial" && left <= 3 ? <b style={{ color: C.coral }}> · ending soon</b> : null}
                  </div>
                )}
                {st === "tapped" && tap && (
                  <div className="crm-ph-meta">
                    Tapped Pay {kind === "premium" ? `for the ${planName(tap.plan_id)} plan` : "for the lead pack"}
                    {tap.amount ? ` (${inr(tap.amount)})` : ""} · {relTime(tap.created_at)}
                  </div>
                )}
                {utrs.map((u) => (
                  <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 10, background: "#FBF3E4" }}>
                    <div className="crm-ph-meta">
                      {inr(u.amount)} · UTR <b className="crm-num">{u.utr || "—"}</b> · {relTime(u.paid_at || u.created_at)}
                    </div>
                    {kind === "premium" && canDecide ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="crm-btn crm-btn--primary" style={{ flex: 1, justifyContent: "center" }}
                          disabled={busy === u.id} onClick={() => decide(b, u, true)}>Approve</button>
                        <button type="button" className="crm-btn crm-btn--danger" style={{ flex: 1, justifyContent: "center" }}
                          disabled={busy === u.id} onClick={() => decide(b, u, false)}>Reject</button>
                      </div>
                    ) : kind === "pack" && canDecide ? (
                      <Link to="/crm/lead-requests" className="crm-btn" style={{ justifyContent: "center", textDecoration: "none" }}>Check it in Lead requests</Link>
                    ) : (
                      <span className="crm-ph-note">Someone with partner access approves this.</span>
                    )}
                  </div>
                ))}
                {kind === "premium" && st === "premium" && (b.premium ?? []).some((p) => ["approved", "paid"].includes(p.status)) && (
                  <div className="crm-ph-meta">
                    Paid {inr((b.premium ?? []).find((p) => ["approved", "paid"].includes(p.status)).amount)}
                  </div>
                )}
                <ContactButtons phone={b.phone} label={b.name} text={paymentNudge(b, st, kind === "pack")} />
              </div>
            );
          })}
        </div>
      )}
      <Toast {...(toast ?? {})} />
    </div>
  );
}
