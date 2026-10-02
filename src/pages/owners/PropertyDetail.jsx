/**
 * PRD 03 — the operational centre for one flat. Financials from the PRD are
 * left out (no rent records in V1); the tiles are Tenants, Find a Tenant,
 * Repairs and Increase Rent instead.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, ChevronRight, ExternalLink, FileText, KeyRound, MapPin, MoreVertical, Pencil, Ruler, TrendingUp,
  UserPlus, Users, Wrench,
} from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Confirm, Empty, Loading, OCCUPANCY_PILL, Pill, Sheet, TopBar, toast } from "./ownerUi";
import { MediaItem, listingMedia } from "../partners/partnerMedia";
import {
  REQUEST_STATUS, bhkLabel, fmtDate, friendlyError, inr, occupancyOf, op, ownerListingLink, updateProperty,
} from "../../lib/owners";
import { financialYear, isCurrentTenant, occupancyPct, tenancyLength } from "../../lib/ownerOccupancy";
import { QrImage } from "../../components/QrPosterBlock";
import { flatUrl } from "../../lib/flatInsights";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, properties, tenants, requests, reloadProperties } = useOwner();
  const p = byId.get(id);
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => tenants.filter((t) => t.property_id === id), [tenants, id]);
  const current = mine.filter(isCurrentTenant);
  const reqs = requests.filter((r) => r.property_id === id || (r.property_ids ?? []).includes(id));
  const openReqs = reqs.filter((r) => !["resolved", "cancelled"].includes(r.status));

  if (!properties) return <><TopBar back /><Loading /></>;
  if (!p) {
    return (
      <>
        <TopBar title="Property" back={op("/properties")} />
        <Empty action={<Link to={op("/properties")} className="oz-btn oz-btn--primary">Back to properties</Link>}>
          This property isn't in your account.
        </Empty>
      </>
    );
  }

  const media = listingMedia(p);
  const occ = occupancyOf(p, tenants);
  const pct = occupancyPct(mine);
  const fy = financialYear();
  const since = current.map((t) => t.move_in_date).filter(Boolean).sort()[0];

  const setStatus = async (status, message) => {
    setBusy(true);
    try {
      await updateProperty(id, { status });
      await reloadProperties();
      toast(message);
      setConfirm(null);
      setMenu(false);
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { to: op(`/tenants?property=${id}`), icon: Users, label: "Tenants", badge: current.length || null },
    occ === "occupied"
      ? { to: op(`/tenants/new?property=${id}`), icon: UserPlus, label: "Add Tenant" }
      : { to: op(`/properties/${id}/find-tenant`), icon: KeyRound, label: "Find a Tenant", badge: p.upcoming_visits || null },
    { to: op(`/repairs?property=${id}`), icon: Wrench, label: "Repairs", badge: openReqs.length || null },
    { to: op(`/increase-rent?property=${id}`), icon: TrendingUp, label: "Increase Rent" },
  ];

  return (
    <>
      <TopBar back={op("/properties")} right={
        <button type="button" className="oz-iconbtn" aria-label="More actions" onClick={() => setMenu(true)}><MoreVertical size={21} /></button>
      }>
        <span style={{ flex: 1 }} />
      </TopBar>

      <div className="oz-pad" style={{ paddingTop: 0 }}>
        <div style={{ position: "relative" }}>
          {media.length ? (
            <div className="oz-gallery" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
              {media.map((src) => <div key={src}><MediaItem src={src} /></div>)}
            </div>
          ) : (
            <Link to={op(`/properties/${id}/edit`)} className="oz-gallery" style={{ display: "grid", placeItems: "center", color: "var(--dim)", textDecoration: "none" }}>
              Add photos
            </Link>
          )}
          {media.length > 1 && (
            <span className="oz-pill" style={{ position: "absolute", right: 12, bottom: 12, background: "rgba(4,31,23,.72)", color: "#fff" }}>
              {slide + 1}/{media.length}
            </span>
          )}
        </div>

        <div className="oz-between" style={{ marginTop: 14, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 21, margin: 0 }}>{bhkLabel(p)} in {p.area}</h2>
            {(p.full_address || p.area) && (
              <div className="oz-meta oz-row" style={{ gap: 5, marginTop: 4 }}>
                <MapPin size={14} /> {[p.full_address, p.area, "Bengaluru"].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <Link to={op(`/properties/${id}/edit`)} className="oz-btn oz-btn--champ oz-btn--sm"><Pencil size={14} /> Edit</Link>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, margin: "10px 0 8px" }}>{inr(p.rent)} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--dim)" }}>/ month</span></div>
        <div className="oz-chips" style={{ gap: 6 }}>
          <Pill tone={OCCUPANCY_PILL[occ].tone}>{OCCUPANCY_PILL[occ].label}</Pill>
          {current.length > 0 && <Pill tone="grey"><Users size={12} /> {current.length} tenant{current.length > 1 ? "s" : ""}</Pill>}
          {p.area_sqft && <Pill tone="grey"><Ruler size={12} /> {Number(p.area_sqft).toLocaleString("en-IN")} sq ft</Pill>}
          {p.property_type && <Pill tone="grey">{p.property_type}</Pill>}
          {p.furnishing && <Pill tone="grey">{p.furnishing}</Pill>}
          {occ === "occupied" && since && <Pill tone="grey"><CalendarDays size={12} /> Occupied since {fmtDate(since, { month: "short", year: "numeric" })}</Pill>}
          {occ !== "occupied" && p.available_from && <Pill tone="grey">Available from {fmtDate(p.available_from, { day: "numeric", month: "short" })}</Pill>}
        </div>

        {occ !== "occupied" && (
          <Link to={op(`/properties/${id}/leads`)} className="oz-card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, marginTop: 14, textDecoration: "none", color: "inherit" }}>
            <span style={{ padding: 4, borderRadius: 10, border: "2px solid var(--champ)", background: "#fff", flex: "none" }}>
              <QrImage url={flatUrl(id, { qr: true })} size={60} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 15 }}>QR & leads</strong>
              <span className="oz-meta">Poster for the door · leads, likes, visits and what renters say</span>
            </span>
            <ChevronRight size={18} color="#94A09B" />
          </Link>
        )}

        <div className="oz-tiles" style={{ margin: "16px 0" }}>
          {tiles.map((t) => (
            <Link key={t.label} to={t.to} className="oz-tile">
              <span className="ic"><t.icon size={18} /></span>{t.label}
              {t.badge ? <span className="oz-badge">{t.badge}</span> : null}
            </Link>
          ))}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Tenants
            <Link to={op(`/tenants/new?property=${id}`)} className="oz-btn oz-btn--ghost"><UserPlus size={15} /> Add Tenant</Link>
          </h2>
          {current.length === 0 ? (
            <p className="oz-meta" style={{ margin: 0 }}>
              {occ === "occupied" ? "Add who lives here to keep their details and agreement in one place." : "No one lives here right now."}
            </p>
          ) : current.slice(0, 3).map((t) => (
            <Link key={t.id} to={op(`/tenants/${t.id}`)} className="oz-row" style={{ padding: "8px 0", color: "inherit", textDecoration: "none" }}>
              <Avatar name={t.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block" }}>{t.name}</strong>
                <span className="oz-meta">{[t.occupation, t.company].filter(Boolean).join(" · ") || (t.move_in_date ? `Since ${fmtDate(t.move_in_date, { month: "short", year: "numeric" })}` : "Tenant")}</span>
              </span>
              <ChevronRight size={18} color="#94A09B" />
            </Link>
          ))}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">This year <span className="oz-hint">{fy.label}</span></h2>
          <div className="oz-grid2">
            <div className="oz-stat"><b>{pct == null ? "—" : `${pct}%`}</b><span>Occupancy{pct == null ? " (add move-in dates)" : ""}</span></div>
            <div className="oz-stat"><b>{current[0] ? tenancyLength(current[0]) || "—" : "—"}</b><span>Current tenancy</span></div>
          </div>
          {occ !== "occupied" && (
            <div className="oz-grid3" style={{ marginTop: 10 }}>
              <div className="oz-stat"><b>{p.view_count}</b><span>Views</span></div>
              <div className="oz-stat"><b>{p.likes + p.shortlisted}</b><span>Interested</span></div>
              <div className="oz-stat"><b>{p.visits_booked + p.visit_requests}</b><span>Visit asks</span></div>
            </div>
          )}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Repairs & services
            <Link to={op(`/repairs/new?property=${id}`)} className="oz-btn oz-btn--ghost">New request</Link>
          </h2>
          {reqs.length === 0 ? <p className="oz-meta" style={{ margin: 0 }}>No requests yet.</p> : reqs.slice(0, 3).map((r) => (
            <Link key={r.id} to={op(`/repairs/${r.id}`)} className="oz-between" style={{ padding: "8px 0", color: "inherit", textDecoration: "none" }}>
              <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontWeight: 600 }}>{r.title}</strong>
                <span className="oz-meta">{fmtDate(r.created_at, { day: "numeric", month: "short" })}</span></span>
              <Pill tone={REQUEST_STATUS[r.status]?.tone}>{REQUEST_STATUS[r.status]?.label}</Pill>
            </Link>
          ))}
        </div>
        <p className="oz-hint" style={{ textAlign: "center" }}>{p.property_id}</p>
      </div>

      {menu && (
        <Sheet title="Property actions" onClose={() => setMenu(false)}>
          <button type="button" className="oz-menurow" onClick={() => navigate(op(`/properties/${id}/edit`))}><Pencil size={18} /> Edit property</button>
          <button type="button" className="oz-menurow" onClick={() => navigate(op(`/documents?property=${id}`))}><FileText size={18} /> Documents</button>
          {occ !== "occupied" && (
            <button type="button" className="oz-menurow" onClick={() => setConfirm("occupied")}>
              <span>Mark as occupied<span className="oz-sub">Takes it off moveazy.co.in</span></span>
            </button>
          )}
          {occ === "occupied" && (
            <button type="button" className="oz-menurow" onClick={() => setConfirm("vacant")}>Mark as vacant</button>
          )}
          {p.status === "published" && (
            <>
              <button type="button" className="oz-menurow" onClick={() => setConfirm("pause")}>Take off MovEazy for now</button>
              <a className="oz-menurow" href={ownerListingLink(id, "open")} target="_blank" rel="noreferrer"><ExternalLink size={18} /> View public page</a>
            </>
          )}
          <button type="button" className="oz-menurow" onClick={() => navigate(op(`/repairs/new?property=${id}`))}><Wrench size={18} /> Raise a repair</button>
        </Sheet>
      )}
      {confirm === "occupied" && (
        <Confirm title="Mark as occupied?" busy={busy} confirmLabel="Mark occupied" onClose={() => setConfirm(null)}
          body="It comes off moveazy.co.in and the broker network, so no new visits are booked."
          onConfirm={() => setStatus("rented", "Marked occupied")} />
      )}
      {confirm === "vacant" && (
        <Confirm title="Mark as vacant?" busy={busy} confirmLabel="Mark vacant" onClose={() => setConfirm(null)}
          body="It stays off the site until you choose to find a tenant. Current tenants stay on record until you mark them moved out."
          onConfirm={() => setStatus("paused", "Marked vacant")} />
      )}
      {confirm === "pause" && (
        <Confirm title="Take it off MovEazy?" busy={busy} confirmLabel="Take it off" onClose={() => setConfirm(null)}
          body="Renters and brokers stop seeing it. Visits already booked are not cancelled — MovEazy will be in touch about them."
          onConfirm={() => setStatus("paused", "Taken off MovEazy")} />
      )}
    </>
  );
}
