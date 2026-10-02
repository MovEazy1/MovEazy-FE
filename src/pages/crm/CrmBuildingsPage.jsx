/**
 * CRM → Owner QR. Every building an owner has put on MovEazy with a QR, the
 * partner broker MovEazy assigns to it, its funnel, and every visit request
 * its QR brought in — with the tenant's number, which the owner never sees
 * (crm_buildings / crm_building_assign_broker in owner_buildings.sql).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, C, Chip, Empty, Loading, relTime } from "./crmUi";
import {
  VISIT_STATUS, assignBuildingBroker, buildingUrl, fetchCrmBuildings, floorLabel, updateBuildingLead, visitWhen,
} from "../../lib/buildings";
import { inr, waLink } from "../../lib/partners";

const STATUSES = Object.keys(VISIT_STATUS);
const TONE = { amber: C.gold, blue: "#3B82F6", green: "#10B981", grey: C.textMute, champ: C.gold };

export default function CrmBuildingsPage() {
  const [tab, setTab] = useState("visits");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [only, setOnly] = useState("");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    try { setData(await fetchCrmBuildings()); setErr(""); } catch (e) { setErr(e?.message || "Could not load buildings."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map((data?.buildings ?? []).map((b) => [b.id, b])), [data]);
  const unassigned = (data?.buildings ?? []).filter((b) => !b.broker_id).length;
  const visits = (data?.leads ?? []).filter((l) => (!only || l.building_id === only)
    && (status === "all" || (status === "open" ? ["new", "confirmed"].includes(l.status) : l.status === status))
    && (!q.trim() || `${l.name} ${l.phone} ${byId.get(l.building_id)?.name}`.toLowerCase().includes(q.trim().toLowerCase())));

  const run = async (key, fn) => {
    setSaving(key);
    try { await fn(); await load(); } catch (e) { window.alert(e?.message || "Could not save that."); } finally { setSaving(""); }
  };

  const cell = { padding: "10px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top", fontSize: 13 };
  const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 12, textAlign: "left", background: C.surface };

  return (
    <div style={{ padding: 20, maxWidth: 1240 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: C.text }}>Owner QR</h1>
      <p style={{ margin: "0 0 14px", color: C.textDim, fontSize: 13 }}>
        Owners' buildings with a QR poster. Tenants who scan see every flat and ask for a visit; the request goes to the partner assigned here and to this list.
        Owners only ever see counts and first names.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Chip on={tab === "visits"} onClick={() => setTab("visits")}>Visit requests {data ? `(${data.leads.filter((l) => ["new", "confirmed"].includes(l.status)).length} open)` : ""}</Chip>
        <Chip on={tab === "buildings"} onClick={() => setTab("buildings")}>Buildings {data ? `(${data.buildings.length}${unassigned ? ` · ${unassigned} need a partner` : ""})` : ""}</Chip>
        <Btn sm onClick={load}>Refresh</Btn>
      </div>
      {err && <Empty>{err}</Empty>}
      {!data ? (!err && <Loading />) : tab === "buildings" ? (
        data.buildings.length === 0 ? <Empty>No owner has made a building yet.</Empty> : (
          <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Building</th><th style={th}>Owner</th><th style={th}>Partner</th><th style={th}>Flats</th>
                <th style={th}>Scans → mobiles → visits → done → booked</th><th style={th}>Added</th>
              </tr></thead>
              <tbody>
                {data.buildings.map((b) => {
                  const s = b.stats || {};
                  return (
                    <tr key={b.id}>
                      <td style={cell}>
                        <b>{b.name}</b> {b.status === "paused" && <span style={{ color: C.coral }}>(paused)</span>}<br />
                        <span style={{ color: C.textMute }}>{[b.area, b.landmark].filter(Boolean).join(" · ")}</span><br />
                        <a href={buildingUrl(b.code)} target="_blank" rel="noreferrer" style={{ color: C.gold }}>/building/{b.code}</a>
                      </td>
                      <td style={cell}>{b.owner?.name || "—"}<br />
                        {b.owner?.phone && <a href={waLink(b.owner.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa }}>{b.owner.phone}</a>}</td>
                      <td style={cell}>
                        <select className="crm-input" value={b.broker_id || ""} disabled={saving === b.id} style={{ minWidth: 190 }}
                          onChange={(e) => run(b.id, () => assignBuildingBroker(b.id, e.target.value || null))} aria-label={`Partner for ${b.name}`}>
                          <option value="">— Assign a partner —</option>
                          {data.partners.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}{p.agency ? ` · ${p.agency}` : ""}</option>)}
                        </select>
                        {!b.broker_id && <div style={{ color: C.coral, fontSize: 12, marginTop: 4 }}>Requests wait here until assigned</div>}
                      </td>
                      <td style={cell}>{(b.flats ?? []).filter((f) => f.available).length} free / {(b.flats ?? []).length}</td>
                      <td style={cell}><b>{s.scans ?? 0}</b> → <b>{s.numbers ?? 0}</b> → <b>{s.scheduled ?? 0}</b> → <b>{s.visited ?? 0}</b> → <b style={{ color: C.gold }}>{s.booked ?? 0}</b>
                        <br /><span style={{ color: C.textMute }}>{s.visitors ?? 0} opened · {s.upcoming ?? 0} upcoming</span></td>
                      <td style={cell}>{relTime(b.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select className="crm-input" value={only} onChange={(e) => setOnly(e.target.value)} style={{ minWidth: 200 }} aria-label="Building">
              <option value="">Every building</option>
              {data.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="crm-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="open">Open (new + confirmed)</option>
              <option value="all">Everything</option>
              {STATUSES.map((k) => <option key={k} value={k}>{VISIT_STATUS[k].label}</option>)}
            </select>
            <input className="crm-input" placeholder="Search name, mobile, building" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
          </div>
          {visits.length === 0 ? <Empty>No visit requests here.</Empty> : (
            <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Tenant</th><th style={th}>Building · flats</th><th style={th}>Visit</th><th style={th}>Partner</th><th style={th}>Status</th><th style={th}>Asked</th>
                </tr></thead>
                <tbody>
                  {visits.map((l) => {
                    const b = byId.get(l.building_id);
                    const flats = (l.property_ids ?? []).map((pid) => (b?.flats ?? []).find((f) => f.property_id === pid)).filter(Boolean);
                    const st = VISIT_STATUS[l.status] || VISIT_STATUS.new;
                    return (
                      <tr key={l.id}>
                        <td style={cell}><b>{l.name}</b><br /><a href={waLink(l.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa }}>{l.phone}</a>
                          {l.note && <><br /><i style={{ color: C.textDim }}>“{l.note}”</i></>}</td>
                        <td style={cell}>{b?.name || "—"}<br /><span style={{ color: C.textMute }}>
                          {flats.length ? flats.map((f) => `${f.flat_type || "Flat"} ${floorLabel(f.floor_number).replace(" floor", "")} ${f.rent ? inr(f.rent) : ""}`).join(", ") : "Any flat"}</span></td>
                        <td style={cell}>{visitWhen(l.visit_at)}
                          <br /><input type="datetime-local" className="crm-input" style={{ marginTop: 4, fontSize: 12 }} aria-label="Set visit time"
                            onChange={(e) => e.target.value && run(l.id, () => updateBuildingLead(l.id, { status: "confirmed", visit_at: new Date(e.target.value).toISOString() }))} /></td>
                        <td style={cell}>{b?.broker?.name || <span style={{ color: C.coral }}>Unassigned</span>}<br /><span style={{ color: C.textMute }}>{b?.broker?.phone}</span></td>
                        <td style={cell}>
                          <span style={{ color: TONE[st.tone] || C.text, fontWeight: 600 }}>{st.label}</span>
                          {l.booked_property && <><br /><span style={{ color: C.textMute }}>{l.booked_property}</span></>}
                          <br /><select className="crm-input" value="" disabled={saving === l.id} style={{ marginTop: 4, fontSize: 12 }} aria-label="Change status"
                            onChange={(e) => {
                              const next = e.target.value;
                              if (!next) return;
                              if (next === "booked") {
                                const options = (b?.flats ?? []).filter((f) => f.available || l.property_ids?.includes(f.property_id));
                                const pick = flats.length === 1 ? flats[0].property_id
                                  : window.prompt(`Which flat was booked?\n${options.map((f) => `${f.property_id} — ${f.flat_type} ${floorLabel(f.floor_number)}`).join("\n")}`, options[0]?.property_id || "");
                                if (!pick) return;
                                run(l.id, () => updateBuildingLead(l.id, { status: "booked", booked_property: pick.trim().toUpperCase() }));
                              } else run(l.id, () => updateBuildingLead(l.id, { status: next }));
                            }}>
                            <option value="">Change…</option>
                            {STATUSES.filter((k) => k !== l.status).map((k) => <option key={k} value={k}>{VISIT_STATUS[k].label}</option>)}
                          </select>
                          {l.updated_by && <div style={{ color: C.textMute, fontSize: 11, marginTop: 2 }}>last by {l.updated_by}</div>}
                        </td>
                        <td style={cell}>{relTime(l.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
