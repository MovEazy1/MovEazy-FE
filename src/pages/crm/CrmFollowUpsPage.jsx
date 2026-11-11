/**
 * Follow-ups: the day's calls, for every active client (lib/followUps.js).
 *
 *   Overdue · Today · Upcoming   by their follow-up date, or 2 days since we
 *                                last reached them; hot ones (on the site in
 *                                the last day, moving in within 15 days) first.
 *   Quiet                        nothing for 7 days: keep (pick a date), Ice,
 *                                or close.
 *   Partners                     every client a partner has, SLA-coloured
 *                                (24h amber, 48h red, a missed follow-up),
 *                                reassign in a tap, and the scorecard with a
 *                                morning WhatsApp per partner.
 *
 * Everyone sees every client for now (Mine / Unassigned narrow it); each row
 * logs a call — outcome and next date — or assigns a partner.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ExternalLink, Flame, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { useCrm } from "./CrmShell";
import { AssignPartnerSheet, FollowUpActions } from "./FollowUpControls";
import { Btn, C, Chip, Empty, TempDot, Toast, relTime } from "./crmUi";
import { setClientStatus, setClientTemperature, statusLabel, tempColor } from "../../lib/crmClients";
import { moveInTs } from "../../lib/crmLeadBuckets";
import { whatsappUrl } from "../../lib/crmSettings";
import { brokerFollowUpMessage, logBrokerFollowUp } from "../../lib/tenantViews";
import { telLink } from "../../lib/partners";
import {
  SLA, fetchPartnerBoard, followUpState, isActive, isHotLead, lastContactByClient, outcomeLabel, partnerDueRows,
  partnerSummaryMessage,
} from "../../lib/followUps";

const TABS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "quiet", label: "Quiet 7d+" },
  { id: "partners", label: "Partners" },
];
const TONE = { coral: C.coral, gold: C.gold, accent: C.accent, mute: C.textMute };
const isToday = (ts, now) => ts && new Date(ts).toDateString() === new Date(now).toDateString();

function ClientRow({ r, now, onOpen, onToast, quiet, onQuiet }) {
  const c = r.c;
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 14px", borderBottom: `1px solid ${C.lineSoft}`, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {c.temperature && <TempDot color={tempColor(c.temperature)} />}
          <button type="button" onClick={() => onOpen(c.id)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: C.text }}>
            {c.name || "Unnamed"}
          </button>
          <span className="crm-mute crm-num" style={{ fontSize: 11.5 }}>{c.phone}</span>
          {r.hot && <span title={r.hotWhy} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: C.coral }}><Flame size={12} /> {r.hotWhy}</span>}
        </div>
        <div className="crm-mute" style={{ fontSize: 11.5, marginTop: 3, lineHeight: 1.5 }}>
          {[statusLabel(c.status), r.state.why, c.last_outcome ? `last: ${outcomeLabel(c.last_outcome)}${c.last_outcome_at ? ` ${relTime(c.last_outcome_at)}` : ""}` : "",
            c.assigned_to ? `owner ${c.assigned_to.split("@")[0]}` : ""].filter(Boolean).join(" · ")}
        </div>
        {c.follow_up_note && <div style={{ fontSize: 12, marginTop: 3, color: C.text }}>“{c.follow_up_note}”</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {c.phone && <a className="crm-btn crm-btn--call crm-btn--sm" href={telLink(c.phone)} title="Call"><Phone size={13} /></a>}
        {c.phone && <a className="crm-btn crm-btn--wa crm-btn--sm" href={whatsappUrl(c.phone, `Hi ${c.name?.split(" ")[0] || ""}, `)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={13} /></a>}
        {quiet ? (
          <>
            <FollowUpActions client={c} partner={false} onToast={onToast} />
            <Btn sm onClick={() => onQuiet(c, "ice")}>Ice</Btn>
            <Btn sm onClick={() => onQuiet(c, "close")}>Close</Btn>
          </>
        ) : <FollowUpActions client={c} onToast={onToast} />}
        <Btn sm onClick={() => onOpen(c.id)} title="Open the client"><ExternalLink size={13} /></Btn>
      </div>
      {isToday(c.last_outcome_at, now) && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.accent, alignSelf: "center" }}>Called today</span>}
    </div>
  );
}

function PartnersTab({ onToast, onOpen }) {
  const crm = useCrm();
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState("");
  const [reassign, setReassign] = useState(null);
  const [only, setOnly] = useState("");
  const load = () => fetchPartnerBoard().then((b) => { setBoard(b); setErr(""); }, (e) => setErr(e?.message || "Couldn't load the partners."));
  useEffect(() => { load(); }, []);
  if (err) return <Empty>{err}</Empty>;
  if (!board) return <Empty>Loading partners…</Empty>;
  const rows = board.rows.filter((r) => !only || r.broker_id === only);
  const askBroker = async (r) => {
    const url = whatsappUrl(r.broker_phone, brokerFollowUpMessage({ broker: r.broker_name, clientName: r.client_name, clientPhone: String(r.client_phone || "").replace(/\D/g, "").slice(-10) }));
    if (!url) return onToast("No number on this partner", "error");
    window.open(url, "_blank", "noopener");
    try { await logBrokerFollowUp(r.assignment_id); } catch { /* the message still went */ }
  };
  const summary = (p) => partnerSummaryMessage(p, partnerDueRows(board.rows.filter((r) => r.broker_id === p.broker_id)));

  return (
    <div style={{ display: "grid", gap: 14, padding: 14 }}>
      <div className="crm-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.textDim, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em" }}>
              {["Partner", "Open", "Due today", "Overdue", "Given 30d", "Called <24h", "First call", "Visits", "Closed", "Taken off", ""].map((h) => (
                <th key={h} style={{ padding: "9px 10px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.partners.filter((p) => p.open || p.assigned_30d || p.removed_30d).map((p) => {
              const pct = p.assigned_30d ? Math.round((p.contacted_24h / p.assigned_30d) * 100) : null;
              const msg = summary(p);
              return (
                <tr key={p.broker_id} style={{ borderBottom: `1px solid ${C.lineSoft}`, background: only === p.broker_id ? C.accentSoft : undefined }}>
                  <td style={{ padding: "8px 10px" }}>
                    <button type="button" onClick={() => setOnly(only === p.broker_id ? "" : p.broker_id)}
                      style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: C.text }}>{p.name}</button>
                    <div className="crm-mute crm-num" style={{ fontSize: 11 }}>{p.phone}</div>
                  </td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.open}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.due_today}</td>
                  <td className="crm-num" style={{ padding: "8px 10px", color: p.overdue ? C.coral : undefined, fontWeight: p.overdue ? 700 : 400 }}>{p.overdue}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.assigned_30d}</td>
                  <td className="crm-num" style={{ padding: "8px 10px", color: pct != null && pct < 70 ? C.coral : undefined }}>{pct == null ? "—" : `${pct}%`}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.first_hours == null ? "—" : `${p.first_hours}h`}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.visits_30d}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.closed_30d}</td>
                  <td className="crm-num" style={{ padding: "8px 10px" }}>{p.removed_30d}</td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <Btn sm title="Copy today's list for this partner" onClick={async () => {
                      try { await navigator.clipboard.writeText(msg); onToast("Summary copied"); } catch { window.prompt("Copy the summary", msg); }
                    }}><Copy size={13} /></Btn>{" "}
                    {p.phone && <a className="crm-btn crm-btn--wa crm-btn--sm" href={whatsappUrl(p.phone, msg)} target="_blank" rel="noreferrer" title="Send today's list on WhatsApp"><MessageCircle size={13} /></a>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="crm-mute" style={{ fontSize: 11, padding: "8px 10px" }}>Last 30 days. Called &lt;24h: share of new clients they acted on within a day. Tap a partner to see only theirs.</div>
      </div>

      <div className="crm-card" style={{ padding: 0 }}>
        <div className="crm-colhead"><span className="crm-label">Clients with partners · {rows.length}</span>
          <Btn sm onClick={load}><RefreshCw size={13} /> Refresh</Btn></div>
        {rows.length === 0 ? <Empty pad={24}>No open partner clients.</Empty> : rows.map((r) => {
          const s = SLA[r.sla] ?? SLA.ok;
          const client = (crm?.clients ?? []).find((c) => c.id === r.client_id) ?? { id: r.client_id, name: r.client_name, phone: r.client_phone };
          return (
            <div key={r.assignment_id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: TONE[s.tone], minWidth: 112 }}>{s.label}</span>
              <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 12.5 }}>
                <button type="button" onClick={() => onOpen(r.client_id)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: C.text }}>{r.client_name || "Client"}</button>
                <span className="crm-mute"> · with {r.broker_name}</span>
                <div className="crm-mute" style={{ fontSize: 11 }}>
                  {[`given ${relTime(r.assigned_at)}`, r.last_action_at ? `last action ${relTime(r.last_action_at)}` : "nothing done yet",
                    r.follow_up_on ? `follows up ${new Date(r.follow_up_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "",
                    r.last_detail || ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Btn sm variant="wa" onClick={() => askBroker(r)}><MessageCircle size={13} /> Ask partner</Btn>
              <Btn sm onClick={() => setReassign(client)}>Reassign</Btn>
            </div>
          );
        })}
      </div>
      {reassign && <AssignPartnerSheet client={reassign} defaultReplace onClose={() => { setReassign(null); load(); }} />}
    </div>
  );
}

export default function CrmFollowUpsPage() {
  const crm = useCrm();
  const navigate = useNavigate();
  const { activeClients: clients, touches, engagement, ownAnswers, requirements, access } = crm;
  const [picked, setTab] = useState("");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [now] = useState(() => Date.now());
  const say = (message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 2600); };
  const me = String(access?.email || "").toLowerCase();

  const rows = useMemo(() => {
    const contact = lastContactByClient(touches);
    const site = new Map((engagement ?? []).map((e) => [e.user_id, new Date(e.last_seen_at || 0).getTime()]));
    const own = new Map((ownAnswers ?? []).map((a) => [a.user_id, a]));
    const req = new Map((requirements ?? []).map((r) => [r.client_id, r]));
    return (clients ?? []).filter(isActive).map((c) => {
      const lastContactAt = contact.get(c.id) ?? 0;
      const lastSiteAt = c.user_id ? site.get(c.user_id) ?? 0 : 0;
      const mi = moveInTs(req.get(c.id)?.move_in || own.get(c.user_id)?.notes?.moveInDate);
      const moveInAt = Number.isFinite(mi) && mi < Number.MAX_SAFE_INTEGER - 1 ? mi : 0;
      const hot = isHotLead({ lastSiteAt, moveInAt, now });
      const hotWhy = !hot ? "" : lastSiteAt && now - lastSiteAt < 864e5 ? "on the site today" : "moving in soon";
      return { c, state: followUpState(c, { lastContactAt, lastSiteAt, now }), hot, hotWhy, lastContactAt };
    });
  }, [clients, touches, engagement, ownAnswers, requirements, now]);

  const mine = (r) => who === "all" || (who === "mine" ? String(r.c.assigned_to || "").toLowerCase() === me : !r.c.assigned_to);
  const needle = q.trim().toLowerCase();
  const found = (r) => !needle || `${r.c.name} ${r.c.phone} ${r.c.follow_up_note}`.toLowerCase().includes(needle);
  const scoped = rows.filter((r) => mine(r) && found(r));
  const counts = Object.fromEntries(TABS.map((t) => [t.id, scoped.filter((r) => r.state.bucket === t.id).length]));
  // Opens on the most urgent list with anyone on it.
  const tab = picked || (["overdue", "today", "upcoming", "quiet"].find((id) => counts[id] > 0) ?? "today");
  const shown = scoped.filter((r) => r.state.bucket === tab)
    .sort((a, b) => (tab === "upcoming" ? a.state.at - b.state.at : (b.hot - a.hot) || (a.state.at - b.state.at)));
  const calledToday = rows.filter((r) => isToday(r.lastContactAt, now)).length;
  const dueTotal = rows.filter((r) => r.state.bucket === "overdue" || r.state.bucket === "today").length;

  const open = (id) => navigate(`/crm/clients?client=${id}`);
  const onQuiet = async (c, what) => {
    try {
      if (what === "ice") crm.patchClient(await setClientTemperature(c, "ice", { actorEmail: me }));
      else crm.patchClient(await setClientStatus(c, "closed_outside", { actorEmail: me, reason: "No response" }));
      say(what === "ice" ? `${c.name || "Client"} marked Ice` : `${c.name || "Client"} closed · No response`);
    } catch (e) { say(e?.message || "Couldn't save", "error"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "14px 16px 10px", display: "grid", gap: 10, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Follow-ups</h1>
          <span className="crm-mute" style={{ fontSize: 12.5 }}>
            {dueTotal} due today · {calledToday} reached today · {rows.length} active clients
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {TABS.map((t) => (
            <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}
              style={t.id === "overdue" && counts.overdue && tab !== t.id ? { borderColor: C.coral, color: C.coral } : undefined}>
              {t.label}{t.id !== "partners" ? ` · ${counts[t.id]}` : ""}
            </Chip>
          ))}
          {tab !== "partners" && (
            <>
              <span style={{ width: 1, height: 20, background: C.line, margin: "0 4px" }} />
              {[["all", "All"], ["mine", "Mine"], ["none", "Unassigned"]].map(([id, l]) => <Chip key={id} on={who === id} onClick={() => setWho(id)}>{l}</Chip>)}
              <input className="crm-input" type="search" placeholder="Search name, phone, note" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240, marginLeft: "auto" }} />
            </>
          )}
        </div>
        {tab === "quiet" && <span className="crm-mute" style={{ fontSize: 11.5 }}>No contact and no visit to the site for 7 days. Keep them (pick a date), mark Ice, or close.</span>}
      </div>
      <div className="crm-scroll" style={{ flex: 1 }}>
        {tab === "partners" ? <PartnersTab onToast={say} onOpen={open} /> : shown.length === 0 ? (
          <Empty>{tab === "overdue" ? "Nothing overdue. 🎉" : tab === "today" ? "Nobody else due today." : tab === "quiet" ? "No quiet clients." : "Nothing upcoming."}</Empty>
        ) : shown.map((r) => (
          <ClientRow key={r.c.id} r={r} now={now} onOpen={open} onToast={say} quiet={tab === "quiet"} onQuiet={onQuiet} />
        ))}
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}

