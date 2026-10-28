/**
 * CRM → Tenant views: every tenant we can name who opened a property — from a
 * link we sent on WhatsApp, the website or a QR — across all properties, to
 * work through: filter (no response yet, follow-up due, liked, did not like),
 * Call / WhatsApp, and mark how it went (tenant_views.sql). The same answer
 * shows on the property, the client and, without the number, the owner's app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { C, Chip, Empty, Toast } from "./crmUi";
import { TenantViewRow, TenantViewSheet, propertyLine } from "./CrmTenantViews";
import { VIEW_FILTERS, fetchTenantViews, istDay } from "../../lib/tenantViews";
import { waLink } from "../../lib/partners";

export default function CrmTenantViewsPage() {
  const [d, setD] = useState(undefined);
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState(null);
  const load = useCallback(() => fetchTenantViews().then(setD, (e) => { setD(null); setToast({ message: e?.message || "Couldn't load", tone: "error" }); }), []);
  useEffect(() => { load(); }, [load]);

  const today = istDay();
  const views = useMemo(() => d?.views ?? [], [d]);
  const counts = useMemo(() => Object.fromEntries(VIEW_FILTERS.map((f) => [f.id, views.filter((v) => f.test(v, today)).length])), [views, today]);
  const shown = useMemo(() => {
    const test = VIEW_FILTERS.find((f) => f.id === filter)?.test ?? (() => true);
    const needle = q.trim().toLowerCase();
    return views.filter((v) => test(v, today)).filter((v) => !needle
      || [v.client?.name, v.client?.phone, v.property_id, v.property?.area, v.property?.building].some((x) => String(x || "").toLowerCase().includes(needle)));
  }, [views, filter, q, today]);

  if (d === undefined) return <Empty>Loading…</Empty>;
  if (!d) return <Empty>Couldn&apos;t load tenant views.</Empty>;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">Tenant views · {views.length}</span>
      </div>
      <div className="crm-scroll" style={{ flex: 1, padding: 16 }}>
        <div style={{ maxWidth: 760, display: "grid", gap: 12 }}>
          <p className="crm-mute" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            Everyone we can name who opened a property — a link we sent, the website, or a QR. Mark how it went: it shows on the
            property and the client, the owner sees it without the number, and it&apos;s kept for scoring properties.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {VIEW_FILTERS.map((f) => (
              <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} · {counts[f.id]}</Chip>
            ))}
          </div>
          <input className="crm-input" placeholder="Search name, mobile, property, area" value={q} onChange={(e) => setQ(e.target.value)} />
          {shown.length === 0 && <Empty pad={16}>Nobody here.</Empty>}
          {shown.map((v) => (
            <div key={v.id} style={{ display: "grid", gap: 4 }}>
              <TenantViewRow v={v} title={`${v.client?.name || "Tenant"} · ${v.property_id}`} sub={propertyLine(v.property)} onOpen={setOpen} />
              <div style={{ display: "flex", gap: 10, fontSize: 12, paddingLeft: 4 }}>
                {v.client?.phone && (
                  <>
                    <a href={`tel:+91${v.client.phone}`} style={{ color: C.accent, fontWeight: 600, display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <Phone size={12} /> {v.client.phone}
                    </a>
                    <a href={waLink(v.client.phone, `Hi ${v.client.name || ""}, this is MovEazy — how did you find the flat ${v.property_id}?`)}
                      target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 600 }}>WhatsApp</a>
                  </>
                )}
                <Link to={`/crm/clients?client=${v.client_id}`} style={{ color: C.textDim }}>Client</Link>
                <Link to={`/crm/properties/${encodeURIComponent(v.property_id)}/edit`} style={{ color: C.textDim }}>Property</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      {open && (
        <TenantViewSheet view={open} title={`${open.client?.name || "Tenant"} · ${open.property_id}`}
          sub={[open.client?.phone, propertyLine(open.property)].filter(Boolean).join(" · ")}
          reasons={d.reasons ?? []} onClose={() => setOpen(null)} onReasonsChange={load}
          onSaved={(saved) => {
            setOpen(null);
            setD((cur) => ({ ...cur, views: cur.views.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)) }));
            setToast({ message: "Response saved" });
            setTimeout(() => setToast(null), 2400);
          }} />
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
