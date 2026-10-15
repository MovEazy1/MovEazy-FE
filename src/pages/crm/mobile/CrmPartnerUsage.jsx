/**
 * CRM → Partner usage (the phone's Partners tab).
 *
 *   /crm/partner-usage      today across partners, who has gone quiet (on a
 *                           plan, 3+ days away), then every partner with their
 *                           numbers: plan, time in the app, flats, leads
 *   /crm/partner-usage/:id  one partner: their sessions with every button
 *                           pressed, the MovEazy leads they hold and how far
 *                           each got, the leads they added themselves, their flats
 *
 * Numbers from crm_partner_usage() (crm_mobile.sql); sessions from
 * app_analytics_user() (needs App analytics access).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { useCrm } from "../CrmShell";
import { C, Empty, Loading, inr, relTime, shortDate } from "../crmUi";
import { SCOPES } from "../../../lib/adminScopes";
import { friendlyError } from "../../../lib/partners";
import { fetchAppSessions } from "../../../lib/appAnalytics";
import {
  USAGE_SORTS, daysLeft, duration, fetchPartnerDetail, fetchPartnerUsage, goneQuiet, moveazyLeadStage, ownLeadStage, usageSummary,
} from "../../../lib/crmMobile";
import { ContactButtons, Metric, PhSection, Segment, updatedAt } from "./phoneUi";

const planLine = (p) => {
  if (!p.plan_source) return "Free plan";
  const left = daysLeft(p.plan_until);
  return `${p.plan_source === "trial" ? "Trial" : "Premium"} · ${left}d left`;
};
const quietNudge = (p) => {
  const first = String(p.name || "").split(" ")[0] || "there";
  return `Hi ${first}, we haven't seen you on MovEazy Partners for a few days. Fresh tenant leads are waiting — open the app and upload today's flats to get more.`;
};

export default function CrmPartnerUsage() {
  const { brokerId } = useParams();
  return brokerId ? <PartnerDetail brokerId={brokerId} /> : <UsageList />;
}

function UsageList() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [at, setAt] = useState(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("seen");

  const load = useCallback(async () => {
    try {
      setRows(await fetchPartnerUsage());
      setAt(new Date());
      setErr("");
    } catch (e) {
      setErr(friendlyError(e, "Couldn't load partner usage."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sum = useMemo(() => usageSummary(rows ?? []), [rows]);
  const quiet = useMemo(() => goneQuiet(rows ?? []), [rows]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const by = USAGE_SORTS.find((s) => s.id === sort)?.by ?? USAGE_SORTS[0].by;
    return (rows ?? [])
      .filter((p) => !needle || [p.name, p.phone, p.agency].some((v) => String(v || "").toLowerCase().includes(needle)))
      .sort((a, b) => by(b) - by(a));
  }, [rows, q, sort]);

  if (err && !rows) return <Empty>{err}</Empty>;
  if (!rows) return <Loading label="Loading partner usage…" />;

  return (
    <div className="crm-ph-page">
      <PhSection title="Today" right={<span className="crm-ph-note">{updatedAt(at)}</span>}>
        <div className="crm-ph-grid">
          <Metric label="Active today" value={sum.activeToday} sub={`${sum.activeWeek} this week · ${rows.length} partners`} />
          <Metric label="Time in the app today" value={duration(sum.secondsToday)} />
          <Metric label="Flats uploaded today" value={sum.flatsToday} />
          <Metric label="On trial / Premium" value={sum.onPlan} />
        </div>
      </PhSection>

      <PhSection title={`Gone quiet · ${quiet.length}`}>
        {quiet.length === 0 ? (
          <p className="crm-ph-note">Every partner on trial or Premium opened the app in the last 3 days.</p>
        ) : quiet.map((p) => (
          <div key={p.user_id} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <Link to={`/crm/partner-usage/${p.user_id}`} style={{ color: C.text, textDecoration: "none", minWidth: 0 }}>
                <b>{p.name || "A partner"}</b>
                <div className="crm-ph-meta">{planLine(p)} · {p.last_seen ? `last seen ${relTime(p.last_seen)}` : "never opened the app"}</div>
              </Link>
            </div>
            <ContactButtons phone={p.phone} label={p.name} text={quietNudge(p)} />
          </div>
        ))}
      </PhSection>

      <PhSection title={`Every partner · ${rows.length}`}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <label style={{ flex: 1, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 12, color: C.textMute }} />
            <input className="crm-input" placeholder="Search name, phone, agency" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ paddingLeft: 32 }} />
          </label>
          <select className="crm-input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 128, flex: "none" }} aria-label="Sort">
            {USAGE_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        {list.map((p) => (
          <Link key={p.user_id} to={`/crm/partner-usage/${p.user_id}`} className="crm-ph-card"
            style={{ color: C.text, textDecoration: "none" }}>
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{p.name || "A partner"}</b>
                <div className="crm-ph-meta">{[p.agency, planLine(p)].filter(Boolean).join(" · ")}</div>
              </div>
              <ChevronRight size={18} color={C.textMute} style={{ flex: "none" }} />
            </div>
            <div className="crm-ph-meta">
              {p.last_seen ? `Last seen ${relTime(p.last_seen)}` : "Never opened the app"} · today {duration(p.seconds_today)} · 7 days {duration(p.seconds_7d)}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="crm-ph-pill">Flats {p.flats} ({p.flats_complete} complete{p.flats_today ? `, +${p.flats_today} today` : ""})</span>
              <span className="crm-ph-pill">MovEazy leads {p.moveazy_leads}</span>
              {p.moveazy_untouched > 0 && (
                <span className="crm-ph-pill" style={{ color: C.coral, borderColor: "#E8C4BC", background: "#FBEEEB" }}>{p.moveazy_untouched} not called</span>
              )}
              <span className="crm-ph-pill">Own leads {p.own_leads}</span>
              <span className="crm-ph-pill">{p.sessions} sessions · {p.clicks} taps</span>
            </div>
          </Link>
        ))}
      </PhSection>
    </div>
  );
}

function PartnerDetail({ brokerId }) {
  const { access } = useCrm();
  const canSessions = access.has(SCOPES.ANALYTICS_READ);
  const [row, setRow] = useState(null);
  const [d, setD] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("sessions");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [all, detail] = await Promise.all([fetchPartnerUsage(), fetchPartnerDetail(brokerId)]);
        if (!live) return;
        setRow(all.find((p) => p.user_id === brokerId) ?? null);
        setD(detail);
      } catch (e) {
        if (live) setErr(friendlyError(e, "Couldn't load this partner."));
      }
      if (!canSessions) return;
      try {
        const s = await fetchAppSessions("partner", brokerId, 40);
        if (live) setSessions(s);
      } catch {
        if (live) setSessions([]);
      }
    })();
    return () => { live = false; };
  }, [brokerId, canSessions]);

  if (err) return <Empty>{err}</Empty>;
  if (!d) return <Loading label="Loading the partner…" />;
  const p = row ?? {};
  const mz = d.moveazy_leads ?? [];
  const own = d.own_leads ?? [];
  const flats = d.flats ?? [];

  return (
    <div className="crm-ph-page" style={{ gap: 14 }}>
      <div className="crm-ph-card">
        <div className="crm-ph-card-top">
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 17 }}>{p.name || "A partner"}</b>
            <div className="crm-ph-meta">{[p.agency, planLine(p), p.created_at && `joined ${shortDate(p.created_at)}`].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <ContactButtons phone={p.phone} label={p.name} />
      </div>

      <div className="crm-ph-grid crm-ph-grid--3">
        <Metric label="Last seen" value={p.last_seen ? relTime(p.last_seen) : "Never"} />
        <Metric label="Time today" value={duration(p.seconds_today)} sub={`7 days ${duration(p.seconds_7d)}`} />
        <Metric label="Sessions" value={p.sessions ?? 0} sub={`${p.clicks ?? 0} taps`} />
        <Metric label="Flats" value={flats.length} sub={`${flats.filter((f) => f.complete).length} complete`} />
        <Metric label="MovEazy leads" value={mz.length} sub={`${mz.filter((a) => a.status === "assigned" && !Number(a.reach_count)).length} not called`} />
        <Metric label="Own leads" value={own.length} />
      </div>

      <Segment value={tab} onChange={setTab} options={[
        ["sessions", "Sessions"], ["moveazy", `MovEazy ${mz.length}`], ["own", `Own ${own.length}`], ["flats", `Flats ${flats.length}`],
      ]} />

      {tab === "sessions" && (
        !canSessions ? <p className="crm-ph-note">Sessions need App analytics access.</p>
          : sessions === null ? <Loading label="Loading sessions…" />
          : sessions.length === 0 ? <Empty pad={16}>No sessions yet.</Empty>
          : sessions.map((s) => {
            const key = s.session_key;
            const taps = (s.events ?? []).filter((e) => e.kind === "click");
            return (
              <div key={key} className="crm-ph-card">
                <button type="button" onClick={() => setOpen(open === key ? null : key)} style={{ textAlign: "left", width: "100%" }}>
                  <div className="crm-ph-card-top">
                    <b style={{ fontSize: 13.5 }}>
                      {new Date(s.started_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </b>
                    <span className="crm-ph-pill">{duration(s.seconds)} · {taps.length} taps</span>
                  </div>
                  <div className="crm-ph-meta">
                    {[s.device, s.os].filter(Boolean).join(" · ") || "Device unknown"}
                    {taps.length ? ` · ${taps.slice(0, 3).map((e) => e.label).filter(Boolean).join(", ")}${taps.length > 3 ? "…" : ""}` : ""}
                  </div>
                </button>
                {open === key && (
                  <div style={{ borderTop: `1px solid ${C.lineSoft}`, paddingTop: 6 }}>
                    {(s.events ?? []).map((e, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 8, padding: "4px 0", fontSize: 12.5,
                        borderTop: i ? `1px solid ${C.lineSoft}` : 0 }}>
                        <span className="crm-mute crm-num">
                          {new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                          {e.kind === "page" ? <span className="crm-mute">Opened {e.label || e.path}</span> : <>Tapped <b>{e.label || e.target}</b></>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
      )}

      {tab === "moveazy" && (mz.length === 0 ? <Empty pad={16}>No MovEazy leads given yet.</Empty> : mz.map((a) => (
        <div key={a.id} className="crm-ph-card">
          <div className="crm-ph-card-top">
            <div style={{ minWidth: 0 }}>
              <b>{a.name || "A tenant"}</b>
              <div className="crm-ph-meta">Given {shortDate(a.assigned_at)} · {String(a.pack || "").replace("free10", "free leads").replace("paid30", "lead pack")}</div>
            </div>
            <span className="crm-ph-pill" style={a.status === "assigned" && !Number(a.reach_count) ? { color: C.coral, borderColor: "#E8C4BC", background: "#FBEEEB" } : undefined}>
              {moveazyLeadStage(a)}
            </span>
          </div>
          <div className="crm-ph-meta">
            {Number(a.reach_count) > 0 ? `Reached ${a.reach_count}× · last ${a.last_channel || ""} ${relTime(a.last_reach_at)}` : "The partner hasn't called or WhatsApped yet"}
            {a.closed_rent ? ` · closed at ${inr(a.closed_rent)}` : ""}
          </div>
          {a.client_id && <Link to={`/crm/clients?client=${a.client_id}`} className="crm-btn" style={{ justifyContent: "center", textDecoration: "none" }}>Open the client</Link>}
        </div>
      )))}

      {tab === "own" && (own.length === 0 ? <Empty pad={16}>No leads of their own yet.</Empty> : own.map((l) => {
        const stage = ownLeadStage(l);
        const want = [
          (l.flat_types ?? []).join("/"),
          l.budget_max ? `up to ${inr(l.budget_max)}` : "",
          (l.localities ?? []).slice(0, 3).join(", "),
          l.move_in_label,
        ].filter(Boolean).join(" · ");
        return (
          <div key={l.id} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{l.name || "A tenant"}</b>
                <div className="crm-ph-meta">Added {shortDate(l.created_at)}{l.source ? ` · ${l.source === "qr" ? "from their QR poster" : l.source}` : ""}</div>
              </div>
              <span className="crm-ph-pill">{stage.label}</span>
            </div>
            {want && <div className="crm-ph-meta">{want}</div>}
            <div className="crm-ph-meta">
              {l.lists_sent} list{Number(l.lists_sent) === 1 ? "" : "s"} sent · {l.likes} like{Number(l.likes) === 1 ? "" : "s"} · {l.visits} visit{Number(l.visits) === 1 ? "" : "s"}
              {l.last_contacted_at ? ` · contacted ${relTime(l.last_contacted_at)}` : ""}
            </div>
          </div>
        );
      }))}

      {tab === "flats" && (flats.length === 0 ? <Empty pad={16}>No flats uploaded yet.</Empty> : flats.map((f) => (
        <div key={f.property_id} className="crm-ph-card" style={{ flexDirection: "row", gap: 10 }}>
          {f.cover_image_url
            ? <img src={f.cover_image_url} alt="" width="64" height="64" style={{ borderRadius: 9, objectFit: "cover", flex: "none" }} loading="lazy" />
            : <span style={{ width: 64, height: 64, borderRadius: 9, background: C.surfaceAlt, flex: "none" }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 13.5 }}>{f.title || [f.flat_type, f.area].filter(Boolean).join(" in ") || f.property_id}</b>
            <div className="crm-ph-meta">{[f.area, inr(f.rent), shortDate(f.created_at)].filter(Boolean).join(" · ")}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span className="crm-ph-pill" style={f.complete ? { color: C.accent, borderColor: "#B7D8CF", background: C.accentSoft } : undefined}>
                {f.complete ? "Complete" : "Details missing"}
              </span>
              <span className="crm-ph-pill">{f.status === "published" ? "Live" : f.status}</span>
            </div>
          </div>
        </div>
      )))}
    </div>
  );
}
