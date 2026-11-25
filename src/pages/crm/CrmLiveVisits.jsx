/**
 * CRM → Visits → Partner visits (partner_live_visits.sql): give a visit to a
 * partner — a booked one, or one set up here — and follow it: Assigned →
 * Meeting spot shared → Tenant on the way → Visit done, with both answers, and
 * a live map of both while it's on.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useCityFilter } from "./crmCityFilter";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Map as MapIcon } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, inr } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import { SCOPES } from "../../lib/adminScopes";
import {
  VISIT_STATUS, cancelCrmLiveVisit, distanceText, fetchCrmLiveVisits, fetchPartnerPicker, metresBetween, saveCrmLiveVisit, seenAgo, visitTime,
} from "../../lib/liveVisits";

const LiveVisitMap = lazy(() => import("../../components/LiveVisitMap"));

const answerText = (a) => (!a?.liked ? "—" : a.liked === "liked" ? `Liked${a.liked_status ? ` · ${a.liked_status.replace(/_/g, " ")}` : ""}` : `Didn't like${(a.reasons ?? []).length ? ` · ${a.reasons.join(", ").replace(/_/g, " ")}` : ""}`);
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function NewVisitForm({ partners, onSaved, onCancel, say, preset = null }) {
  const { activeClients, clients, inventory } = useCrm();
  const [f, setF] = useState(() => ({
    id: preset?.id || "", booking_id: preset?.booking_id || "", client_id: preset?.client?.id || "", property_id: preset?.flat?.property_id || "",
    visit_at: toLocalInput(preset?.visit_at), broker_id: "",
  }));
  const [cq, setCq] = useState("");
  const [pq, setPq] = useState("");
  const [busy, setBusy] = useState(false);
  const clientHits = useMemo(() => {
    const n = cq.trim().toLowerCase();
    if (!n) return [];
    return (clients ?? activeClients ?? []).filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(n)).slice(0, 8);
  }, [cq, clients, activeClients]);
  const flatHits = useMemo(() => {
    const n = pq.trim().toLowerCase();
    if (!n) return [];
    return (inventory ?? []).filter((i) => i.status === "published" && `${i.property_id} ${i.title} ${i.area}`.toLowerCase().includes(n)).slice(0, 8);
  }, [pq, inventory]);
  const client = (clients ?? []).find((c) => c.id === f.client_id) || preset?.client;
  const flat = (inventory ?? []).find((i) => i.property_id === f.property_id) || preset?.flat;
  const save = async () => {
    setBusy(true);
    try {
      await saveCrmLiveVisit({ ...f, visit_at: f.visit_at ? new Date(f.visit_at).toISOString() : null });
      say("Visit given to the partner — they've been told");
      onSaved();
    } catch (e) { say(e?.message || "Couldn't save", "error"); } finally { setBusy(false); }
  };
  const row = { display: "grid", gap: 4 };
  return (
    <div style={{ border: `1px solid ${C.accent}`, borderRadius: 10, padding: 10, display: "grid", gap: 8, background: C.bg }}>
      <b style={{ fontSize: 13 }}>{preset?.id ? "Change the partner" : preset ? "Assign a partner to this visit" : "New visit"}</b>
      {!preset && (
        <div style={row}>
          <span className="crm-label">Client</span>
          {client ? <span style={{ fontSize: 12.5 }}>{client.name || "—"} · {formatForDisplay(client.phone)} <Btn sm onClick={() => setF({ ...f, client_id: "" })}>Change</Btn></span> : (
            <>
              <input className="crm-input" placeholder="Search name or phone" value={cq} onChange={(e) => setCq(e.target.value)} aria-label="Search client" />
              {clientHits.map((c) => <Btn key={c.id} sm onClick={() => { setF({ ...f, client_id: c.id }); setCq(""); }}>{c.name || "—"} · {formatForDisplay(c.phone)}</Btn>)}
            </>
          )}
        </div>
      )}
      {!preset && (
        <div style={row}>
          <span className="crm-label">Flat</span>
          {flat ? <span style={{ fontSize: 12.5 }}>{flat.title || flat.property_id} · {flat.area} <Btn sm onClick={() => setF({ ...f, property_id: "" })}>Change</Btn></span> : (
            <>
              <input className="crm-input" placeholder="Search flat id, title or area" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Search flat" />
              {flatHits.map((i) => <Btn key={i.property_id} sm onClick={() => { setF({ ...f, property_id: i.property_id }); setPq(""); }}>{i.property_id} · {i.title || i.flat_type} · {i.area}{i.rent ? ` · ${inr(i.rent)}` : ""}</Btn>)}
            </>
          )}
        </div>
      )}
      {preset && <span style={{ fontSize: 12.5 }}>{preset.client?.name || "Tenant"} · {preset.flat?.title} · {visitTime(preset.visit_at)}</span>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...row, flex: "1 1 180px" }}><span className="crm-label">Date &amp; time</span>
          <input type="datetime-local" className="crm-input" value={f.visit_at} onChange={(e) => setF({ ...f, visit_at: e.target.value })} />
        </label>
        <label style={{ ...row, flex: "1 1 220px" }}><span className="crm-label">Partner</span>
          <select className="crm-input" value={f.broker_id} onChange={(e) => setF({ ...f, broker_id: e.target.value })}>
            <option value="">Pick a partner…</option>
            {partners.map((p) => <option key={p.broker_id} value={p.broker_id}>{p.name}{p.agency ? ` · ${p.agency}` : ""}{(p.areas ?? []).length ? ` · ${p.areas.slice(0, 2).join(", ")}` : ""}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="primary" disabled={busy || !f.broker_id || (!preset && (!f.client_id || !f.property_id))} onClick={save}>{busy ? "Saving…" : "Give to partner"}</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

export default function CrmLiveVisits({ say }) {
  const { access } = useCrm();
  const [open, setOpen] = useState(true);
  const [rawD, setD] = useState(null);
  const [rawPartners, setPartners] = useState([]);
  // Visits to flats of the city the CRM is showing, and its partners (multi_city.sql).
  const cf = useCityFilter();
  const fid = (v) => v?.flat?.property_id || v?.property_id;
  const d = useMemo(() => rawD && {
    ...rawD,
    visits: (rawD.visits ?? []).filter((v) => !fid(v) || cf.flat(fid(v))),
    unassigned: (rawD.unassigned ?? []).filter((v) => !fid(v) || cf.flat(fid(v))),
  }, [rawD, cf]);
  const partners = useMemo(() => rawPartners.filter((p) => cf.partner(p.broker_id)), [rawPartners, cf]);
  const [adding, setAdding] = useState(null); // "new" | a booking
  const [mapFor, setMapFor] = useState(null);
  const [show, setShow] = useState("open");
  const load = useCallback(() => fetchCrmLiveVisits().then(setD, () => setD({ visits: [], unassigned: [] })), []);
  const live = (d?.visits ?? []).some((v) => v.live);
  useEffect(() => { load(); const t = setInterval(load, live ? 20000 : 90000); return () => clearInterval(t); }, [load, live]);
  useEffect(() => { fetchPartnerPicker().then(setPartners, () => {}); }, []);

  const visits = (d?.visits ?? []).filter((v) => (show === "open" ? ["assigned", "shared", "coming"].includes(v.status) : show === "done" ? v.status === "done" : true));
  const counts = {
    live: (d?.visits ?? []).filter((v) => v.live).length,
    open: (d?.visits ?? []).filter((v) => ["assigned", "shared", "coming"].includes(v.status)).length,
    unassigned: (d?.unassigned ?? []).length,
  };
  const cancel = async (v) => {
    if (!window.confirm(`Cancel this visit with ${v.partner?.name}? They'll be told.`)) return;
    try { await cancelCrmLiveVisit(v.id); say("Visit cancelled"); load(); } catch (e) { say(e?.message || "Couldn't cancel", "error"); }
  };
  const mapVisit = mapFor ? (d?.visits ?? []).find((v) => v.id === mapFor) : null;

  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, background: C.surface, flex: "none", maxHeight: open ? "55vh" : undefined, overflowY: "auto" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", border: 0, background: "none", font: "inherit", cursor: "pointer", textAlign: "left" }}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <b style={{ fontSize: 13 }}>Partner visits</b>
        <span className="crm-mute" style={{ fontSize: 12 }}>
          {counts.open} open{counts.live ? ` · ${counts.live} live now` : ""}{counts.unassigned ? ` · ${counts.unassigned} booked without a partner` : ""}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {access.has(SCOPES.CLIENTS_WRITE) && <Btn sm variant="primary" onClick={() => setAdding("new")}>+ New visit</Btn>}
            <Chip on={show === "open"} onClick={() => setShow("open")}>Open · {counts.open}</Chip>
            <Chip on={show === "done"} onClick={() => setShow("done")}>Done</Chip>
            <Chip on={show === "all"} onClick={() => setShow("all")}>All</Chip>
          </div>
          {adding && <NewVisitForm partners={partners} preset={adding === "new" ? null : adding} say={say}
            onCancel={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />}

          {(d?.unassigned ?? []).length > 0 && (
            <div style={{ display: "grid", gap: 4 }}>
              <span className="crm-label">Booked — no partner yet</span>
              {d.unassigned.map((b) => (
                <div key={b.booking_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, padding: "6px 8px", background: C.bg, border: `1px solid ${C.lineSoft}`, borderRadius: 8 }}>
                  <span style={{ flex: 1, minWidth: 0 }}><b>{b.client?.name || "Tenant"}</b> · {b.flat?.title} · {visitTime(b.visit_at)}</span>
                  <Btn sm onClick={() => setAdding(b)}>Assign partner</Btn>
                </div>
              ))}
            </div>
          )}

          {d === null ? <span className="crm-mute" style={{ fontSize: 12 }}>Loading…</span> : visits.length === 0 ? <Empty pad={14}>No partner visits here.</Empty> : visits.map((v) => {
            const st = VISIT_STATUS[v.status] || VISIT_STATUS.assigned;
            const times = [v.shared_at && `spot ${visitTime(v.shared_at)}`, v.coming_at && `coming ${visitTime(v.coming_at)}`, v.done_at && `done ${visitTime(v.done_at)}`].filter(Boolean).join(" · ");
            const gap = v.live && v.broker_loc && v.tenant_loc ? metresBetween(v.broker_loc, v.tenant_loc) : null;
            return (
              <div key={v.id} style={{ background: C.bg, border: `1px solid ${v.live ? st.tone : C.lineSoft}`, borderRadius: 10, padding: "8px 10px", display: "grid", gap: 4, fontSize: 12.5 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <b style={{ color: st.tone }}>{v.live ? "Live · " : ""}{st.label}</b>
                  <span><Link to={`/crm/clients?client=${v.client?.id}`} style={{ color: C.text, fontWeight: 700 }}>{v.client?.name || "Tenant"}</Link> → {v.partner?.name}</span>
                  <span className="crm-mute">{v.flat?.title} · {visitTime(v.visit_at)}</span>
                  <span style={{ flex: 1 }} />
                  {v.meet && <Btn sm onClick={() => setMapFor(mapFor === v.id ? null : v.id)}><MapIcon size={12} /> {v.live ? "Live map" : "Map"}</Btn>}
                  {["assigned", "shared", "coming"].includes(v.status) && <Btn sm onClick={() => setAdding({ ...v, booking_id: v.booking_id, id: v.id })}>Change partner</Btn>}
                  {["assigned", "shared", "coming"].includes(v.status) && <Btn sm variant="danger" onClick={() => cancel(v)}>Cancel</Btn>}
                </div>
                {times && <span className="crm-mute">{times}</span>}
                {v.live && (
                  <span className="crm-mute">
                    {v.tenant_loc ? `Tenant seen ${seenAgo(v.tenant_loc.at)}` : "Tenant location not in yet"} · {v.broker_loc ? `partner seen ${seenAgo(v.broker_loc.at)}` : "partner location not in yet"}
                    {gap != null ? ` · ${distanceText(gap)} apart` : ""}
                  </span>
                )}
                {(v.partner_answer || v.tenant_answer) && (
                  <span>Partner said: <b>{answerText(v.partner_answer)}</b> · Tenant said: <b>{answerText(v.tenant_answer)}</b></span>
                )}
                {mapFor === v.id && mapVisit && (
                  <Suspense fallback={null}>
                    <LiveVisitMap flat={v.flat} meet={mapVisit.meet} partner={mapVisit.broker_loc} tenant={mapVisit.tenant_loc}
                      partnerLabel={String(v.partner?.name || "Partner").split(" ")[0]} tenantLabel={String(v.client?.name || "Tenant").split(" ")[0]} height={280} />
                  </Suspense>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
