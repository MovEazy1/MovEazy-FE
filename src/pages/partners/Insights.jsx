/**
 * Leads dashboard — what a broker's QR posters and curated lists are bringing
 * in: new leads, QR scans (by day and by the area each poster is pasted in),
 * how lists perform, the homes tenants like most, and every like and skip as
 * it happens. Reads partner_insights() (partner_launch.sql § 10).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MapPin, QrCode, RefreshCw, Sparkles, ThumbsDown, TrendingUp, UserPlus } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Loading, TopBar } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { friendlyError, inr, pp } from "../../lib/partners";
import { fetchInsights } from "../../lib/storefront";

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

export default function Insights() {
  const navigate = useNavigate();
  const { demo, explain } = usePartner();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const load = () => fetchInsights().then((x) => { setD(x); setErr(""); }, (e) => setErr(friendlyError(e, "Could not load your dashboard.")));
  useEffect(() => { if (demo) explain("insights"); else load(); }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (demo) {
    return <><TopBar title="Leads dashboard" back /><div className="pz-pad"><p className="pz-meta">Your leads dashboard comes with Premium.</p></div></>;
  }
  if (!d) return <><TopBar title="Leads dashboard" back />{err ? <div className="pz-pad pz-err">{err}</div> : <Loading />}</>;

  const days = d.by_day || [];
  const peak = Math.max(1, ...days.map((x) => x.visits));
  const areaPeak = Math.max(1, ...(d.by_area || []).map((a) => Number(a.scans)));
  const lists = d.lists || {};
  const seen = Number(lists.liked) + Number(lists.skipped);
  const likeRate = seen ? Math.round((Number(lists.liked) / seen) * 100) : null;

  return (
    <>
      <TopBar title="Leads dashboard" back right={<button type="button" className="pz-iconbtn" aria-label="Refresh" onClick={load}><RefreshCw size={19} /></button>} />
      <style>{CSS}</style>
      <div className="pz-pad">
        <div className="ins-kpis">
          <div className="k gold"><UserPlus size={16} /><b>{d.leads?.new_week ?? 0}</b><span>new leads · 7 days</span></div>
          <div className="k noir"><QrCode size={16} /><b>{d.scans_week ?? 0}</b><span>QR scans · 7 days</span></div>
          <div className="k ai"><Sparkles size={16} /><b>{lists.opened ?? 0}/{lists.sent ?? 0}</b><span>lists opened</span></div>
          <div className="k em"><Heart size={16} /><b>{likeRate == null ? "—" : `${likeRate}%`}</b><span>homes liked</span></div>
        </div>

        <section className="pz-section">
          <h2>Last 14 days <span className="pz-meta" style={{ fontWeight: 500 }}><i className="ins-key" /> QR scans <i className="ins-key v" /> all visits</span></h2>
          <div className="ins-bars">
            {days.map((x) => (
              <div key={x.day} className="ins-bar" title={`${x.visits} visits, ${x.scans} QR scans`}>
                <div className="col" style={{ height: `${(x.visits / peak) * 100}%` }}><div className="scan" style={{ height: x.visits ? `${(x.scans / x.visits) * 100}%` : 0 }} /></div>
                <span>{new Date(`${x.day}T00:00:00`).getDate()}</span>
              </div>
            ))}
          </div>
          <p className="pz-hint" style={{ margin: "8px 0 0" }}>{d.scans_total ?? 0} QR scans all time · {d.visitors_week ?? 0} visitors this week</p>
        </section>

        <section className="pz-section">
          <h2><span><MapPin size={15} style={{ verticalAlign: -2 }} /> Where the scans come from</span><Link to={pp("/qr")} className="pz-btn pz-btn--ghost">Posters</Link></h2>
          {(d.by_area || []).length === 0 ? (
            <p className="pz-meta" style={{ margin: 0 }}>No scans yet. Make a poster for each place you paste one (My QR → Poster spots) and scans show up here by area.</p>
          ) : (d.by_area || []).map((a) => (
            <div key={a.area} className="ins-area">
              <span className="n">{a.area}</span>
              <span className="track"><i style={{ width: `${(Number(a.scans) / areaPeak) * 100}%` }} /></span>
              <b>{a.scans}</b>
            </div>
          ))}
          {(d.by_area || []).some((a) => a.area === "Not tagged") && <p className="pz-hint" style={{ margin: "6px 0 0" }}>“Not tagged” = scans of a poster made without a spot.</p>}
        </section>

        <section className="pz-section" style={{ padding: 0 }}>
          <h2 style={{ padding: "14px 14px 0" }}><span><TrendingUp size={15} style={{ verticalAlign: -2 }} /> What your tenants like</span></h2>
          {(d.top_liked || []).length === 0 ? <p className="pz-meta" style={{ padding: "0 14px 14px", margin: 0 }}>Send curated lists from the AI Property Matcher — likes show up here.</p>
            : d.top_liked.map((h) => (
              <Link key={h.property_id} to={pp(`/property/${h.property_id}`)} className="pz-row ins-home">
                <div className="th"><SmartListingImage listing={h} /></div>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14.5 }}>{[h.flat_type, h.area].filter(Boolean).join(" · ")}</strong>
                  <span className="pz-meta">{inr(h.rent)} / month</span>
                </span>
                <span className="ins-lk"><Heart size={13} fill="#E11D48" color="#E11D48" /> {h.likes}{Number(h.skips) ? <em><ThumbsDown size={12} /> {h.skips}</em> : null}</span>
              </Link>
            ))}
        </section>

        <section className="pz-section" style={{ padding: 0 }}>
          <h2 style={{ padding: "14px 14px 0" }}>Client activity</h2>
          {(d.activity || []).length === 0 ? <p className="pz-meta" style={{ padding: "0 14px 14px", margin: 0 }}>Every like and skip from your clients appears here.</p>
            : d.activity.map((e, i) => (
              <button key={i} type="button" className="pz-menurow" onClick={() => e.link && navigate(pp(e.link))}>
                <span className="pz-avatar" style={{ background: e.kind === "liked" ? "#FDE7EC" : "#F1EFEA", color: e.kind === "liked" ? "#E11D48" : "#6B6776" }}>
                  {e.kind === "liked" ? <Heart size={15} fill="#E11D48" /> : <ThumbsDown size={15} />}
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: 14 }}>{e.who} {e.kind === "liked" ? "liked" : "skipped"} {[e.flat_type, e.area].filter(Boolean).join(" · ")}</strong>
                  <span className="pz-meta">{e.via === "qr" ? "on your QR page" : "on your curated list"}{e.phone ? ` · ${e.phone}` : ""}</span>
                </span>
                <span className="pz-hint">{ago(e.at)}</span>
              </button>
            ))}
        </section>
      </div>
    </>
  );
}

const CSS = `
.ins-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.ins-kpis .k { border-radius: 16px; padding: 12px 14px; display: grid; gap: 2px; }
.ins-kpis .k b { font-size: 24px; letter-spacing: -0.02em; }
.ins-kpis .k span { font-size: 12px; opacity: .8; }
.ins-kpis .gold { background: var(--goldg); color: #1F1605; }
.ins-kpis .noir { background: var(--noir); color: #fff; }
.ins-kpis .ai { background: var(--aig); color: #fff; }
.ins-kpis .em { background: linear-gradient(135deg, #0B6E4F, #073D2C); color: #fff; }
.ins-key { display: inline-block; width: 9px; height: 9px; border-radius: 3px; background: var(--noir); margin: 0 3px 0 8px; }
.ins-key.v { background: var(--gold2); }
.ins-bars { display: flex; gap: 5px; align-items: flex-end; height: 110px; }
.ins-bar { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; }
.ins-bar span { font-size: 10px; color: var(--dim); text-align: center; }
.ins-bar .col { background: var(--gold2); border-radius: 5px; min-height: 3px; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.ins-bar .scan { background: var(--noir); }
.ins-area { display: grid; grid-template-columns: minmax(90px, 38%) 1fr 34px; gap: 10px; align-items: center; padding: 6px 0; font-size: 14px; }
.ins-area .n { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ins-area .track { height: 10px; border-radius: 99px; background: #F1EFEA; overflow: hidden; }
.ins-area .track i { display: block; height: 100%; border-radius: 99px; background: var(--goldg); }
.ins-area b { text-align: right; }
.ins-home { padding: 10px 14px; border-top: 1px solid var(--line); color: inherit; text-decoration: none; }
.ins-home .th { width: 56px; height: 46px; border-radius: 8px; overflow: hidden; background: #E9E6DF; flex: none; }
.ins-home .th img, .ins-home .th video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.ins-lk { display: grid; justify-items: end; gap: 2px; font-weight: 800; color: #E11D48; font-size: 13px; }
.ins-lk em { font-style: normal; color: var(--dim); font-weight: 600; font-size: 12px; display: inline-flex; gap: 3px; align-items: center; }
`;
