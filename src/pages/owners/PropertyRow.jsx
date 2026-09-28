/** The compact property card used on Home and the Properties list (PRD 01/02). */
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { OCCUPANCY_PILL, Pill, PropertyThumb } from "./ownerUi";
import { inr, occupancyOf, op, propertyName } from "../../lib/owners";
import { isCurrentTenant, occupancyPct } from "../../lib/ownerOccupancy";

export function propertyTenants(p, tenants) {
  return tenants.filter((t) => t.property_id === p.property_id);
}

export default function PropertyRow({ property: p, tenants = [], showCta = true }) {
  const navigate = useNavigate();
  const mine = propertyTenants(p, tenants);
  const current = mine.filter(isCurrentTenant);
  const occ = occupancyOf(p, tenants);
  const pct = occupancyPct(mine);
  const pill = OCCUPANCY_PILL[occ];
  const line = occ === "occupied"
    ? `Occupied · ${current.length || "no"} tenant${current.length === 1 ? "" : "s"} added`
    : occ === "listed" ? `Live on MovEazy${p.upcoming_visits ? ` · ${p.upcoming_visits} visit${p.upcoming_visits > 1 ? "s" : ""} booked` : ""}`
      : "Vacant";

  return (
    <div className="oz-card">
      <Link to={op(`/properties/${p.property_id}`)} className="oz-prop">
        <PropertyThumb property={p} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="oz-prop-title">{propertyName(p)}</h3>
          <div className="oz-rent" style={{ marginTop: 2 }}>{inr(p.rent)} <small>/ month</small></div>
          <div className="oz-meta" style={{ marginTop: 2 }}>{line}</div>
          <div className="oz-chips" style={{ marginTop: 6, gap: 6 }}>
            {occ === "occupied" && pct != null
              ? <Pill tone="green">{pct}% occupancy</Pill>
              : <Pill tone={pill.tone}>{pill.label}</Pill>}
            {p.open_requests > 0 && <Pill tone="red">{p.open_requests} open repair{p.open_requests > 1 ? "s" : ""}</Pill>}
          </div>
        </div>
        <ChevronRight size={20} color="#94A09B" />
      </Link>
      {showCta && occ !== "occupied" && (
        <div style={{ padding: "0 10px 10px" }}>
          <button type="button" className="oz-btn oz-btn--champ" style={{ width: "100%" }}
            onClick={() => navigate(op(`/properties/${p.property_id}/find-tenant`))}>
            {occ === "listed" ? "Candidates & visit times" : "Find a Tenant"}
          </button>
        </div>
      )}
    </div>
  );
}
