/**
 * partners.moveazy.co.in/sales-funnel — the broker sales funnel, for MovEazy.
 *
 *   /sales-funnel         the funnel (numbers → signed up → payment tried →
 *                         active → profile complete), every broker with their
 *                         stage, payments to approve, referral payouts, plans
 *   /sales-funnel/leads   the same, cut by channel: where brokers come from and
 *                         how far each channel gets them — with a WhatsApp
 *                         nudge for whoever is stuck
 *
 * Reads partner_funnel() (CRM staff). Approving or refunding a payment,
 * marking a payout and editing plans are the super admin's alone — the
 * database refuses anyone else.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Crown, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { GoogleButton } from "./PartnerWelcome";
import { Loading, WhatsAppIcon, toast } from "./partnerUi";
import { friendlyError, inr, pp, waLink } from "../../lib/partners";
import { decidePayment, fetchFunnel, markReferralPaid, savePlan } from "../../lib/partnerPlans";

const STAGES = [
  ["number", "Number filled"], ["signed_up", "Signed up"], ["payment_tried", "Payment tried"], ["active", "On a plan"], ["profile", "Profile complete"],
];
const STAGE_LABEL = Object.fromEntries(STAGES);
const APP = "https://partners.moveazy.co.in";

function stageOf(b) {
  if (b.kind === "prospect") return "number";
  if (b.plan_active) return b.profile_completed_at ? "profile" : "active";
  if ((b.payments || []).length) return "payment_tried";
  return "signed_up";
}
const reach = (stage) => STAGES.findIndex(([k]) => k === stage);

function nudge(b) {
  const first = (b.name || "").split(" ")[0] || "there";
  switch (stageOf(b)) {
    case "number": return `Hi! You started joining MovEazy Partners. Finish in 30 seconds — sign in with Google here: ${APP}`;
    case "signed_up": return `Hi ${first}, welcome to MovEazy Partners! Premium unlocks 1000+ verified rental listings with owner contacts, AI matching and your broker groups. See the plans: ${APP}/premium`;
    case "payment_tried": return `Hi ${first}, your MovEazy Premium payment didn't complete. Need a hand? Here's the link again: ${APP}/premium`;
    case "active": return `Hi ${first}, you're on MovEazy Premium! Complete your profile (areas + RERA ID) to get your Gold Partner badge: ${APP}`;
    default: return `Hi ${first}, thanks for being a MovEazy Gold Partner! Refer brokers and earn ₹1,500 each: ${APP}/referrals`;
  }
}

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const PAY_TONE = { started: "#B45309", paid: "#15803D", approved: "#15803D", rejected: "#B91C1C", refunded: "#B91C1C" };

export default function SalesFunnel() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const byChannel = /\/sales-funnel\/leads/.test(pathname);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(byChannel ? "channels" : "brokers");
  const [stage, setStage] = useState("");
  const [channel, setChannel] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchFunnel());
      setErr("");
    } catch (e) {
      setErr(e?.code === "42501" ? "This page is for the MovEazy team." : friendlyError(e, "Could not load the funnel."));
    }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { setTab(byChannel ? "channels" : "brokers"); }, [byChannel]);

  const people = useMemo(() => {
    if (!data) return [];
    const brokers = (data.brokers || []).map((b) => ({ ...b, kind: "broker" }));
    const prospects = (data.prospects || []).map((p) => ({ ...p, kind: "prospect", name: "", status: "", user_id: `p-${p.phone}` }));
    return [...brokers, ...prospects].map((x) => ({ ...x, stage: stageOf(x), channel: x.channel || "direct" }));
  }, [data]);

  const counts = useMemo(() => Object.fromEntries(STAGES.map(([k]) => [k, people.filter((p) => reach(p.stage) >= reach(k)).length])), [people]);
  const channels = useMemo(() => {
    const m = new Map();
    for (const p of people) {
      const c = m.get(p.channel) || { channel: p.channel, ...Object.fromEntries(STAGES.map(([k]) => [k, 0])) };
      for (const [k] of STAGES) if (reach(p.stage) >= reach(k)) c[k] += 1;
      m.set(p.channel, c);
    }
    return [...m.values()].sort((a, b) => b.number - a.number);
  }, [people]);
  const shown = people.filter((p) => (!stage || p.stage === stage) && (!channel || p.channel === channel));

  const decide = async (pay, approve) => {
    const note = approve ? "" : window.prompt("Reason (refund / not received)?", "") ?? null;
    if (!approve && note === null) return;
    try {
      await decidePayment(pay.id, approve, note || "");
      toast(approve ? "Plan activated" : "Payment rejected, plan ended");
      load();
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  if (loading) return <Loading />;
  if (!user) {
    return <div className="sfn"><style>{CSS}</style><div className="sfn-gate"><h1>Sales funnel</h1><p>Sign in with your MovEazy team account.</p><GoogleButton /></div></div>;
  }

  return (
    <div className="sfn">
      <style>{CSS}</style>
      <header className="sfn-head">
        <div>
          <h1>Broker sales funnel</h1>
          <nav>
            <Link to={pp("/sales-funnel")} className={!byChannel ? "on" : ""}>Funnel</Link>
            <Link to={pp("/sales-funnel/leads")} className={byChannel ? "on" : ""}>Leads by channel</Link>
            <Link to={pp("/")}>Partner app</Link>
          </nav>
        </div>
        <button type="button" className="pz-btn" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </header>

      {err ? <div className="sfn-card">{err}</div> : !data ? <Loading label="Loading the funnel…" /> : (
        <>
          <section className="sfn-steps">
            {STAGES.map(([k, label], i) => (
              <button key={k} type="button" className={`sfn-step${stage === k ? " on" : ""}`} onClick={() => { setStage(stage === k ? "" : k); setTab("brokers"); }}>
                <b>{counts[k]}</b><span>{label}</span>
                {i > 0 && counts[STAGES[i - 1][0]] > 0 && <em>{Math.round((counts[k] / counts[STAGES[i - 1][0]]) * 100)}%</em>}
              </button>
            ))}
          </section>

          <div className="sfn-tabs">
            {[["channels", "By channel"], ["brokers", "People"], ["payments", "Payments"], ["referrals", "Referrals"], ["plans", "Plans"]].map(([k, l]) => (
              <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === "channels" && (
            <div className="sfn-card sfn-scroll">
              <table>
                <thead><tr><th>Channel</th>{STAGES.map(([k, l]) => <th key={k}>{l}</th>)}<th>Sign-up → plan</th></tr></thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.channel} onClick={() => { setChannel(c.channel); setTab("brokers"); }} className="click">
                      <td><b>{c.channel}</b></td>{STAGES.map(([k]) => <td key={k}>{c[k]}</td>)}
                      <td>{c.signed_up ? `${Math.round((c.active / c.signed_up) * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pz-hint">Tap a channel to see its people. Channels come from ?ref= referral links, utm_source tags, group invites and the referring site.</p>
            </div>
          )}

          {tab === "brokers" && (
            <div className="sfn-card sfn-scroll">
              <div className="sfn-filters">
                <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage"><option value="">Every stage</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel"><option value="">Every channel</option>{channels.map((c) => <option key={c.channel}>{c.channel}</option>)}</select>
                <span className="pz-meta">{shown.length} people</span>
              </div>
              <table>
                <thead><tr><th>Broker</th><th>Stage</th><th>Channel</th><th>Joined</th><th>Plan</th><th>Nudge</th></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.user_id}>
                      <td><b>{p.name || "—"}</b><br /><span className="pz-meta">{p.phone}{p.agency ? ` · ${p.agency}` : ""}</span></td>
                      <td><span className={`sfn-stage s-${p.stage}`}>{STAGE_LABEL[p.stage]}</span></td>
                      <td>{p.channel}{p.referred_by ? <><br /><span className="pz-meta">ref {p.referred_by}</span></> : null}</td>
                      <td>{fmt(p.created_at)}</td>
                      <td>{p.plan_active ? <><Crown size={13} color="#8A6419" /> till {fmt(p.plan_until)}</> : (p.payments || [])[0] ? <span style={{ color: PAY_TONE[p.payments[0].status] }}>{p.payments[0].plan_id} · {p.payments[0].status}</span> : "—"}</td>
                      <td>{p.phone && <a className="pz-btn pz-btn--sm pz-wa" href={waLink(p.phone, nudge(p))} target="_blank" rel="noreferrer"><WhatsAppIcon size={14} /> Nudge</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "payments" && (
            <div className="sfn-card sfn-scroll">
              {!data.can_decide && <p className="pz-hint">Only the super admin can approve or reject payments.</p>}
              <table>
                <thead><tr><th>Broker</th><th>Plan</th><th>Amount</th><th>Status</th><th>Started</th><th>Razorpay</th><th></th></tr></thead>
                <tbody>
                  {(data.brokers || []).flatMap((b) => (b.payments || []).map((pay) => ({ b, pay }))).sort((x, y) => (y.pay.created_at > x.pay.created_at ? 1 : -1)).map(({ b, pay }) => (
                    <tr key={pay.id}>
                      <td><b>{b.name}</b><br /><span className="pz-meta">{b.phone}</span></td>
                      <td>{pay.plan_id}</td>
                      <td>{inr(pay.amount)}</td>
                      <td><span style={{ color: PAY_TONE[pay.status], fontWeight: 700 }}>{pay.status}</span>{pay.decided_by ? <><br /><span className="pz-meta">by {pay.decided_by}</span></> : null}{pay.note ? <><br /><span className="pz-meta">{pay.note}</span></> : null}</td>
                      <td>{fmt(pay.created_at)}</td>
                      <td className="pz-meta">{pay.gateway_payment_id || pay.link_id || "—"}</td>
                      <td>
                        {data.can_decide && pay.status === "started" && <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => decide(pay, true)}><Check size={14} /> Approve</button>}
                        {data.can_decide && pay.status !== "rejected" && pay.status !== "refunded" && <button type="button" className="pz-btn pz-btn--sm" onClick={() => decide(pay, false)}><X size={14} /> {pay.status === "started" ? "Reject" : "Refund"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "referrals" && (
            <div className="sfn-card sfn-scroll">
              <table>
                <thead><tr><th>Referrer</th><th>Referred</th><th>Plan</th><th>Amount</th><th>Status</th><th>Earn after</th><th></th></tr></thead>
                <tbody>
                  {(data.referrals || []).map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.referrer}</b><br /><span className="pz-meta">{r.referrer_phone}</span></td>
                      <td>{r.referee}</td><td>{r.plan_id}</td><td>{inr(r.amount)}</td><td>{r.status}</td><td>{fmt(r.earn_after)}</td>
                      <td>{data.can_decide && r.status === "earned" && (
                        <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={async () => {
                          try { await markReferralPaid(r.id); toast("Marked paid"); load(); } catch (e) { toast(friendlyError(e), "error"); }
                        }}>Mark paid</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.referrals || []).length === 0 && <p className="pz-meta">No referral earnings yet.</p>}
            </div>
          )}

          {tab === "plans" && <PlansEditor plans={data.plans || []} canEdit={data.can_decide} onSaved={load} />}
        </>
      )}
    </div>
  );
}

function PlansEditor({ plans, canEdit, onSaved }) {
  const [rows, setRows] = useState(plans);
  useEffect(() => setRows(plans), [plans]);
  const set = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="sfn-card">
      {!canEdit && <p className="pz-hint">Only the super admin can change plans.</p>}
      {rows.map((p, i) => (
        <div key={p.id} className="sfn-plan">
          <b>{p.id}</b>
          <label>Label<input value={p.label} disabled={!canEdit} onChange={(e) => set(i, { label: e.target.value })} /></label>
          <label>Price ₹<input inputMode="numeric" value={p.price} disabled={!canEdit} onChange={(e) => set(i, { price: e.target.value.replace(/\D/g, "") })} /></label>
          <label>Months<input inputMode="numeric" value={p.months} disabled={!canEdit} onChange={(e) => set(i, { months: e.target.value.replace(/\D/g, "") })} /></label>
          <label>Refund days<input inputMode="numeric" value={p.refund_days} disabled={!canEdit} onChange={(e) => set(i, { refund_days: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="wide">Note<input value={p.note} disabled={!canEdit} onChange={(e) => set(i, { note: e.target.value })} /></label>
          {canEdit && <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={async () => {
            try { await savePlan(p); toast("Plan saved"); onSaved(); } catch (e) { toast(friendlyError(e), "error"); }
          }}>Save</button>}
        </div>
      ))}
    </div>
  );
}

const CSS = `
.sfn { max-width: 1180px; margin: 0 auto; padding: 18px 16px 60px; font-family: Inter, system-ui, sans-serif; color: var(--ink); }
.sfn-gate { max-width: 380px; margin: 80px auto; text-align: center; }
.sfn-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.sfn-head h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: -0.02em; }
.sfn-head nav { display: flex; gap: 14px; flex-wrap: wrap; }
.sfn-head nav a { color: var(--dim); font-weight: 700; text-decoration: none; font-size: 14px; }
.sfn-head nav a.on { color: var(--g); }
.sfn-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.sfn-step { position: relative; text-align: left; padding: 14px; border-radius: 14px; border: 1px solid var(--line); background: #fff; font: inherit; color: inherit; cursor: pointer; }
.sfn-step.on { border-color: var(--g); background: var(--gl); }
.sfn-step b { display: block; font-size: 26px; letter-spacing: -0.02em; }
.sfn-step span { font-size: 13px; color: var(--dim); }
.sfn-step em { position: absolute; top: 10px; right: 12px; font-style: normal; font-size: 12px; font-weight: 800; color: var(--g); }
.sfn-tabs { display: flex; gap: 6px; margin: 16px 0 10px; overflow-x: auto; }
.sfn-tabs button { border: 1px solid var(--line); background: #fff; border-radius: 99px; padding: 8px 14px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.sfn-tabs button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.sfn-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
.sfn-scroll { overflow-x: auto; }
.sfn table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 720px; }
.sfn th { text-align: left; font-size: 12px; color: var(--dim); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.sfn td { padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.sfn tr.click { cursor: pointer; }
.sfn tr.click:hover { background: var(--gl); }
.sfn td .pz-btn { margin: 0 4px 4px 0; }
.sfn-filters { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.sfn-filters select { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; font: inherit; }
.sfn-stage { display: inline-block; font-size: 12px; font-weight: 800; border-radius: 99px; padding: 3px 9px; background: #F3F4F6; color: var(--dim); white-space: nowrap; }
.sfn-stage.s-signed_up { background: #E0F2FE; color: #075985; }
.sfn-stage.s-payment_tried { background: #FEF3C7; color: #92400E; }
.sfn-stage.s-active { background: #DCFCE7; color: #166534; }
.sfn-stage.s-profile { background: linear-gradient(135deg, #F7E9C6, #E4B659); color: #2A1D05; }
.sfn-plan { display: grid; grid-template-columns: 90px repeat(4, 1fr) 2fr auto; gap: 8px; align-items: end; padding: 10px 0; border-bottom: 1px solid var(--line); }
.sfn-plan label { display: grid; gap: 4px; font-size: 12px; color: var(--dim); font-weight: 700; }
.sfn-plan input { border: 1px solid var(--line); border-radius: 8px; padding: 8px; font: inherit; color: var(--ink); }
@media (max-width: 760px) {
  .sfn-steps { grid-template-columns: repeat(2, 1fr); }
  .sfn-plan { grid-template-columns: 1fr 1fr; }
  .sfn-plan label.wide { grid-column: 1 / -1; }
}
`;
