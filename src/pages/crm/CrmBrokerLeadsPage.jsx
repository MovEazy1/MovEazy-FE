/**
 * CRM → Broker leads. Tenants that came through a partner broker (their
 * curated list or QR page) — unverified, attributed to that broker, and kept
 * out of MovEazy's own Clients list (crm_clients.attributed_to; see
 * partner_launch.sql § 8). Plus the sold-out flags brokers raised on group
 * listings, which MovEazy can confirm or reject (§ 9).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, C, Chip, Empty, Loading, inr, relTime } from "./crmUi";
import { decideSoldOut, fetchBrokerLeads, fetchSoldOutRequests } from "../../lib/partnerCurated";
import { waLink } from "../../lib/partners";

export default function CrmBrokerLeadsPage() {
  const [tab, setTab] = useState("leads");
  const [leads, setLeads] = useState(null);
  const [sold, setSold] = useState(null);
  const [broker, setBroker] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([fetchBrokerLeads(), fetchSoldOutRequests()]);
      setLeads(l);
      setSold(s);
      setErr("");
    } catch (e) {
      setErr(e?.message || "Could not load broker leads.");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const brokers = useMemo(() => {
    const m = new Map();
    for (const t of leads?.tenants ?? []) m.set(t.broker_id, t.broker || "Broker");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);
  const rows = (leads?.tenants ?? []).filter((t) => (!broker || t.broker_id === broker)
    && (!q.trim() || `${t.name} ${t.phone} ${t.broker}`.toLowerCase().includes(q.trim().toLowerCase())));
  const pending = (sold ?? []).filter((r) => r.status === "pending").length;

  const decide = async (r, approve) => {
    try {
      await decideSoldOut(r.property_id, approve);
      load();
    } catch (e) {
      window.alert(e?.message || "Could not update it.");
    }
  };

  const cell = { padding: "10px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top", fontSize: 13 };
  const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 12, textAlign: "left", background: C.surface };

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: C.text }}>Broker leads</h1>
      <p style={{ margin: "0 0 14px", color: C.textDim, fontSize: 13 }}>
        Tenants who came through a partner broker. They are the broker’s, not MovEazy’s: they never appear under Clients
        {leads ? ` (${leads.attributed_clients} sign-up${Number(leads.attributed_clients) === 1 ? "" : "s"} kept out so far)` : ""}.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Chip on={tab === "leads"} onClick={() => setTab("leads")}>Tenants via brokers {leads ? `(${leads.tenants.length})` : ""}</Chip>
        <Chip on={tab === "sold"} onClick={() => setTab("sold")}>Sold-out flags {pending ? `(${pending} to decide)` : ""}</Chip>
        <Btn sm onClick={load}>Refresh</Btn>
      </div>
      {err && <Empty>{err}</Empty>}

      {tab === "leads" && (!leads ? <Loading /> : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select value={broker} onChange={(e) => setBroker(e.target.value)} className="crm-input" style={{ minWidth: 200 }} aria-label="Filter by broker">
              <option value="">Every broker</option>
              {brokers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <input className="crm-input" placeholder="Search name, mobile, broker" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
          </div>
          {rows.length === 0 ? <Empty>No tenants from brokers yet.</Empty> : (
            <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Tenant</th><th style={th}>Broker</th><th style={th}>Came via</th><th style={th}>Likes</th><th style={th}>Status</th><th style={th}>Last seen</th></tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td style={cell}><b>{t.name || "—"}</b><br /><a href={waLink(t.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa }}>{t.phone}</a></td>
                      <td style={cell}>{t.broker}<br /><span style={{ color: C.textMute }}>{t.broker_agency || t.broker_phone}</span></td>
                      <td style={cell}>{t.source === "curated" ? "Curated list" : "QR page"}</td>
                      <td style={cell}>{t.likes}</td>
                      <td style={cell}><span style={{ color: C.gold, fontWeight: 600 }}>{t.status}</span></td>
                      <td style={cell}>{relTime(t.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ))}

      {tab === "sold" && (!sold ? <Loading /> : sold.length === 0 ? <Empty>No sold-out flags.</Empty> : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Listing</th><th style={th}>Flagged by</th><th style={th}>Listing broker</th><th style={th}>When</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>
              {sold.map((r) => (
                <tr key={r.id}>
                  <td style={cell}><b>{r.property_id}</b><br />{[r.flat_type, r.area, r.rent ? inr(r.rent) : ""].filter(Boolean).join(" · ")}{r.note ? <><br /><i>“{r.note}”</i></> : null}</td>
                  <td style={cell}>{r.by}<br /><span style={{ color: C.textMute }}>{r.by_phone}</span></td>
                  <td style={cell}>{r.lister || "MovEazy stock"}<br /><span style={{ color: C.textMute }}>{r.lister_phone}</span></td>
                  <td style={cell}>{relTime(r.created_at)}</td>
                  <td style={cell}>{r.status === "pending" ? <span style={{ color: C.coral, fontWeight: 600 }}>Potentially rented</span> : r.status === "approved" ? "Sold out" : "Still available"}{r.decided_by ? <><br /><span style={{ color: C.textMute }}>by {r.decided_by}</span></> : null}</td>
                  <td style={cell}>{r.status === "pending" && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Btn sm variant="primary" onClick={() => decide(r, true)}>Mark sold out</Btn>
                      <Btn sm onClick={() => decide(r, false)}>Still available</Btn>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
