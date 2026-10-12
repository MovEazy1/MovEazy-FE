/**
 * CRM → Societies (society_app.sql): every society set up in MovEazy Society.
 *
 *   /crm/societies       the list — waiting for approval first — and the
 *                        Explore societies switch for tenants (with how many
 *                        society flats are live), and the default pool %.
 *   /crm/societies/:id   one society: approve / ask for changes, its pool %,
 *                        flats (and which available ones need photos),
 *                        members with their split and UPI, deals and every
 *                        payout (mark paid with the UTR), cancel a deal, and
 *                        the audit log.
 * Needs crm.properties.write; the database checks it again.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Btn, C, Chip, Empty, Loading, inr, relTime, shortDate } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import {
  ROLES, cancelCrmSocietyDeal, closeCrmSocietyDeal, decideCrmSociety, fetchCrmSocieties, fetchCrmSociety, markCrmSocietyPaid,
  setCrmSocietyPool, setCrmSocietySettings, societyError,
} from "../../lib/society";

const STATUS_TONE = { pending: C.gold, approved: "#10B981", rejected: "#EF4444" };
const cell = { padding: "9px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top", fontSize: 13 };
const th = { ...cell, color: C.textMute, fontWeight: 600, fontSize: 12, textAlign: "left", background: C.surface };
const LIVE_AT = 10;

function Pill({ status }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: "#fff", background: STATUS_TONE[status] || C.textMute }}>{status}</span>;
}

function List() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetchCrmSocieties().then((d) => { setData(d); setErr(""); }, (e) => setErr(societyError(e))), []);
  useEffect(() => { load(); }, [load]);

  const toggleLive = async () => {
    const on = !data.live;
    if (on && data.live_flats < LIVE_AT && !window.confirm(`Only ${data.live_flats} society flats are live (the plan was ${LIVE_AT}+). Switch Explore societies on for tenants anyway?`)) return;
    if (!on && !window.confirm("Hide Explore societies from tenants?")) return;
    setBusy(true);
    try { await setCrmSocietySettings({ live: on }); await load(); } catch (e) { window.alert(societyError(e)); } finally { setBusy(false); }
  };
  const setDefaultPool = async () => {
    const v = window.prompt("Society share for NEW societies (% of brokerage). Existing societies keep theirs.", String(data.default_pool_pct));
    if (v === null) return;
    try { await setCrmSocietySettings({ defaultPool: Number(v) }); await load(); } catch (e) { window.alert(societyError(e)); }
  };

  if (err) return <p style={{ color: "#EF4444" }}>{err}</p>;
  if (!data) return <Loading />;
  const pending = data.societies.filter((s) => s.status === "pending").length;
  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "14px 0" }}>
        <div className="crm-card" style={{ padding: 14, minWidth: 260, flex: 1 }}>
          <div style={{ fontWeight: 800 }}>Explore societies for tenants</div>
          <div className="crm-mute" style={{ fontSize: 12, margin: "4px 0 10px" }}>
            After their top 5 matches and on their home. {data.live_flats} society flat{data.live_flats === 1 ? "" : "s"} live now — the plan is to go live at {LIVE_AT}+.
            Staff always see a preview.
          </div>
          <Btn sm variant={data.live ? undefined : "primary"} disabled={busy} onClick={toggleLive}>{data.live ? "Live — switch off" : "Off — take it live"}</Btn>
        </div>
        <div className="crm-card" style={{ padding: 14, minWidth: 220 }}>
          <div style={{ fontWeight: 800 }}>Default society share</div>
          <div className="crm-mute" style={{ fontSize: 12, margin: "4px 0 10px" }}>Of the brokerage (one month&apos;s rent), for new societies.</div>
          <Btn sm onClick={setDefaultPool}>{data.default_pool_pct}% — change</Btn>
        </div>
      </div>
      {data.societies.length === 0 ? <Empty>No societies yet. Managers set them up at society.moveazy.co.in.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Society{pending ? ` · ${pending} to review` : ""}</th><th style={th}>Status</th><th style={th}>Flats</th><th style={th}>Need photos</th><th style={th}>Members</th><th style={th}>Share</th><th style={th}>Payouts due</th><th style={th}>Since</th></tr></thead>
            <tbody>
              {data.societies.map((s) => (
                <tr key={s.id}>
                  <td style={cell}>
                    <Link to={`/crm/societies/${s.id}`} style={{ fontWeight: 700, color: C.text }}>{s.name}</Link>
                    <div className="crm-mute" style={{ fontSize: 11.5 }}>{s.area}{s.manager ? ` · ${s.manager.name} ${formatForDisplay(s.manager.phone)}` : ""}</div>
                  </td>
                  <td style={cell}><Pill status={s.status} /></td>
                  <td style={cell}>{s.available} available / {s.flats}</td>
                  <td style={cell}>{s.no_photos ? <b style={{ color: C.gold }}>{s.no_photos}</b> : "—"}</td>
                  <td style={cell}>{s.members}</td>
                  <td style={cell}>{s.pool_pct}%</td>
                  <td style={cell}>{s.pending_payout ? inr(s.pending_payout) : "—"}</td>
                  <td style={cell} className="crm-mute">{relTime(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Detail({ id }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("flats");
  const load = useCallback(() => fetchCrmSociety(id).then((d) => { setS(d); setErr(""); }, (e) => setErr(societyError(e))), [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); await load(); if (ok) window.alert(ok); } catch (e) { window.alert(societyError(e)); } finally { setBusy(""); }
  };
  const flats = useMemo(() => s?.flats ?? [], [s]);

  if (err) return <p style={{ color: "#EF4444" }}>{err}</p>;
  if (!s) return <Loading />;

  const approve = () => window.confirm(`Approve ${s.name}? Its available flats go live on moveazy.co.in.`) && run("decide", () => decideCrmSociety(id, true));
  const reject = () => {
    const why = window.prompt(`What should the manager fix? They'll see this.`, s.reject_reason || "");
    if (why) run("decide", () => decideCrmSociety(id, false, why));
  };
  const pool = () => {
    const v = window.prompt(`${s.name}'s share of the brokerage (%). Deals already closed keep theirs.`, String(s.pool_pct));
    if (v !== null) run("pool", () => setCrmSocietyPool(id, Number(v)));
  };
  const closeDeal = (f) => {
    const rent = window.prompt(`Record a closed rental on ${f.label}.\n\nMonthly rent it closed at (brokerage = one month's rent; the society gets ${s.pool_pct}%):`, String(Math.round(f.rent)));
    if (rent === null) return;
    const ref = window.prompt("Reference (CRM client / invoice), optional:", "") ?? "";
    run(`deal-${f.property_id}`, () => closeCrmSocietyDeal(f.property_id, { rent: Number(String(rent).replace(/[^\d]/g, "")), reference: ref }), "Recorded — the members have been told their shares.");
  };
  const cancelDeal = (d) => {
    const why = window.prompt(`Cancel the ${d.flat} deal? Unpaid shares are cancelled; paid ones get an adjustment. Why?`, "");
    if (why) run(`cancel-${d.id}`, () => cancelCrmSocietyDeal(d.id, why));
  };
  const paid = (p) => {
    const utr = window.prompt(`Paid ${inr(p.amount)} to ${p.name} at ${p.upi_id || "(no UPI ID yet)"}?\n\nUPI reference (UTR):`, "");
    if (utr) run(`pay-${p.id}`, () => markCrmSocietyPaid(p.id, utr));
  };

  return (
    <>
      <div className="crm-card" style={{ padding: 16, margin: "14px 0", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{s.name} <Pill status={s.status} /></div>
            <div className="crm-mute" style={{ fontSize: 12.5 }}>{[s.area, s.full_address].filter(Boolean).join(" · ")}</div>
            {s.google_url && <a href={s.google_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>Google Maps</a>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
            {s.status !== "approved" && <Btn sm variant="primary" disabled={!!busy} onClick={approve}>Approve</Btn>}
            <Btn sm disabled={!!busy} onClick={reject}>{s.status === "approved" ? "Take off & ask for changes" : "Ask for changes"}</Btn>
            <Btn sm disabled={!!busy} onClick={pool}>Share {s.pool_pct}%</Btn>
            {s.status === "approved" && <a href={`https://www.moveazy.co.in/building/${s.code}`} target="_blank" rel="noreferrer"><Btn sm>Public page</Btn></a>}
          </div>
        </div>
        {s.status === "rejected" && <div style={{ fontSize: 12.5, color: "#B91C1C" }}>Asked to fix: {s.reject_reason}</div>}
        <div style={{ fontSize: 12.5, display: "flex", gap: 14, flexWrap: "wrap" }} className="crm-mute">
          <span>Towers: {(s.towers ?? []).join(", ") || "—"}</span><span>Floors: {s.total_floors ?? "—"}</span><span>Flats: {s.total_flats ?? "—"}</span>
          <span>Built: {s.year_built ?? "—"}</span><span>Maintenance: {s.maintenance ? inr(s.maintenance) : "—"}</span>
          <span>Rules: {[s.rules?.families && "families", s.rules?.bachelors && "bachelors", s.rules?.pets && "pets", s.rules?.veg_only && "veg only"].filter(Boolean).join(", ") || "—"}</span>
        </div>
        {s.rules?.notes && <div style={{ fontSize: 12.5 }}>“{s.rules.notes}”</div>}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(s.amenities ?? []).map((a) => <Chip key={a}>{a}</Chip>)}</div>
        {(s.photos ?? []).length > 0 && <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>{s.photos.map((u) => <img key={u} src={u} alt="" style={{ height: 70, borderRadius: 8 }} />)}</div>}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["flats", `Flats · ${flats.length}`], ["members", `Members · ${s.members.filter((m) => m.status === "active").length}`], ["deals", `Deals · ${s.deals.length}`], ["log", "Log"]].map(([k, label]) => (
          <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{label}</Chip>
        ))}
      </div>

      {tab === "flats" && (flats.length === 0 ? <Empty>No flats yet.</Empty> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Flat</th><th style={th}>Rent</th><th style={th}>Status</th><th style={th}>Owner</th><th style={th}>Photos</th><th style={th}>Added by</th><th style={th} /></tr></thead>
          <tbody>{flats.map((f) => (
            <tr key={f.property_id}>
              <td style={cell}><b>{f.label}</b> <span className="crm-mute">{f.bhk} · {f.furnishing}</span><div className="crm-mute" style={{ fontSize: 11 }}>{f.property_id}</div>
                {f.notes && <div style={{ fontSize: 11.5 }}>“{f.notes}”</div>}</td>
              <td style={cell}>{inr(f.rent)}</td>
              <td style={cell}>{f.occupancy === "occupied" ? `Occupied${f.move_out_date ? ` · out ${shortDate(f.move_out_date)}` : ""}` : f.live ? "Live" : "Available (not live)"}</td>
              <td style={cell}>{f.owner_name}<div className="crm-mute" style={{ fontSize: 11.5 }}>{formatForDisplay(f.owner_phone)}</div></td>
              <td style={cell}>{(f.images ?? []).length || (f.occupancy === "available" ? <b style={{ color: C.gold }}>needs photos</b> : "—")}</td>
              <td style={cell} className="crm-mute">{f.created_by}{f.updated_by && f.updated_by !== f.created_by ? ` · edited by ${f.updated_by}` : ""}</td>
              <td style={cell}>
                <div style={{ display: "flex", gap: 5 }}>
                  <Link to={`/crm/properties/${f.property_id}/edit`}><Btn sm>Edit listing</Btn></Link>
                  <Btn sm variant="primary" disabled={!!busy} onClick={() => closeDeal(f)}>Record deal</Btn>
                </div>
              </td>
            </tr>))}
          </tbody>
        </table>
      ))}

      {tab === "members" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Member</th><th style={th}>Role</th><th style={th}>Share</th><th style={th}>UPI</th><th style={th}>Joined</th></tr></thead>
          <tbody>{s.members.map((m) => (
            <tr key={m.id} style={{ opacity: m.status === "active" ? 1 : 0.5 }}>
              <td style={cell}><b>{m.name}</b><div className="crm-mute" style={{ fontSize: 11.5 }}>{formatForDisplay(m.phone)}{m.status !== "active" ? " · removed" : ""}</div></td>
              <td style={cell}>{ROLES[m.role]}</td>
              <td style={cell}>{m.pct != null ? `${Math.round(m.pct * 100) / 100}%` : "—"}</td>
              <td style={cell}>{m.upi_id || <span style={{ color: C.gold }}>not added</span>}</td>
              <td style={cell} className="crm-mute">{shortDate(m.joined_at)}</td>
            </tr>))}
          </tbody>
        </table>
      )}

      {tab === "deals" && (s.deals.length === 0 ? <Empty>No deals yet. Record one from a flat in the Flats tab.</Empty> : s.deals.map((d) => (
        <div key={d.id} className="crm-card" style={{ padding: 12, marginBottom: 10, opacity: d.status === "cancelled" ? 0.7 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div>
              <b>{d.flat}</b> · rent {inr(d.rent)} · pool {d.pool_pct}% = <b>{inr(d.pool_amount)}</b>
              <div className="crm-mute" style={{ fontSize: 11.5 }}>Closed {shortDate(d.closed_on)}{d.reference ? ` · ref ${d.reference}` : ""}{d.status === "cancelled" ? ` · cancelled: ${d.cancel_reason}` : ""}</div>
            </div>
            {d.status === "closed" && <Btn sm disabled={!!busy} onClick={() => cancelDeal(d)}>Cancel deal</Btn>}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead><tr><th style={th}>Member</th><th style={th}>Share</th><th style={th}>Amount</th><th style={th}>UPI</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>{(d.payouts ?? []).map((p) => (
              <tr key={p.id}>
                <td style={cell}>{p.name}{p.kind === "adjustment" ? " (adjustment)" : ""}</td>
                <td style={cell}>{Math.round(p.share_pct * 100) / 100}%</td>
                <td style={cell}><b>{inr(p.amount)}</b></td>
                <td style={cell}>{p.upi_id || <span style={{ color: C.gold }}>waiting for UPI</span>}</td>
                <td style={cell}>{p.status}{p.utr ? ` · ${p.utr}` : ""}{p.paid_at ? ` · ${shortDate(p.paid_at)}` : ""}</td>
                <td style={cell}>{p.status === "pending" && <Btn sm variant="primary" disabled={!!busy || !p.upi_id} onClick={() => paid(p)}>Mark paid</Btn>}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )))}

      {tab === "log" && (s.events.length === 0 ? <Empty>Nothing yet.</Empty> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>{s.events.map((e, i) => (
            <tr key={i}><td style={cell} className="crm-mute">{relTime(e.at)}</td><td style={cell}>{e.actor || "—"}</td><td style={cell}>{e.action.replace(/_/g, " ")}</td><td style={cell} className="crm-mute">{e.entity} {e.entity_id && e.entity !== "society" ? e.entity_id : ""}</td></tr>
          ))}</tbody>
        </table>
      ))}
    </>
  );
}

export default function CrmSocietiesPage() {
  const { id } = useParams();
  return (
    <div style={{ padding: 20, maxWidth: 1240 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: C.text }}>
        {id ? <><Link to="/crm/societies" style={{ color: C.textMute }}>Societies</Link> / </> : null}Societies
      </h1>
      <div className="crm-mute" style={{ fontSize: 12.5 }}>
        Set up by society managers at society.moveazy.co.in. Their flats are on the site (never shown to partners); the society shares the brokerage on every rental.
      </div>
      {id ? <Detail id={id} /> : <List />}
    </div>
  );
}
