/**
 * QR & leads — every flat the owner has on rent, each with the QR for its
 * door and its numbers: leads (QR scans), likes and visits
 * (owner_rent_dashboard in flat_insights.sql). Occupied flats are left out.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronRight, Heart, MessageSquareText, QrCode, ScanLine, Star } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Empty, Loading, Pill, TopBar } from "./ownerUi";
import { QrImage } from "../../components/QrPosterBlock";
import { EMPTY_STATS, fetchRentDashboard, flatUrl } from "../../lib/flatInsights";
import { inr, occupancyOf, op, propertyName } from "../../lib/owners";

export function StatTiles({ s, dark }) {
  const items = [
    { k: "scans", label: "Leads", sub: "QR scans", icon: ScanLine },
    { k: "likes", label: "Likes", icon: Heart },
    { k: "visits", label: "Visits", icon: CalendarCheck },
  ];
  return (
    <div className={`rd-tiles${dark ? " rd-tiles--dark" : ""}`}>
      {items.map(({ k, label, sub, icon: Icon }) => (
        <div key={k}>
          <Icon size={15} />
          <b>{Number(s?.[k]) || 0}</b>
          <span>{label}{sub ? <small> · {sub}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

export default function RentDashboard() {
  const { properties, tenants } = useOwner();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchRentDashboard().then((rows) => setStats(Object.fromEntries(rows.map((r) => [r.property_id, r.stats]))), () => setStats({}));
  }, []);

  const onRent = useMemo(() => (properties ?? [])
    .filter((p) => occupancyOf(p, tenants) !== "occupied")
    .sort((a, b) => (Number(stats?.[b.property_id]?.scans) || 0) - (Number(stats?.[a.property_id]?.scans) || 0)),
  [properties, tenants, stats]);
  const occupied = (properties ?? []).length - onRent.length;
  const total = onRent.reduce((t, p) => {
    const s = stats?.[p.property_id] || EMPTY_STATS;
    return { scans: t.scans + (Number(s.scans) || 0), likes: t.likes + (Number(s.likes) || 0), visits: t.visits + (Number(s.visits) || 0) };
  }, { scans: 0, likes: 0, visits: 0 });

  return (
    <>
      <TopBar title="QR & leads" back={op("/")} />
      <style>{CSS}</style>
      <div className="oz-pad">
        <section className="oz-hero" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--champ)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><QrCode size={15} /> Your flats on rent</div>
            <div style={{ fontSize: 14, opacity: 0.9, margin: "4px 0 12px", lineHeight: 1.45 }}>
              Paste each flat's QR on its door. Anyone passing by scans it, sees the home and books a visit — your number stays private.
            </div>
            <StatTiles s={total} dark />
          </div>
        </section>

        {!properties || !stats ? <Loading /> : onRent.length === 0 ? (
          <Empty icon={<QrCode size={24} />} action={<Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add a flat</Link>}>
            {occupied ? "Every flat is occupied right now. A flat's QR shows up here when it is vacant." : "No flats yet."}
          </Empty>
        ) : (
          <div className="oz-list">
            {onRent.map((p) => {
              const s = stats[p.property_id] || EMPTY_STATS;
              const live = p.status === "published";
              return (
                <div key={p.property_id} className="oz-card rd-card">
                  <div className="rd-top">
                    <Link to={op(`/properties/${p.property_id}/leads`)} className={`rd-qr${live ? "" : " rd-qr--off"}`} aria-label="Open QR and leads">
                      <QrImage url={flatUrl(p.property_id, { qr: true })} size={92} />
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 className="oz-prop-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{propertyName(p)}</h3>
                      <div className="oz-rent" style={{ marginTop: 2 }}>{inr(p.rent)} <small>/ month</small></div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {live ? <Pill tone="green">Live · QR active</Pill> : <Pill tone="amber">Not live yet</Pill>}
                        {Number(s.feedback) > 0 && <Pill tone="champ"><Star size={11} /> {s.rating ?? "–"} · {s.feedback} feedback</Pill>}
                      </div>
                    </div>
                  </div>
                  <StatTiles s={s} />
                  {!live && (
                    <div className="rd-note">The QR opens once the flat is live on MovEazy.{" "}
                      <Link to={op(`/properties/${p.property_id}/find-tenant`)}>Put it live</Link></div>
                  )}
                  <Link to={op(`/properties/${p.property_id}/leads`)} className="oz-btn oz-btn--soft" style={{ width: "100%", marginTop: 10 }}>
                    <MessageSquareText size={16} /> View leads & feedback <ChevronRight size={16} />
                  </Link>
                </div>
              );
            })}
            {occupied > 0 && <p className="oz-hint" style={{ textAlign: "center" }}>{occupied} occupied flat{occupied === 1 ? "" : "s"} not shown.</p>}
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.rd-card { padding: 12px; }
.rd-top { display: flex; gap: 12px; align-items: center; }
.rd-qr { flex: none; padding: 6px; border-radius: 12px; background: #fff; border: 2px solid var(--champ); box-shadow: 0 4px 12px rgba(6,59,45,.10); }
.rd-qr--off { opacity: .45; }
.rd-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
.rd-tiles > div { background: var(--cream); border-radius: 12px; padding: 9px 8px; display: flex; flex-direction: column; gap: 2px; color: var(--deep); }
.rd-tiles svg { color: var(--em); }
.rd-tiles b { font-size: 20px; font-weight: 800; line-height: 1.1; }
.rd-tiles span { font-size: 12px; color: var(--dim); font-weight: 600; }
.rd-tiles small { font-weight: 500; }
.rd-tiles--dark > div { background: rgba(255,255,255,.08); border: 1px solid rgba(214,183,124,.3); color: #fff; }
.rd-tiles--dark svg { color: var(--champ); }
.rd-tiles--dark span { color: rgba(255,255,255,.78); }
.rd-note { margin-top: 10px; background: var(--amberbg); color: var(--amber); border-radius: 10px; padding: 8px 10px; font-size: 12.5px; }
.rd-note a { color: var(--deep); font-weight: 700; }
`;
