/**
 * CRM → App analytics. Partners on partners.moveazy.co.in and owners on
 * owners.moveazy.co.in: who they are, when they last signed in, how long they
 * spend, and every button they pressed, session by session, with the time
 * (app_analytics.sql; the taps come from lib/appAnalytics.js).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Loading, relTime } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { fetchAppPeople, fetchAppSessions } from "../../lib/appAnalytics";
import { formatDuration } from "../../lib/sessionSync";
import { waLink } from "../../lib/partners";

const APPS = [
  { id: "partner", label: "Partners", host: "partners.moveazy.co.in" },
  { id: "owner", label: "Owners", host: "owners.moveazy.co.in" },
];
const SORTS = [
  { id: "seen", label: "Last seen", by: (p) => (p.last_seen ? new Date(p.last_seen).getTime() : 0) },
  { id: "time", label: "Most time spent", by: (p) => Number(p.seconds) || 0 },
  { id: "taps", label: "Most taps", by: (p) => Number(p.clicks) || 0 },
  { id: "login", label: "Last sign-in", by: (p) => (p.last_login ? new Date(p.last_login).getTime() : 0) },
  { id: "joined", label: "Newest", by: (p) => (p.joined ? new Date(p.joined).getTime() : 0) },
];
const STATUS_COLOR = { approved: C.accent, pending: C.gold, suspended: C.coral };

const dateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const clock = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function CrmAppAnalyticsPage() {
  const { access } = useCrm();
  const [app, setApp] = useState("partner");
  const [people, setPeople] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("seen");
  const [pick, setPick] = useState(null);

  const load = useCallback(async () => {
    setPeople(null);
    setErr("");
    try { setPeople(await fetchAppPeople(app)); } catch (e) { setPeople([]); setErr(e?.message || "Could not load analytics."); }
  }, [app]);
  useEffect(() => { load(); setPick(null); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const by = (SORTS.find((s) => s.id === sort) || SORTS[0]).by;
    return (people ?? [])
      .filter((p) => !needle || [p.name, p.phone, p.email, p.agency].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => by(b) - by(a));
  }, [people, q, sort]);

  const totals = useMemo(() => {
    const list = people ?? [];
    return {
      active: list.filter((p) => Number(p.sessions_7d) > 0).length,
      seconds: list.reduce((n, p) => n + (Number(p.seconds_7d) || 0), 0),
      sessions: list.reduce((n, p) => n + (Number(p.sessions_7d) || 0), 0),
      taps: list.reduce((n, p) => n + (Number(p.clicks) || 0), 0),
    };
  }, [people]);

  if (!access.has(SCOPES.ANALYTICS_READ)) return <Empty>You don't have access to dashboards.</Empty>;
  const meta = APPS.find((a) => a.id === app);
  const cell = { padding: "9px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top", fontSize: 12.5 };
  const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 11.5, textAlign: "left", background: C.surface, position: "sticky", top: 0 };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1, overflow: "auto" }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, color: C.text }}>App analytics</h1>
        <p style={{ margin: 0, color: C.textDim, fontSize: 13, maxWidth: 900 }}>
          Who uses the partner and owner apps: their details, last sign-in, time spent, and every button they pressed in each session, with the time.
          Taps are recorded from 3 Oct 2026; nothing anyone types is recorded, and numbers on buttons are masked.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {APPS.map((a) => <Chip key={a.id} on={app === a.id} onClick={() => setApp(a.id)}>{a.label}{app === a.id && people ? ` (${people.length})` : ""}</Chip>)}
        <input className="crm-input" placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <select className="crm-input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <Btn sm onClick={load}>Refresh</Btn>
        <span style={{ color: C.textMute, fontSize: 12 }}>{meta.host}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, maxWidth: 900 }}>
        {[
          ["Active in the last 7 days", `${totals.active} of ${(people ?? []).length}`],
          ["Time spent, 7 days", formatDuration(totals.seconds)],
          ["Sessions, 7 days", totals.sessions],
          ["Taps recorded", totals.taps],
        ].map(([k, v]) => (
          <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", background: C.surface }}>
            <div style={{ fontSize: 11.5, color: C.textMute }}>{k}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.text }}>{people ? v : "…"}</div>
          </div>
        ))}
      </div>

      {err && <Empty>{err}</Empty>}
      {!people ? <Loading /> : shown.length === 0 ? <Empty>{people.length ? "Nobody matches." : `No ${meta.label.toLowerCase()} yet.`}</Empty> : (
        <div style={{ display: "grid", gridTemplateColumns: pick ? "minmax(0, 1.25fr) minmax(320px, 1fr)" : "1fr", gap: 14, alignItems: "start" }}>
          <div style={{ overflow: "auto", border: `1px solid ${C.line}`, borderRadius: 10, maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>{app === "partner" ? "Partner" : "Owner"}</th><th style={th}>Status</th><th style={th}>Last sign-in</th>
                <th style={th}>Last seen</th><th style={th}>Time spent</th><th style={th}>Sessions</th><th style={th}>Taps</th>
              </tr></thead>
              <tbody>
                {shown.map((p) => {
                  const on = pick?.user_id === p.user_id;
                  return (
                    <tr key={p.user_id} onClick={() => setPick(on ? null : p)} style={{ cursor: "pointer", background: on ? C.accentSoft : undefined }}>
                      <td style={cell}>
                        <b style={{ color: C.text }}>{p.name || p.email || "—"}</b>{p.agency ? <span style={{ color: C.textMute }}> · {p.agency}</span> : null}<br />
                        <span style={{ color: C.textMute }}>{[p.phone, p.email].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td style={{ ...cell, color: STATUS_COLOR[p.status] || C.textDim, fontWeight: 600, textTransform: "capitalize" }}>{p.status}</td>
                      <td style={cell} title={dateTime(p.last_login)}>{relTime(p.last_login)}</td>
                      <td style={cell} title={dateTime(p.last_seen)}>{p.last_seen ? relTime(p.last_seen) : <span style={{ color: C.textMute }}>Not yet</span>}</td>
                      <td style={cell}><b>{formatDuration(p.seconds)}</b><br /><span style={{ color: C.textMute }}>{formatDuration(p.seconds_7d)} this week</span></td>
                      <td style={cell}>{p.sessions}<br /><span style={{ color: C.textMute }}>{p.sessions_7d} this week</span></td>
                      <td style={cell}>{p.clicks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pick && <PersonPanel key={`${app}-${pick.user_id}`} app={app} person={pick} onClose={() => setPick(null)} />}
        </div>
      )}
    </div>
  );
}

function PersonPanel({ app, person, onClose }) {
  const [sessions, setSessions] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => {
    let live = true;
    fetchAppSessions(app, person.user_id).then(
      (s) => { if (live) { setSessions(s); setOpen(new Set(s[0] ? [s[0].session_key] : [])); } },
      (e) => { if (live) { setSessions([]); setErr(e?.message || "Could not load sessions."); } },
    );
    return () => { live = false; };
  }, [app, person.user_id]);

  const toggle = (k) => setOpen((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.bg, maxHeight: "70vh", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{person.name || person.email}</div>
          <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2 }}>
            {person.agency ? `${person.agency} · ` : ""}{person.phone && <a href={waLink(person.phone, "")} target="_blank" rel="noreferrer" style={{ color: C.wa }}>{person.phone}</a>}
            {person.email ? ` · ${person.email}` : ""}
          </div>
          <div style={{ fontSize: 12, color: C.textMute, marginTop: 4 }}>
            Joined {dateTime(person.joined)} · last sign-in {dateTime(person.last_login)} · {formatDuration(person.seconds)} in {person.sessions} session{person.sessions === 1 ? "" : "s"}
          </div>
        </div>
        <Btn sm onClick={onClose} aria-label="Close">×</Btn>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMute, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 6px" }}>Sessions</div>
      {err && <Empty pad={16}>{err}</Empty>}
      {!sessions ? <Loading /> : sessions.length === 0 ? <Empty pad={16}>No sessions recorded yet.</Empty> : sessions.map((s) => {
        const isOpen = open.has(s.session_key);
        return (
          <div key={s.session_key} style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 8, marginBottom: 8 }}>
            <button type="button" onClick={() => toggle(s.session_key)} aria-expanded={isOpen}
              style={{ width: "100%", display: "flex", gap: 8, alignItems: "baseline", padding: "8px 10px", border: 0, background: isOpen ? C.surface : "transparent", cursor: "pointer", font: "inherit", textAlign: "left" }}>
              <b style={{ fontSize: 13, color: C.text }}>{dateTime(s.started_at)}</b>
              <span style={{ fontSize: 12, color: C.textDim }}>{formatDuration(s.seconds)} · {s.clicks} tap{s.clicks === 1 ? "" : "s"}{s.device ? ` · ${s.device}` : ""}</span>
              <span style={{ marginLeft: "auto", color: C.textMute }}>{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <div style={{ padding: "2px 10px 8px" }}>
                {(s.events ?? []).length === 0 ? <div style={{ fontSize: 12, color: C.textMute, padding: "6px 0" }}>No taps recorded in this session.</div> : s.events.map((e, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: 8, padding: "4px 0", borderTop: i ? `1px solid ${C.lineSoft}` : 0, fontSize: 12.5 }}>
                    <span className="crm-num" style={{ color: C.textMute }}>{clock(e.at)}</span>
                    {e.kind === "page" ? (
                      <span style={{ color: C.textDim }}>Opened <b style={{ fontWeight: 600 }}>{e.label || e.path}</b></span>
                    ) : (
                      <span><span style={{ color: C.textMute, fontSize: 11 }}>{e.target || "button"} · </span><b style={{ color: C.text, fontWeight: 600 }}>{e.label}</b>
                        {e.path && <span style={{ color: C.textMute }}> on {e.path}</span>}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
