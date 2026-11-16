/**
 * CRM → Society leads (society_partners.sql): every tenant who asked for flats
 * in a live society, the partner it went to, and everything since — the
 * partner moves it along in their app (called → visit set → visit done →
 * closed / lost) and each step lands here. A lead nobody has called 30
 * minutes after asking is flagged.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { Btn, C, Chip, Empty, Loading, relTime } from "./crmUi";
import { LEAD_STAGES, fetchCrmSocietyLeads, stageLabel } from "../../lib/societyPartners";
import { formatForDisplay } from "../../lib/mobile";

const OVERDUE_MIN = 30;
const TONE = { new: "#B45309", called: "#1D4ED8", visit_set: "#7C3AED", visit_done: "#0E7C68", closed: "#059669", lost: "#6B7280" };
const overdue = (l, now) => l.stage === "new" && now - new Date(l.created_at).getTime() > OVERDUE_MIN * 60000;

export default function CrmSocietyLeadsPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(() => fetchCrmSocietyLeads().then((r) => { setRows(r); setErr(""); }, (e) => setErr(e?.message || "Couldn't load the leads.")), []);
  useEffect(() => { load(); const t = setInterval(() => { setNow(Date.now()); load(); }, 60000); return () => clearInterval(t); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((l) => (stage === "all" ? true : stage === "open" ? !["closed", "lost"].includes(l.stage) : stage === "late" ? overdue(l, now) : l.stage === stage)
      && (!needle || `${l.name} ${l.phone} ${l.society} ${l.partner}`.toLowerCase().includes(needle)));
  }, [rows, stage, q, now]);
  const count = (pred) => (rows ?? []).filter(pred).length;

  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 1100 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Society leads</h1>
          <p style={{ color: C.textDim, fontSize: 13.5, margin: 0, maxWidth: "80ch", lineHeight: 1.6 }}>
            Tenants who tapped Get flats on a live society&apos;s page. Each goes to the partner who onboarded that society on WhatsApp;
            the partner updates it in their app. Flagged when nobody has called within {OVERDUE_MIN} minutes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Chip on={stage === "open"} onClick={() => setStage("open")}>Open · {count((l) => !["closed", "lost"].includes(l.stage))}</Chip>
          <Chip on={stage === "late"} onClick={() => setStage("late")} style={count((l) => overdue(l, now)) ? { color: "#B91C1C" } : undefined}>
            Not called in {OVERDUE_MIN} min · {count((l) => overdue(l, now))}
          </Chip>
          {LEAD_STAGES.map((s) => <Chip key={s.id} on={stage === s.id} onClick={() => setStage(s.id)}>{s.label} · {count((l) => l.stage === s.id)}</Chip>)}
          <Chip on={stage === "all"} onClick={() => setStage("all")}>All · {count(() => true)}</Chip>
          <input className="crm-input" style={{ flex: "1 1 200px", maxWidth: 280 }} placeholder="Search tenant, society, partner" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search society leads" />
        </div>
        {err ? <Empty>{err}</Empty> : rows === null ? <Loading /> : shown.length === 0 ? <Empty>No society leads here yet.</Empty> : (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            {shown.map((l, i) => {
              const late = overdue(l, now);
              return (
                <div key={l.id} style={{ borderTop: i ? `1px solid ${C.lineSoft}` : "none", background: late ? "#FEF2F2" : undefined }}>
                  <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)}
                    style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", padding: "10px 12px", border: 0, background: "none", font: "inherit", textAlign: "left", cursor: "pointer", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <b style={{ fontSize: 13.5 }}>{l.name || "Tenant"}</b> <span className="crm-mute crm-num" style={{ fontSize: 12 }}>{formatForDisplay(l.phone)}</span>
                      <span className="crm-mute" style={{ display: "block", fontSize: 12 }}>{l.society}{l.area ? ` · ${l.area}` : ""}</span>
                    </span>
                    <span style={{ flex: "0 1 200px", fontSize: 12.5 }}>
                      → <b>{l.partner}</b>
                      {l.partner_phone && <span className="crm-mute crm-num" style={{ display: "block", fontSize: 11.5 }}>{formatForDisplay(l.partner_phone)}</span>}
                    </span>
                    <span style={{ flex: "0 0 auto", textAlign: "right", fontSize: 12 }}>
                      <span style={{ color: TONE[l.stage], fontWeight: 800 }}>{stageLabel(l.stage)}</span>
                      <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
                        asked {relTime(l.created_at)}{late ? " · not called" : l.stage !== "new" ? ` · ${relTime(l.stage_at)}` : ""}
                      </span>
                    </span>
                  </button>
                  {open === l.id && (
                    <div style={{ padding: "0 12px 12px 12px", display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {l.client_id && <Link to={`/crm/clients?client=${l.client_id}`}><Btn sm>Open client</Btn></Link>}
                        <a href={`tel:+91${String(l.partner_phone || "").slice(-10)}`}><Btn sm><Phone size={12} /> Call partner</Btn></a>
                        <a href={`tel:+91${String(l.phone || "").slice(-10)}`}><Btn sm><Phone size={12} /> Call tenant</Btn></a>
                      </div>
                      <div style={{ borderLeft: `2px solid ${C.line}`, paddingLeft: 12, display: "grid", gap: 6 }}>
                        {(l.events ?? []).map((e, k) => (
                          <div key={k} style={{ fontSize: 12.5 }}>
                            <b style={{ color: TONE[e.kind] || C.text }}>{e.kind === "enquired" ? "Asked for flats" : stageLabel(e.kind)}</b>
                            <span className="crm-mute"> · {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {e.actor}</span>
                            {e.body && <div>{e.body}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
