/**
 * Tenant views in the CRM (lib/tenantViews.js, tenant_views.sql): who opened
 * a property and how it went for them — on the property's page, on the
 * client's record, and on the Tenant views page — with the sheet the team
 * marks the response in (BR Homes' labels, on every property), and on the
 * client's record the brokers who have them, everything each did, and the
 * WhatsApp to follow up with a broker.
 */
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Btn, C, Chip, relTime } from "./crmUi";
import { DISLIKE_REASONS, LIKED_STATUSES } from "../../lib/buildings";
import { removeTenantReason } from "../../lib/crmPropertyInternal";
import { whatsappUrl } from "../../lib/crmSettings";
import { ASSIGNED_STATUS } from "../../lib/partnerLeads";
import {
  RESPONDERS, brokerFollowUpMessage, fetchBrokerActivity, fetchClientTenantViews, fetchPropertyTenantViews,
  fetchTenantViewHistory, logBrokerFollowUp, saveTenantView, sourcesLabel, viewSignals, viewSummary,
} from "../../lib/tenantViews";

const tone = (v) => (!v.response_by ? C.textMute : v.liked_status === "paid_token" ? C.accent : v.liked_status === "will_pay_token" ? C.gold
  : v.liked === "disliked" ? C.coral : v.liked === "liked" ? C.accent : C.textDim);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
/** "2 BHK · HSR Layout · ₹25,000 · BR Homes 102" */
export const propertyLine = (p) => (p ? [p.flat_type, p.area, p.rent ? inr(p.rent) : "", p.building ? `${p.building}${p.unit_no ? ` ${p.unit_no}` : ""}` : ""]
  .filter(Boolean).join(" · ") : "");

/** One view as a row: who (or which flat), how it went, and the signals. */
export function TenantViewRow({ v, title, sub, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(v)}
      style={{ textAlign: "left", width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", background: "#fff", cursor: "pointer", font: "inherit", fontSize: 12.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</strong>
        <span className="crm-mute" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{relTime(v.last_at)}</span>
      </div>
      {sub && <div className="crm-mute" style={{ fontSize: 11.5 }}>{sub}</div>}
      <div style={{ color: tone(v), fontWeight: 600, marginTop: 2 }}>
        {viewSummary(v)}
        {v.response_by && v.response_by !== "team" && <span className="crm-mute" style={{ fontWeight: 500 }}> · said by {RESPONDERS[v.response_by].toLowerCase()}</span>}
      </div>
      <div className="crm-mute" style={{ fontSize: 11, marginTop: 2 }}>
        {[viewSignals(v), sourcesLabel(v) && `via ${sourcesLabel(v)}`, v.follow_up_on && `follow up ${day(v.follow_up_on)}`].filter(Boolean).join(" · ")}
      </div>
    </button>
  );
}

/**
 * The team marks how a property went for a tenant. `view`: the view (with
 * property_id and client_id); `reasons`: typed ones on offer ({ id, label }).
 */
export function TenantViewSheet({ view, title, sub, reasons = [], onClose, onSaved, onReasonsChange }) {
  const [f, setF] = useState(() => ({
    visit: view.visit || "", liked: view.liked || "", liked_status: view.liked_status || "",
    reasons: view.reasons ?? [], note: view.note || "", follow_up_on: view.follow_up_on || "",
  }));
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState(null);
  useEffect(() => {
    if (view.id) fetchTenantViewHistory(view.id).then(setHistory, () => setHistory([]));
    else setHistory([]);
  }, [view.id]);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const toggle = (v) => setF((cur) => ({ ...cur, reasons: cur.reasons.includes(v) ? cur.reasons.filter((x) => x !== v) : [...cur.reasons, v] }));
  const offered = [...DISLIKE_REASONS, ...reasons.map((r) => ({ id: r.label, label: r.label, custom: r.id }))];
  for (const r of f.reasons) if (!offered.some((o) => o.id === r)) offered.push({ id: r, label: r });

  const addOther = () => {
    const v = other.trim().replace(/\s+/g, " ");
    if (v.length < 2) return;
    if (!f.reasons.some((r) => r.toLowerCase() === v.toLowerCase())) set({ reasons: [...f.reasons, v] });
    setOther("");
  };
  const removeOption = async (r) => {
    try { await removeTenantReason(r.custom); onReasonsChange?.(); set({ reasons: f.reasons.filter((x) => x !== r.id) }); }
    catch (e) { setErr(e?.message || "Couldn't remove it."); }
  };
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const pending = other.trim().length >= 2 && !f.reasons.includes(other.trim()) ? [other.trim()] : [];
      const saved = await saveTenantView(view.property_id, view.client_id, { ...f, reasons: [...f.reasons, ...pending] });
      onSaved(saved);
    } catch (e) {
      setErr(e?.message || "Couldn't save. Please try again.");
      setBusy(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 6px" };
  const row = { display: "flex", gap: 6, flexWrap: "wrap" };
  return (
    <div role="dialog" aria-label="Tenant's response" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,34,30,.35)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px, 100%)", height: "100%", background: C.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 34px rgba(16,34,30,.18)" }}>
        <div className="crm-colhead">
          <span className="crm-label" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="crm-scroll" style={{ flex: 1, padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
          <div className="crm-card" style={{ fontSize: 12.5, display: "grid", gap: 3 }}>
            {sub && <span>{sub}</span>}
            <span className="crm-mute">
              {[viewSignals(view) || "Not opened yet", view.first_at && `first ${day(view.first_at)}`, view.last_at && `last ${relTime(view.last_at)}`].filter(Boolean).join(" · ")}
            </span>
            {sourcesLabel(view) && <span className="crm-mute">Via {sourcesLabel(view)}</span>}
          </div>

          <div>
            <div style={label}>Visit</div>
            <div style={row}>
              <Chip on={f.visit === ""} onClick={() => set({ visit: "" })}>Not yet</Chip>
              <Chip on={f.visit === "pending"} onClick={() => set({ visit: "pending" })}>Visit Pending</Chip>
              <Chip on={f.visit === "done"} onClick={() => set({ visit: "done" })}>Visit Done</Chip>
            </div>
          </div>

          <div>
            <div style={label}>The flat</div>
            <div style={row}>
              <Chip on={f.liked === "liked"} onClick={() => set({ liked: f.liked === "liked" ? "" : "liked" })}>Liked the flat</Chip>
              <Chip on={f.liked === "disliked"} onClick={() => set({ liked: f.liked === "disliked" ? "" : "disliked" })}>Did not like the flat</Chip>
            </div>
          </div>

          {f.liked === "liked" && (
            <div>
              <div style={label}>Where they are</div>
              <div style={row}>
                {LIKED_STATUSES.map((s) => (
                  <Chip key={s.id} on={f.liked_status === s.id} onClick={() => set({ liked_status: f.liked_status === s.id ? "" : s.id })}>{s.label}</Chip>
                ))}
              </div>
            </div>
          )}

          {f.liked === "disliked" && (
            <div>
              <div style={label}>Why not (pick any)</div>
              <div style={row}>
                {offered.map((r) => (
                  <span key={r.id} style={{ display: "inline-flex", alignItems: "center" }}>
                    <Chip on={f.reasons.includes(r.id)} onClick={() => toggle(r.id)}>{r.label}</Chip>
                    {r.custom && (
                      <button type="button" aria-label={`Remove "${r.label}" from the list`} onClick={() => removeOption(r)}
                        style={{ border: 0, background: "none", cursor: "pointer", color: C.textMute, padding: "0 2px" }}><X size={13} /></button>
                    )}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input className="crm-input" placeholder="Any other issue — type it" value={other} maxLength={60}
                  onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} />
                <Btn onClick={addOther} disabled={other.trim().length < 2}>Add</Btn>
              </div>
              <div className="crm-mute" style={{ fontSize: 11, marginTop: 4 }}>A reason you add here is offered on every property from now on.</div>
            </div>
          )}

          <div>
            <div style={label}>Follow up on</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input className="crm-input" type="date" value={f.follow_up_on} onChange={(e) => set({ follow_up_on: e.target.value })} style={{ maxWidth: 200 }} />
              {f.follow_up_on && <Btn sm onClick={() => set({ follow_up_on: "" })}>Clear</Btn>}
            </div>
          </div>

          <textarea className="crm-input" rows={2} placeholder="Note" value={f.note} maxLength={1000} onChange={(e) => set({ note: e.target.value })} />
          {err && <div style={{ color: C.coral, fontSize: 12.5, fontWeight: 600 }}>{err}</div>}

          {(history ?? []).length > 0 && (
            <div>
              <div style={label}>History</div>
              <div style={{ display: "grid", gap: 5 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{viewSummary({ ...h, response_by: h.by })}</span>
                    <span className="crm-mute"> · {RESPONDERS[h.by] || h.by}{h.actor ? ` (${h.actor})` : ""} · {relTime(h.at)}</span>
                    {h.note && <div className="crm-mute">{h.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
          <Btn variant="primary" onClick={save} disabled={busy} style={{ width: "100%" }}>{busy ? "Saving…" : "Save response"}</Btn>
        </div>
      </div>
    </div>
  );
}

/** CRM property page: every tenant who opened it, and how it went. */
export function PropertyTenantViews({ propertyId, onToast }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => fetchPropertyTenantViews(propertyId).then(setD, () => setD({ views: [], reasons: [] })), [propertyId]);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  const views = d.views ?? [];
  return (
    <>
      {views.length === 0 ? <span className="crm-mute" style={{ fontSize: 12 }}>Nobody we know has opened it yet.</span> : (
        <div style={{ display: "grid", gap: 6 }}>
          {views.map((v) => (
            <TenantViewRow key={v.id} v={v} title={`${v.client?.name || "Tenant"} · ${v.client?.phone || ""}`} onOpen={setOpen} />
          ))}
        </div>
      )}
      {open && (
        <TenantViewSheet view={open} title={`${open.client?.name || "Tenant"} · ${open.property_id}`} sub={open.client?.phone}
          reasons={d.reasons ?? []} onClose={() => setOpen(null)} onReasonsChange={load}
          onSaved={() => { setOpen(null); load(); onToast?.("Response saved"); }} />
      )}
    </>
  );
}

/** CRM client record: the properties they opened, and how each went. */
export function ClientTenantViews({ clientId, clientName, onSaved }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => fetchClientTenantViews(clientId).then(setD, () => setD({ views: [], reasons: [] })), [clientId]);
  useEffect(() => { setD(null); load(); }, [load]);
  const views = d?.views ?? [];
  if (!views.length) return null;
  return (
    <div>
      <div className="crm-label" style={{ marginBottom: 7 }}>Properties they viewed · {views.length}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {views.map((v) => <TenantViewRow key={v.id} v={v} title={v.property_id} sub={propertyLine(v.property)} onOpen={setOpen} />)}
      </div>
      {open && (
        <TenantViewSheet view={open} title={`${clientName || "Tenant"} · ${open.property_id}`} sub={propertyLine(open.property)}
          reasons={d.reasons ?? []} onClose={() => setOpen(null)} onReasonsChange={load}
          onSaved={() => { setOpen(null); load(); onSaved?.(); }} />
      )}
    </div>
  );
}

const EVENT_LABEL = { call: "Call", whatsapp: "WhatsApp", status: "Status", follow_up: "Follow-up", response: "Response", team_follow_up: "MovEazy" };

/**
 * CRM client record: the partner brokers who have this client, everything
 * each did with them, and a WhatsApp to ask the broker how it's going.
 */
export function ClientBrokerActivity({ client, onLogged, onToast }) {
  const [rows, setRows] = useState([]);
  const [shown, setShown] = useState(null);
  const load = useCallback(() => fetchBrokerActivity(client.id).then(setRows, () => setRows([])), [client.id]);
  useEffect(() => { setRows([]); load(); }, [load]);
  if (!rows.length) return null;

  const followUp = async (b) => {
    const text = brokerFollowUpMessage({
      broker: b.broker_name, clientName: client.name, clientPhone: String(client.phone || "").replace(/\D/g, "").slice(-10), flat: b.first_flat,
    });
    const url = whatsappUrl(b.broker_phone, text);
    if (!url) { onToast?.("No number on this broker", "error"); return; }
    window.open(url, "_blank", "noopener");
    try { await logBrokerFollowUp(b.assignment_id); load(); onLogged?.(); } catch { /* the message still went */ }
  };

  return (
    <div>
      <div className="crm-label" style={{ marginBottom: 7 }}>Partner brokers · {rows.length}</div>
      <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((b) => {
          const last = b.events[0];
          const open = shown === b.assignment_id;
          return (
            <div key={b.assignment_id} style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <span style={{ minWidth: 0, fontSize: 12.5 }}>
                  <b>{b.broker_name}</b> <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{b.broker_phone}</span>
                  <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
                    {[`Given ${relTime(b.assigned_at)}`, b.pack === "website" ? "MovEazy Website" : "",
                      b.flats_seen ? `saw ${b.flats_seen} of their flat${b.flats_seen === 1 ? "" : "s"}` : "",
                      b.follow_up_on ? `follows up ${day(b.follow_up_on)}${b.follow_up_note ? ` — ${b.follow_up_note}` : ""}` : "",
                      last ? `last: ${last.detail} ${relTime(last.at)}` : "nothing done yet"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: b.status === "assigned" ? C.gold : C.accent, whiteSpace: "nowrap" }}>
                  {ASSIGNED_STATUS[b.status] || b.status}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <Btn sm variant="primary" onClick={() => followUp(b)}><MessageCircle size={13} /> Follow up with broker</Btn>
                {b.events.length > 0 && <Btn sm onClick={() => setShown(open ? null : b.assignment_id)}>{open ? "Hide" : `What they did · ${b.events.length}`}</Btn>}
              </div>
              {open && (
                <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                  {b.events.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, display: "flex", gap: 8 }}>
                      <span className="crm-chip" style={{ flex: "none", pointerEvents: "none" }}>{EVENT_LABEL[e.kind] || e.kind}</span>
                      <span style={{ color: C.textDim }}>{e.detail} <span className="crm-mute">· {e.actor ? `${e.actor}, ` : ""}{relTime(e.at)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

