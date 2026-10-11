/**
 * CRM → Lead requests. Partner brokers asking for MovEazy leads
 * (partner_moveazy_leads.sql):
 *
 *   To do       ₹2,000 packs waiting for the UTR to be checked against the bank,
 *               Premium brokers past 20 leads without a closure waiting for an
 *               OK, and approved requests waiting for leads to be picked.
 *   Assign      the clients that could go to that broker — fitting what they
 *               asked for first, never one already with 3 brokers — tick and give.
 *   Closures    every MovEazy lead a broker closed, and what's due on Premium
 *               (30% of a month's rent direct with the owner, 20% shared).
 *
 * Needs partners.manage.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, C, Chip, Empty, Loading, Toast, inr, relTime } from "./crmUi";
import { waLink } from "../../lib/partners";
import {
  PACKS, REQUEST_STATUS, crmAssignLeads, crmDecideLeadRequest, crmLeadCandidates, crmLeadClosures, crmLeadRequests,
  crmLeadSettings, crmSetLeadSettings, leadNeedLine,
} from "../../lib/partnerLeads";

const ACTIVE = new Set(["payment_check", "needs_approval", "open"]);

function prefsLine(p = {}) {
  const budget = p.budget_min || p.budget_max
    ? `${p.budget_min ? inr(p.budget_min) : "any"} – ${p.budget_max ? inr(p.budget_max) : "any"}` : "";
  return [(p.flat_types ?? []).join("/"), (p.areas ?? []).join(", "), budget].filter(Boolean).join(" · ") || "no preference";
}

function Assign({ req, onDone, say }) {
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const room = req.lead_count - req.assigned;
  useEffect(() => { crmLeadCandidates(req.id).then(setRows, (e) => { say(e.message, "error"); setRows([]); }); }, [req.id, say]);
  const toggle = (id) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else if (next.size < room) next.add(id);
    return next;
  });
  const pickBest = () => setPicked(new Set((rows ?? []).slice(0, room).map((r) => r.client_id)));
  const give = async () => {
    setBusy(true);
    try {
      const n = await crmAssignLeads(req.id, [...picked]);
      say(`${n} lead${n === 1 ? "" : "s"} given to ${req.broker_name || "the broker"}`);
      onDone();
    } catch (e) {
      say(e.message || "Couldn't assign", "error");
      setBusy(false);
    }
  };
  if (!rows) return <Loading />;
  return (
    <div style={{ marginTop: 10, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span className="crm-label">Pick {room} · {picked.size} picked · {rows.length} could go to them</span>
        <span style={{ flex: 1 }} />
        <Btn sm onClick={pickBest}>Pick the best {Math.min(room, rows.length)}</Btn>
        <Btn sm variant="primary" disabled={!picked.size || busy} onClick={give}>{busy ? "Giving…" : `Give ${picked.size}`}</Btn>
      </div>
      {rows.length === 0 ? <Empty pad={12}>No client is free to give right now.</Empty> : (
        <div style={{ maxHeight: 420, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 8 }}>
          {rows.map((r) => (
            <label key={r.client_id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px",
              borderBottom: `1px solid ${C.lineSoft}`, cursor: "pointer", background: picked.has(r.client_id) ? C.accentSoft : "transparent" }}>
              <input type="checkbox" checked={picked.has(r.client_id)} onChange={() => toggle(r.client_id)}
                disabled={!picked.has(r.client_id) && picked.size >= room} style={{ marginTop: 3, accentColor: C.accent }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 12.5 }}>{r.name || "Unnamed"} </span>
                <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{r.phone}</span>
                <span style={{ display: "block", fontSize: 12, color: C.textDim }}>{leadNeedLine(r) || "—"}</span>
              </span>
              <span style={{ flex: "none", textAlign: "right", fontSize: 10.5 }}>
                <span style={{ display: "block", fontWeight: 700, color: r.fits === 3 ? C.accent : r.fits === 2 ? C.gold : C.textMute }}>
                  {r.fits === 3 ? "Fits" : r.fits === 2 ? "Close" : "Loose"}
                </span>
                <span className="crm-mute">{r.brokers}/3 brokers</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({ r, onChanged, say }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const decide = async (approve) => {
    const note = approve ? "" : window.prompt("Why not? (the broker sees this)", "") ?? null;
    if (note === null) return;
    setBusy(true);
    try {
      await crmDecideLeadRequest(r.id, approve, note);
      say(approve ? "Approved — now pick their leads" : "Rejected");
      onChanged();
    } catch (e) {
      say(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const color = r.status === "payment_check" || r.status === "needs_approval" ? C.gold : r.status === "open" ? C.accent : C.textMute;
  return (
    <div className="crm-card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>
            {r.broker_name || "Broker"} <span className="crm-mute" style={{ fontWeight: 400 }}>{r.agency ? `· ${r.agency}` : ""}</span>
          </div>
          <div className="crm-mute crm-num" style={{ fontSize: 11.5 }}>
            {PACKS[r.pack]?.title}{r.amount ? ` · ${inr(r.amount)}` : r.pack === "free10" ? " · free" : ""} · asked {relTime(r.created_at)}
            {r.utr ? <> · UTR <b style={{ color: C.text }}>{r.utr}</b></> : null}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>Wants: {prefsLine(r.prefs)}</div>
          {r.pack === "premium" && (
            <div className="crm-mute" style={{ fontSize: 11, marginTop: 2 }}>
              Premium so far: {r.premium_given} given · {r.premium_closed} closed
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, border: `1px solid ${color}55`, background: `${color}14`, borderRadius: 99, padding: "2px 8px" }}>
            {REQUEST_STATUS[r.status]} · {r.assigned}/{r.lead_count}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {r.broker_phone && <a className="crm-btn crm-btn--sm crm-btn--wa" href={waLink(r.broker_phone, `Hi ${r.broker_name || ""}, MovEazy here about your lead request.`)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>WhatsApp</a>}
            {(r.status === "payment_check" || r.status === "needs_approval") && (
              <>
                <Btn sm variant="primary" disabled={busy} onClick={() => decide(true)}>{r.status === "payment_check" ? "Payment received" : "Allow more"}</Btn>
                <Btn sm disabled={busy} onClick={() => decide(false)}>Reject</Btn>
              </>
            )}
            {r.status === "open" && <Btn sm variant={open ? undefined : "primary"} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Assign leads"}</Btn>}
          </div>
        </div>
      </div>
      {open && r.status === "open" && <Assign req={r} say={say} onDone={() => { setOpen(false); onChanged(); }} />}
    </div>
  );
}

/** The UPI ID brokers pay, and the 30-lead pack's price. */
function PaySettings({ say }) {
  const [saved, setSaved] = useState(null);
  const [upi, setUpi] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    crmLeadSettings().then((s) => { setSaved(s); setUpi(s?.upi_id || ""); setPrice(String(s?.pack_price ?? "")); }, () => {});
  }, []);
  if (!saved) return null;
  const dirty = upi !== saved.upi_id || String(price) !== String(saved.pack_price);
  const save = async () => {
    setBusy(true);
    try {
      const s = await crmSetLeadSettings(upi.trim(), price);
      setSaved(s);
      say("Saved — brokers pay this from now on");
    } catch (e) {
      say(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="crm-card" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
        <span className="crm-label">UPI ID brokers pay</span>
        <input className="crm-input" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 130 }}>
        <span className="crm-label">30 leads (₹)</span>
        <input className="crm-input crm-num" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
      </label>
      <Btn variant="primary" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Btn>
    </div>
  );
}

export default function CrmLeadRequestsPage() {
  const [tab, setTab] = useState("todo");
  const [reqs, setReqs] = useState(null);
  const [closures, setClosures] = useState(null);
  const [toast, setToast] = useState(null);
  const say = useCallback((message, tone) => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2800);
  }, []);
  const load = useCallback(() => {
    crmLeadRequests().then(setReqs, (e) => { say(e.message, "error"); setReqs([]); });
    crmLeadClosures().then(setClosures, () => setClosures([]));
  }, [say]);
  useEffect(() => { load(); }, [load]);

  const todo = useMemo(() => (reqs ?? []).filter((r) => ACTIVE.has(r.status)), [reqs]);
  const done = useMemo(() => (reqs ?? []).filter((r) => !ACTIVE.has(r.status)), [reqs]);
  const dueTotal = (closures ?? []).reduce((s, c) => s + Number(c.due_amount || 0), 0);

  return (
    <div className="crm-col crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: "14px 16px", maxWidth: 900, width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Lead requests</h1>
        <p className="crm-mute" style={{ fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>
          Partner brokers asking for MovEazy leads. Check a ₹2,000 UTR in the bank before approving; then pick clients for them —
          each client goes to 3 brokers at most.
        </p>
        <PaySettings say={say} />
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <Chip on={tab === "todo"} onClick={() => setTab("todo")}>To do {reqs ? `· ${todo.length}` : ""}</Chip>
          <Chip on={tab === "done"} onClick={() => setTab("done")}>Done</Chip>
          <Chip on={tab === "closures"} onClick={() => setTab("closures")}>Closures {closures ? `· ${closures.length}` : ""}</Chip>
        </div>
        {!reqs ? <Loading /> : tab === "closures" ? (
          !closures?.length ? <Empty>No MovEazy lead has closed through a broker yet.</Empty> : (
            <div className="crm-card">
              <div className="crm-row"><span className="crm-label">Due to MovEazy (Premium)</span><b className="crm-num">{inr(dueTotal)}</b></div>
              {closures.map((c) => (
                <div key={c.assignment_id} className="crm-row" style={{ alignItems: "flex-start" }}>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 12.5 }}>{c.client_name || "Client"}</b>
                    <span className="crm-mute" style={{ fontSize: 11.5 }}> · {c.broker_name} {c.broker_phone}</span>
                    <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
                      {PACKS[c.pack]?.title} · rent {inr(c.closed_rent)} · {c.deal_type === "direct" ? "direct with owner (30%)" : "shared (20%)"} · {relTime(c.closed_at)}
                    </span>
                  </span>
                  <b className="crm-num" style={{ color: Number(c.due_amount) > 0 ? C.accent : C.textMute }}>{Number(c.due_amount) > 0 ? inr(c.due_amount) : "—"}</b>
                </div>
              ))}
            </div>
          )
        ) : (tab === "todo" ? todo : done).length === 0 ? (
          <Empty>{tab === "todo" ? "Nothing waiting." : "Nothing here yet."}</Empty>
        ) : (tab === "todo" ? todo : done).map((r) => <RequestRow key={r.id} r={r} say={say} onChanged={load} />)}
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
