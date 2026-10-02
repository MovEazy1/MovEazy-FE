/**
 * One flat's QR, leads and feedback — the QR poster on top for the door, then
 * leads (QR scans), likes and visits, 14 days of scans, and what renters said:
 * the rent view, a rating and their words, recorded by the MovEazy team
 * (owner_flat_insights in flat_insights.sql). Renters appear by first name and
 * initial only.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Building2, MessageSquareText, Star } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Empty, Loading, Pill, TopBar, toast } from "./ownerUi";
import { StatTiles } from "./RentDashboard";
import QrPosterBlock from "../../components/QrPosterBlock";
import { FEEDBACK_SOURCES, PRICE_VIEWS, fetchOwnerFlatInsights, priceViewLabel } from "../../lib/flatInsights";
import { VISIT_STATUS, visitWhen } from "../../lib/buildings";
import { fmtDate, op, propertyName, relTime } from "../../lib/owners";

function Stars({ n }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} fill={i <= n ? "#D6B77C" : "none"} color={i <= n ? "#B8934D" : "#C9C3B3"} />)}
    </span>
  );
}

export default function FlatLeads() {
  const { id } = useParams();
  const { byId, properties } = useOwner();
  const p = byId.get(id);
  const [d, setD] = useState(undefined);
  const [tab, setTab] = useState("feedback");

  useEffect(() => {
    fetchOwnerFlatInsights(id).then((r) => setD(r || null), () => setD(null));
  }, [id]);

  if (!properties || d === undefined) return <><TopBar title="QR & leads" back /><Loading /></>;
  if (!p || !d) return <><TopBar title="QR & leads" back /><Empty>That flat isn't in your account.</Empty></>;

  const s = d.stats || {};
  const fb = d.feedback ?? [];
  const pv = s.price_views || {};
  const pvTotal = Object.values(pv).reduce((a, b) => a + Number(b), 0);
  const max = Math.max(1, ...(d.by_day ?? []).map((x) => Number(x.opens) || 0));
  const lists = { feedback: fb, visits: d.visits ?? [], likes: d.likes ?? [] };

  return (
    <>
      <TopBar title={propertyName(p)} back />
      <style>{CSS}</style>
      <div className="oz-pad">
        <div className="oz-section">
          <h2 className="oz-h2"><span>QR for the door</span>{p.status === "published" ? <Pill tone="green">Live</Pill> : <Pill tone="amber">Not live yet</Pill>}</h2>
          <QrPosterBlock flat={p} btnClass="oz-btn oz-btn--primary oz-btn--block" softClass="oz-btn oz-btn--soft" onToast={toast} />
          {p.status !== "published" && (
            <p className="oz-hint" style={{ marginTop: 10 }}>The QR opens once the flat is live. <Link to={op(`/properties/${id}/find-tenant`)}>Put it live</Link></p>
          )}
          {d.building_code && (
            <Link to={op(`/buildings/${d.building_id}`)} className="fl-bld"><Building2 size={15} /> Also on {d.building_name}'s QR, with every flat in the building</Link>
          )}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Interest</h2>
          <StatTiles s={s} />
          {(d.by_day ?? []).length > 0 && (
            <>
              <div className="fl-chart" aria-label="Opens and QR scans, last 14 days">
                {d.by_day.map((x) => (
                  <div key={x.day} title={`${x.day}: ${x.opens} opened, ${x.scans} by QR`}>
                    <i style={{ height: `${(Number(x.opens) / max) * 100}%` }}><u style={{ height: `${Number(x.opens) ? (Number(x.scans) / Number(x.opens)) * 100 : 0}%` }} /></i>
                  </div>
                ))}
              </div>
              <div className="fl-legend"><span><i className="a" /> QR scans</span><span><i className="b" /> Opened from a link</span><span>Last 14 days</span></div>
            </>
          )}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2"><span><MessageSquareText size={16} style={{ verticalAlign: -3, color: "var(--em)" }} /> What renters say</span>
            {s.rating != null && <span className="fl-avg"><Star size={14} fill="#D6B77C" color="#B8934D" /> {s.rating}</span>}</h2>
          {pvTotal > 0 && (
            <div className="fl-pv">
              <div className="oz-meta" style={{ marginBottom: 6 }}>How they found the rent</div>
              {PRICE_VIEWS.map((v) => (
                <div key={v.id} className="fl-pv-row">
                  <span>{v.label}</span>
                  <i><u className={`t-${v.tone}`} style={{ width: `${((Number(pv[v.id]) || 0) / pvTotal) * 100}%` }} /></i>
                  <b>{Number(pv[v.id]) || 0}</b>
                </div>
              ))}
            </div>
          )}
          <div className="oz-chips" style={{ margin: "12px 0 6px" }}>
            {[["feedback", "Feedback"], ["visits", "Visits"], ["likes", "Likes"]].map(([k, label]) => (
              <button key={k} type="button" className={`oz-chip${tab === k ? " oz-chip--on" : ""}`} onClick={() => setTab(k)}>{label} ({lists[k].length})</button>
            ))}
          </div>
          {lists[tab].length === 0 ? (
            <div className="oz-meta" style={{ padding: "10px 2px" }}>
              {tab === "feedback" ? "The MovEazy team adds what renters say after each visit or call — it shows up here."
                : tab === "visits" ? "No visits yet. Paste the QR on the door to start getting them." : "No likes yet."}
            </div>
          ) : tab === "feedback" ? fb.map((f) => (
            <div key={f.id} className="fl-item">
              <Avatar name={f.name || "Renter"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="oz-between">
                  <b>{f.name || "A renter"}</b>
                  <span className="oz-meta" style={{ fontSize: 12 }}>{fmtDate(f.created_at, { day: "numeric", month: "short" })}</span>
                </div>
                <div className="oz-row" style={{ gap: 6, margin: "3px 0", flexWrap: "wrap" }}>
                  {f.rating ? <Stars n={f.rating} /> : null}
                  {f.price_view && <Pill tone={PRICE_VIEWS.find((v) => v.id === f.price_view)?.tone || "grey"}>Rent: {priceViewLabel(f.price_view)}</Pill>}
                  <span className="oz-meta" style={{ fontSize: 11.5 }}>{FEEDBACK_SOURCES.find((x) => x.id === f.source)?.label}</span>
                </div>
                {f.comment && <p className="fl-quote">“{f.comment}”</p>}
              </div>
            </div>
          )) : tab === "visits" ? d.visits.map((v, i) => {
            const st = VISIT_STATUS[v.status];
            return (
              <div key={`${v.created_at}-${i}`} className="fl-item">
                <Avatar name={v.name || "Renter"} />
                <div style={{ flex: 1 }}><b>{v.name || "A renter"}</b><div className="oz-meta">{v.at ? visitWhen(v.at) : "Asked for a visit"}</div></div>
                <Pill tone={st?.tone || (v.status === "preference" ? "amber" : "blue")}>{st?.label || (v.status === "preference" ? "Asked to visit" : "Booked")}</Pill>
              </div>
            );
          }) : d.likes.map((l, i) => (
            <div key={`${l.at}-${i}`} className="fl-item">
              <Avatar name={l.name || "Renter"} />
              <div style={{ flex: 1 }}><b>{l.name || "A renter"}</b><div className="oz-meta">Liked it · {relTime(l.at)}</div></div>
            </div>
          ))}
          <p className="oz-hint" style={{ marginTop: 10 }}>Renters' numbers go to MovEazy, who arrange every visit — you see first names only.</p>
        </div>
      </div>
    </>
  );
}

const CSS = `
.fl-bld { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: var(--champ2); color: var(--champ3);
  font-size: 13px; font-weight: 600; text-decoration: none; }
.fl-chart { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; align-items: end; height: 60px; margin-top: 14px; }
.fl-chart > div { height: 100%; display: flex; align-items: flex-end; }
.fl-chart i { display: flex; flex-direction: column; justify-content: flex-end; width: 100%; min-height: 3px; border-radius: 4px; background: var(--emt); overflow: hidden; }
.fl-chart u { display: block; width: 100%; background: var(--em); }
.fl-legend { display: flex; gap: 12px; font-size: 11px; color: var(--dim); margin-top: 6px; }
.fl-legend span:last-child { margin-left: auto; }
.fl-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
.fl-legend i.a { background: var(--em); }
.fl-legend i.b { background: var(--emt); }
.fl-avg { display: inline-flex; align-items: center; gap: 4px; font-size: 15px; font-weight: 800; color: var(--champ3); }
.fl-pv { background: var(--cream); border-radius: 12px; padding: 10px 12px; }
.fl-pv-row { display: grid; grid-template-columns: 82px 1fr 22px; gap: 8px; align-items: center; font-size: 12.5px; margin-top: 4px; }
.fl-pv-row i { height: 8px; border-radius: 99px; background: #fff; overflow: hidden; display: block; }
.fl-pv-row u { display: block; height: 100%; border-radius: 99px; }
.fl-pv-row b { text-align: right; }
.t-red { background: var(--red); } .t-amber { background: #D99A1E; } .t-green { background: var(--em); } .t-champ { background: var(--champ); }
.fl-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-top: 1px solid var(--line2); }
.fl-item:first-of-type { border-top: 0; }
.fl-item b { font-size: 14.5px; }
.fl-quote { margin: 4px 0 0; font-size: 13.5px; color: var(--ink); line-height: 1.5; background: var(--cream); border-radius: 10px; padding: 8px 10px; }
`;
