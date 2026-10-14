/**
 * CRM → Partners: one partner's MovEazy leads (crm_partner_leads,
 * partner_pool_milestones.sql) — where each came from, where it stands, and
 * when the partner last called or WhatsApped them (taps in the partner app;
 * partners never see the number itself).
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { C, Empty, Loading, inr, relTime } from "./crmUi";
import { fetchCrmPartnerLeads } from "../../lib/partnerPool";
import { PACKS, ASSIGNED_STATUS } from "../../lib/partnerLeads";

export const LEAD_TONE = { assigned: C.textMute, contacted: C.accent, visit: C.gold, closed: "#15803D", not_interested: C.coral };

/** The Partners table cell: how many, how many nobody has called yet, and the closed ones. */
export function LeadCountCell({ s, onOpen }) {
  if (!s || !s.total) return <span className="crm-mute">{s?.own ? `${s.own} own` : "—"}</span>;
  return (
    <button type="button" onClick={onOpen} title="See every lead and where it stands"
      style={{ background: "none", border: 0, padding: 0, font: "inherit", textAlign: "left", cursor: "pointer", color: C.text }}>
      <b>{s.total}</b>
      <div style={{ fontSize: 10.5 }}>
        {s.untouched > 0 && <span style={{ color: C.coral, fontWeight: 700 }}>{s.untouched} not called · </span>}
        <span className="crm-mute">{s.closed} closed{s.own ? ` · ${s.own} own` : ""}</span>
      </div>
    </button>
  );
}

export default function CrmPartnerLeads({ partner, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetchCrmPartnerLeads(partner.user_id).then(setRows, (e) => setErr(e?.message || "Could not load the leads.")); }, [partner.user_id]);
  const cell = { padding: "8px 8px", borderBottom: `1px solid ${C.lineSoft}`, fontSize: 12.5, verticalAlign: "top" };
  const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 11.5, textAlign: "left", background: C.surface };
  return (
    <div role="dialog" aria-modal="true" aria-label={`${partner.name}'s leads`} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,34,30,.45)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg, borderRadius: 12, width: "min(900px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>{partner.name}&apos;s MovEazy leads{rows ? ` · ${rows.length}` : ""}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: 0, cursor: "pointer", color: C.textDim }}><X size={18} /></button>
        </div>
        {err ? <Empty>{err}</Empty> : !rows ? <Loading /> : rows.length === 0 ? <Empty>No MovEazy leads yet.</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Tenant</th><th style={th}>From</th><th style={th}>Status</th><th style={th}>Partner reached out</th><th style={th}>Given</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td style={cell}><b>{l.name || "—"}</b><br /><span style={{ color: C.textMute }}>{l.phone}</span></td>
                  <td style={cell}>{PACKS[l.pack]?.title || l.pack}</td>
                  <td style={cell}>
                    <span style={{ color: LEAD_TONE[l.status] || C.text, fontWeight: 700 }}>{ASSIGNED_STATUS[l.status] || l.status}</span>
                    {l.status === "closed" && <div className="crm-mute" style={{ fontSize: 11 }}>{inr(l.closed_rent)} rent{Number(l.due_amount) > 0 ? ` · ${inr(l.due_amount)} due` : ""}</div>}
                  </td>
                  <td style={cell}>{l.reach_count ? <>{l.reach_count}× · last {l.last_channel === "whatsapp" ? "WhatsApp" : "call"} {relTime(l.last_reach_at)}</>
                    : <span style={{ color: C.coral, fontWeight: 600 }}>Not yet</span>}</td>
                  <td style={cell}>{relTime(l.assigned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
