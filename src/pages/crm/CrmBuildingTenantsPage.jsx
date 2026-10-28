/**
 * CRM → a building's tenants (the bar on the CRM's home opens it): add a
 * tenant, and every tenant — added by the team or whose number came from the
 * QR page — with the numbers on top, Call / WhatsApp, and their status and
 * follow-up day to update (building_tenants_board.sql). The building's owner
 * sees the same list in the owner app.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Btn, Empty, Toast } from "./crmUi";
import { TenantTrackSheet } from "./CrmTenantTracker";
import BuildingTenantsBoard from "../../components/BuildingTenantsBoard";
import { fetchBuildingTenants } from "../../lib/crmPropertyInternal";

export default function CrmBuildingTenantsPage() {
  const { id } = useParams();
  const [d, setD] = useState(undefined);
  const [editing, setEditing] = useState(null); // {} new, or { phone, name, track }
  const [toast, setToast] = useState(null);
  const load = useCallback(() => fetchBuildingTenants(id).then((r) => setD(r || null), (e) => { setD(null); setToast({ message: e?.message || "Couldn't load", tone: "error" }); }), [id]);
  useEffect(() => { load(); }, [load]);

  if (d === undefined) return <Empty>Loading…</Empty>;
  if (!d) return <Empty>That building isn't there. <Link to="/crm/home">Back</Link></Empty>;
  const b = d.building;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">{b.name} · tenants</span>
        <div style={{ display: "flex", gap: 6 }}>
          <Link className="crm-btn" to={`/crm/buildings/${b.id}`}>Building</Link>
        </div>
      </div>
      <div className="crm-scroll" style={{ flex: 1, padding: 16 }}>
        <div style={{ maxWidth: 760 }}>
          {b.enabled ? (
            <Btn variant="primary" onClick={() => setEditing({})} style={{ width: "100%", padding: "12px 14px", fontSize: 14.5 }}>
              <Plus size={17} /> Add tenant
            </Btn>
          ) : <div className="crm-mute" style={{ fontSize: 12.5 }}>This building doesn't track tenants yet.</div>}
          <BuildingTenantsBoard tenants={d.tenants ?? []} onUpdate={b.enabled ? (x) => setEditing(x.track || {
            phone: x.phone, name: x.name, ...(x.status ?? {}), property_ids: (x.views ?? []).map((v) => v.property_id),
          }) : undefined} />
        </div>
      </div>
      {editing && (
        <TenantTrackSheet buildingId={b.id} flats={d.flats ?? []} track={editing} reasons={d.reasons ?? []}
          onClose={() => setEditing(null)} onReasonsChange={load}
          onSaved={(t) => {
            setEditing(null);
            load();
            setToast({ message: `Saved · ${t.name || t.phone}` });
            setTimeout(() => setToast(null), 2600);
          }} />
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
