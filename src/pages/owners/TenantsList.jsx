/**
 * PRD 04 — the tenant roster, across the portfolio or for one flat
 * (?property=). The PRD's rent and next-due fields are gone (no rent records
 * in V1); the card shows who they are, since when, and when the lease ends.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Phone, Plus, Search, Star, User } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Empty, Pill, Stars, TopBar, WhatsAppIcon } from "./ownerUi";
import { fmtDate, op, propertyName, telLink, waLink } from "../../lib/owners";
import { daysToLeaseEnd, isCurrentTenant, tenancyLength } from "../../lib/ownerOccupancy";

export function TenantCard({ t, rating }) {
  const d = daysToLeaseEnd(t);
  const current = isCurrentTenant(t);
  return (
    <div className="oz-card">
      <Link to={op(`/tenants/${t.id}`)} className="oz-row" style={{ padding: 14, color: "inherit", textDecoration: "none", alignItems: "flex-start" }}>
        <Avatar name={t.name} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="oz-between" style={{ alignItems: "flex-start" }}>
            <strong style={{ fontSize: 16 }}>{t.name}</strong>
            {current ? <Pill tone="green">Active</Pill> : <Pill tone="grey">Moved out</Pill>}
          </div>
          {(t.occupation || t.company) && <div className="oz-meta">{[t.occupation, t.company].filter(Boolean).join(" · ")}</div>}
          <div className="oz-meta" style={{ marginTop: 2 }}>
            {t.move_in_date ? `Since ${fmtDate(t.move_in_date, { month: "short", year: "numeric" })}${current ? ` · ${tenancyLength(t)}` : ""}` : "Move-in date not added"}
          </div>
          {current && t.lease_end_date && (
            <div style={{ fontSize: 13, marginTop: 2, color: d != null && d <= 30 ? "var(--amber)" : "var(--dim)", fontWeight: d != null && d <= 30 ? 600 : 400 }}>
              Lease ends {fmtDate(t.lease_end_date)}{d != null && d >= 0 && d <= 30 ? ` · in ${d} day${d === 1 ? "" : "s"}` : ""}
            </div>
          )}
          {rating && <div style={{ marginTop: 4 }}><Stars value={rating.stars} size={14} /></div>}
        </div>
      </Link>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderTop: "1px solid var(--line2)" }}>
        <Link to={op(`/tenants/${t.id}`)} className="oz-tile" style={{ border: 0, borderRadius: 0 }}><User size={18} />Profile</Link>
        <a href={telLink(t.phone)} className="oz-tile" style={{ border: 0, borderRadius: 0, opacity: t.phone ? 1 : 0.4 }}
          aria-disabled={!t.phone}><Phone size={18} />Call</a>
        <a href={waLink(t.phone, `Hi ${t.name.split(" ")[0]}, `)} target="_blank" rel="noreferrer" className="oz-tile"
          style={{ border: 0, borderRadius: 0, opacity: t.phone ? 1 : 0.4 }}><WhatsAppIcon size={18} />WhatsApp</a>
        <Link to={op(`/tenants/${t.id}#rate`)} className="oz-tile" style={{ border: 0, borderRadius: 0 }}><Star size={18} />Rate</Link>
      </div>
    </div>
  );
}

export default function TenantsList() {
  const [params] = useSearchParams();
  const only = params.get("property") || "";
  const { tenants, byId, ratings, properties } = useOwner();
  const [tab, setTab] = useState("current");
  const [q, setQ] = useState("");
  const scoped = only ? byId.get(only) : null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants.filter((t) => {
      if (only && t.property_id !== only) return false;
      if (tab === "current" ? !isCurrentTenant(t) : isCurrentTenant(t)) return false;
      return !needle || [t.name, t.phone, t.company, t.occupation].join(" ").toLowerCase().includes(needle);
    });
  }, [tenants, only, tab, q]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const t of rows) {
      if (!m.has(t.property_id)) m.set(t.property_id, []);
      m.get(t.property_id).push(t);
    }
    return [...m.entries()];
  }, [rows]);

  const count = (k) => tenants.filter((t) => (!only || t.property_id === only) && (k === "current" ? isCurrentTenant(t) : !isCurrentTenant(t))).length;
  const addTo = only ? `?property=${only}` : "";

  return (
    <>
      <TopBar title={scoped ? propertyName(scoped) : "My Tenants"} back={only ? op(`/properties/${only}`) : undefined} right={
        (properties ?? []).length > 0 && <Link to={op(`/tenants/new${addTo}`)} className="oz-btn oz-btn--primary oz-btn--sm"><Plus size={16} /> Add</Link>
      } />
      <div className="oz-tabs" role="tablist">
        {[["current", "Current"], ["past", "Past"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`oz-tab${tab === k ? " oz-tab--on" : ""}`}
            onClick={() => setTab(k)}>{label} ({count(k)})</button>
        ))}
      </div>
      <div className="oz-pad">
        {tenants.length > 4 && (
          <div className="oz-search" style={{ marginBottom: 12 }}>
            <Search size={17} />
            <input className="oz-input" type="search" placeholder="Search by name, phone or company…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        {(properties ?? []).length === 0 ? (
          <Empty action={<Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add a property</Link>}>Add a property first, then its tenants.</Empty>
        ) : rows.length === 0 ? (
          <Empty action={tab === "current" ? <Link to={op(`/tenants/new${addTo}`)} className="oz-btn oz-btn--primary"><Plus size={16} /> Add a tenant</Link> : null}>
            {tab === "current" ? "No current tenants added yet." : "No past tenants yet."}
          </Empty>
        ) : groups.map(([pid, list]) => (
          <div key={pid} style={{ marginBottom: 18 }}>
            {!only && <div className="oz-label" style={{ color: "var(--dim)" }}>{byId.get(pid) ? propertyName(byId.get(pid)) : pid}</div>}
            <div className="oz-list">{list.map((t) => <TenantCard key={t.id} t={t} rating={ratings[t.id]} />)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
