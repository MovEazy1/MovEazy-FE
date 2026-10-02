/**
 * PRD 01 — Home. Decisions, not analytics: what the portfolio looks like, and
 * what needs the owner today. No money figures — V1 keeps no rent records, so
 * a "rental income" number would be made up.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, Camera, CheckCircle2, ChevronRight, Home as HomeIcon, IndianRupee, KeyRound, QrCode, TrendingUp, UserPlus, Wrench } from "lucide-react";
import { useOwner } from "./OwnerApp";
import PropertyRow from "./PropertyRow";
import { Avatar, Empty, Loading } from "./ownerUi";
import { fetchActivity, inr, occupancyOf, op, propertyName } from "../../lib/owners";
import { fetchRentDashboard } from "../../lib/flatInsights";
import { daysToLeaseEnd, isCurrentTenant } from "../../lib/ownerOccupancy";
import logo from "../../assets/logo/moveazy-logo-mint-light.png";

const SEEN_KEY = "mz_owner_seen_at";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function OwnerHome() {
  const { me, properties, propError, tenants, requests } = useOwner();
  const [unseen, setUnseen] = useState(0);
  const [rent, setRent] = useState(null);
  useEffect(() => {
    fetchRentDashboard().then((rows) => setRent(rows.reduce((t, r) => ({
      scans: t.scans + (Number(r.stats?.scans) || 0), likes: t.likes + (Number(r.stats?.likes) || 0), visits: t.visits + (Number(r.stats?.visits) || 0),
    }), { scans: 0, likes: 0, visits: 0 })), () => {});
  }, []);

  useEffect(() => {
    let seen = 0;
    try { seen = Number(localStorage.getItem(SEEN_KEY) || 0); } catch { /* ignore */ }
    fetchActivity(14).then((rows) => setUnseen(rows.filter((r) => new Date(r.at).getTime() > seen).length), () => {});
  }, []);

  const list = useMemo(() => properties ?? [], [properties]);
  const occ = useMemo(() => list.map((p) => occupancyOf(p, tenants)), [list, tenants]);
  const occupied = occ.filter((o) => o === "occupied").length;
  const current = tenants.filter(isCurrentTenant);

  const attention = useMemo(() => {
    const items = [];
    for (const q of requests.filter((r) => r.status === "awaiting_approval")) {
      items.push({ key: `q-${q.id}`, icon: IndianRupee, tone: "amber", to: op(`/repairs/${q.id}`),
        title: `Approve a quote of ${inr(q.quote_amount)}`, sub: q.title });
    }
    for (const p of list) {
      const o = occupancyOf(p, tenants);
      if (p.upcoming_visits > 0) {
        items.push({ key: `v-${p.property_id}`, icon: CalendarClock, tone: "green", to: op(`/properties/${p.property_id}/find-tenant`),
          title: `${p.upcoming_visits} visit${p.upcoming_visits > 1 ? "s" : ""} booked`, sub: propertyName(p) });
      }
      if (o === "vacant") {
        items.push({ key: `e-${p.property_id}`, icon: KeyRound, tone: "champ", to: op(`/properties/${p.property_id}/find-tenant`),
          title: "Vacant — find a tenant", sub: `${propertyName(p)} isn't listed yet` });
      }
      if (!(p.images ?? []).length && !p.cover_image_url && o !== "occupied") {
        items.push({ key: `ph-${p.property_id}`, icon: Camera, tone: "grey", to: op(`/properties/${p.property_id}/edit`),
          title: "Add photos", sub: `Flats with photos get far more visits — ${propertyName(p)}` });
      }
    }
    for (const t of tenants.filter(isCurrentTenant)) {
      const d = daysToLeaseEnd(t);
      if (d != null && d >= 0 && d <= 30) {
        items.push({ key: `l-${t.id}`, icon: UserPlus, tone: "amber", to: op(`/tenants/${t.id}`),
          title: `${t.name.split(" ")[0]}'s lease ends in ${d} day${d === 1 ? "" : "s"}`, sub: "Renew, or start finding the next tenant" });
      }
    }
    const working = requests.filter((r) => ["open", "scheduled", "in_progress"].includes(r.status)).length;
    if (working) {
      items.push({ key: "repairs", icon: Wrench, tone: "blue", to: op("/repairs"),
        title: `${working} repair${working > 1 ? "s" : ""} in progress`, sub: "Track them from request to done" });
    }
    return items.slice(0, 6);
  }, [list, tenants, requests]);

  const toneBg = { amber: "var(--amberbg)", green: "var(--emt)", champ: "var(--champ2)", grey: "#EFEDE6", blue: "var(--bluebg)" };
  const toneFg = { amber: "var(--amber)", green: "var(--em)", champ: "var(--champ3)", grey: "var(--dim)", blue: "var(--blue)" };
  const firstVacant = list.find((p) => occupancyOf(p, tenants) !== "occupied");

  return (
    <>
      <header className="oz-top">
        <h1 style={{ margin: 0, lineHeight: 0, flex: 1 }}><img src={logo} alt="MovEazy" style={{ height: 26, width: "auto" }} /></h1>
        <Link to={op("/notifications")} className="oz-iconbtn" aria-label={`Notifications${unseen ? ` (${unseen} new)` : ""}`}>
          <Bell size={21} />
          {unseen > 0 && <span className="oz-badge" style={{ top: 2, right: 2 }}>{unseen > 9 ? "9+" : unseen}</span>}
        </Link>
        <Link to={op("/more")} aria-label="Your profile" style={{ textDecoration: "none" }}><Avatar name={me?.owner?.name || "You"} /></Link>
      </header>

      <div className="oz-pad" style={{ paddingTop: 4 }}>
        <section className="oz-hero" aria-label="Your portfolio">
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 14, opacity: 0.85 }}>{greeting()}, {me?.owner?.name?.split(" ")[0] || "there"}</div>
            <div style={{ fontSize: 13, color: "var(--champ)", marginTop: 10, fontWeight: 600, letterSpacing: ".02em" }}>YOUR PORTFOLIO</div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: "2px 0 2px" }}>
              {properties ? `${list.length} ${list.length === 1 ? "property" : "properties"}` : "…"}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              {occupied} occupied · {list.length - occupied} vacant · {current.length} tenant{current.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="oz-hero-actions">
            <Link to={op("/increase-rent")} className="oz-hero-action"><span className="ic"><TrendingUp size={19} /></span>Increase Rent</Link>
            <Link to={firstVacant ? op(`/properties/${firstVacant.property_id}/find-tenant`) : op("/properties")} className="oz-hero-action">
              <span className="ic"><KeyRound size={19} /></span>Find a Tenant
            </Link>
            <Link to={op("/repairs")} className="oz-hero-action"><span className="ic"><Wrench size={19} /></span>Manage Repairs</Link>
          </div>
        </section>
      </div>

      {properties && list.some((p) => occupancyOf(p, tenants) !== "occupied") && (
        <div className="oz-pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <Link to={op("/rent-dashboard")} className="oz-card oz-row" style={{ padding: 12, textDecoration: "none", color: "inherit",
            background: "linear-gradient(135deg, #fff, var(--champ2))", borderColor: "#EADFC6" }}>
            <span className="oz-avatar" style={{ background: "var(--deep)", color: "var(--champ)", borderRadius: 12 }}><QrCode size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block" }}>QR & leads</strong>
              <span className="oz-meta">{rent ? `${rent.scans} leads · ${rent.likes} likes · ${rent.visits} visits` : "A QR for every flat on rent"}</span>
            </span>
            <ChevronRight size={18} color="#94A09B" />
          </Link>
        </div>
      )}

      {properties && list.length > 0 && (
        <div className="oz-pad" style={{ paddingTop: 4 }}>
          <h2 className="oz-h2">Needs your attention</h2>
          {attention.length === 0 ? (
            <div className="oz-card oz-row" style={{ padding: 14 }}>
              <CheckCircle2 size={22} color="var(--em)" />
              <span><strong style={{ display: "block" }}>You're all caught up</strong><span className="oz-meta">Nothing waiting on you today.</span></span>
            </div>
          ) : (
            <div className="oz-card">
              {attention.map((a) => (
                <Link key={a.key} to={a.to} className="oz-menurow">
                  <span className="oz-avatar" style={{ background: toneBg[a.tone], color: toneFg[a.tone] }}><a.icon size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{a.title}</strong><span className="oz-sub">{a.sub}</span></span>
                  <ChevronRight size={18} color="#94A09B" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="oz-pad">
        <div className="oz-between" style={{ marginBottom: 10 }}>
          <h2 className="oz-h2" style={{ margin: 0 }}>My Properties</h2>
          {list.length > 3 && <Link to={op("/properties")} className="oz-btn oz-btn--ghost">View All <ChevronRight size={16} /></Link>}
        </div>
        {!properties ? <Loading /> : propError ? <Empty>{propError}</Empty> : list.length === 0 ? (
          <Empty icon={<HomeIcon size={24} />} action={<Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add your first property</Link>}>
            Add a flat you own to manage its tenants, find the next one, and book repairs.
            <br /><span className="oz-hint">Already listed a flat with MovEazy's team? Message us and we'll link it to your account.</span>
          </Empty>
        ) : (
          <div className="oz-list">
            {list.slice(0, 3).map((p) => <PropertyRow key={p.property_id} property={p} tenants={tenants} />)}
          </div>
        )}
      </div>
    </>
  );
}
