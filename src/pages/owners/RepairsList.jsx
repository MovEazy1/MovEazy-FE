/** PRD 09 — every repair, service booking and designer call, request to resolution. */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Wrench } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { ServiceIcon } from "./serviceIcons";
import { Empty, Pill, TopBar } from "./ownerUi";
import { REQUEST_STATUS, fmtDate, inr, op, propertyName, requestBucket } from "../../lib/owners";

const TABS = [["all", "All"], ["open", "Open"], ["in_progress", "In Progress"], ["resolved", "Resolved"]];

export default function RepairsList() {
  const [params] = useSearchParams();
  const only = params.get("property") || "";
  const { requests, byId } = useOwner();
  const [tab, setTab] = useState("all");

  const scoped = useMemo(() => requests.filter((r) => !only || r.property_id === only || (r.property_ids ?? []).includes(only)), [requests, only]);
  const rows = scoped.filter((r) => tab === "all" || requestBucket(r.status) === tab);
  const count = (k) => (k === "all" ? scoped.length : scoped.filter((r) => requestBucket(r.status) === k).length);

  return (
    <>
      <TopBar title="Repairs & Maintenance" back right={
        <Link to={op(`/repairs/new${only ? `?property=${only}` : ""}`)} className="oz-btn oz-btn--primary oz-btn--sm"><Plus size={16} /> New Request</Link>
      } />
      <div className="oz-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`oz-tab${tab === k ? " oz-tab--on" : ""}`}
            onClick={() => setTab(k)}>{label} ({count(k)})</button>
        ))}
      </div>
      <div className="oz-pad oz-list">
        {rows.length === 0 ? (
          <Empty icon={<Wrench size={22} />} action={<Link to={op(`/repairs/new${only ? `?property=${only}` : ""}`)} className="oz-btn oz-btn--primary">Raise a repair</Link>}>
            {scoped.length ? "Nothing here." : "No repairs yet. When something breaks, raise it here and MovEazy sends a verified professional."}
          </Empty>
        ) : rows.map((r) => {
          const p = byId.get(r.property_id);
          const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.open;
          return (
            <Link key={r.id} to={op(`/repairs/${r.id}`)} className="oz-card oz-row"
              style={{ padding: 12, color: "inherit", textDecoration: "none", ...(r.status === "awaiting_approval" ? { borderColor: "#F2D99A" } : {}) }}>
              <span className="oz-svc-ic" style={{ width: 50, height: 50 }}><ServiceIcon id={r.service_id} category={r.category} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 15 }}>{r.title}</strong>
                <span className="oz-meta" style={{ display: "block" }}>
                  {r.kind === "designer_call" && (r.property_ids ?? []).length > 1 ? `${r.property_ids.length} properties` : p ? propertyName(p) : r.property_id}
                </span>
                <span className="oz-hint">{fmtDate(r.created_at)}{r.status === "awaiting_approval" && r.quote_amount ? ` · quote ${inr(r.quote_amount)}` : ""}</span>
              </span>
              <Pill tone={st.tone}>{st.label}</Pill>
            </Link>
          );
        })}
      </div>
    </>
  );
}
