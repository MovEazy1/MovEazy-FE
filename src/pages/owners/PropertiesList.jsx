/** PRD 02 — the portfolio: All / Occupied / Vacant, search, sort, location and type filters. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Building2, ChevronRight, MapPin, Plus, QrCode, Search } from "lucide-react";
import { useOwner } from "./OwnerApp";
import PropertyRow from "./PropertyRow";
import { Chip, Empty, Loading, Sheet, TopBar } from "./ownerUi";
import { bhkLabel, occupancyOf, op } from "../../lib/owners";
import { occupancyPct } from "../../lib/ownerOccupancy";

const SORTS = [
  ["recent", "Recently added"],
  ["rent_desc", "Rent: high to low"],
  ["rent_asc", "Rent: low to high"],
  ["occupancy", "Occupancy"],
  ["activity", "Most interest"],
];

/** The owner's buildings — each with its QR — above the flat list. */
function BuildingsStrip({ buildings }) {
  if (!buildings) return null;
  return (
    <div className="oz-pad" style={{ paddingBottom: 0 }}>
      <div className="oz-between" style={{ margin: "2px 2px 8px" }}>
        <b style={{ fontSize: 15 }}>Buildings & QR</b>
        <Link to={op("/buildings/new")} className="oz-btn oz-btn--ghost"><Plus size={15} /> New</Link>
      </div>
      {buildings.length === 0 ? (
        <Link to={op("/buildings/new")} className="oz-card bl-new">
          <span className="bl-ic"><QrCode size={22} /></span>
          <span style={{ flex: 1 }}>
            <b>Group your flats into a building</b>
            <small>Get one QR for the gate. Tenants scan, see every flat floor by floor, and book a visit.</small>
          </span>
          <ChevronRight size={18} color="#94A09B" />
        </Link>
      ) : (
        <div className="bl-row">
          {buildings.map((b) => (
            <Link key={b.id} to={op(`/buildings/${b.id}`)} className="oz-card bl-card">
              <div className="bl-top"><span className="bl-ic bl-ic--sm"><Building2 size={16} /></span><b>{b.name}</b></div>
              <div className="oz-meta" style={{ fontSize: 12 }}>{b.area || "Bengaluru"} · {b.flats} flat{b.flats === 1 ? "" : "s"}</div>
              <div className="bl-stats">
                <span><b>{b.stats?.scans ?? 0}</b> scans</span>
                <span><b>{b.stats?.scheduled ?? 0}</b> visits</span>
                <span><b>{b.stats?.booked ?? 0}</b> booked</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <style>{`
        .bl-new { display: flex; align-items: center; gap: 12px; padding: 14px; text-decoration: none; color: inherit;
          background: linear-gradient(135deg, #fff, var(--champ2)); border-color: #EADFC6; }
        .bl-new b { display: block; font-size: 14.5px; }
        .bl-new small { display: block; font-size: 12.5px; color: var(--dim); margin-top: 2px; line-height: 1.4; }
        .bl-ic { width: 42px; height: 42px; border-radius: 12px; background: var(--deep); color: var(--champ); display: grid; place-items: center; flex: none; }
        .bl-ic--sm { width: 28px; height: 28px; border-radius: 9px; }
        .bl-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .bl-row::-webkit-scrollbar { display: none; }
        .bl-card { flex: 0 0 220px; padding: 12px; text-decoration: none; color: inherit; }
        .bl-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .bl-top b { font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bl-stats { display: flex; gap: 10px; margin-top: 10px; font-size: 11.5px; color: var(--dim); }
        .bl-stats b { color: var(--deep); font-size: 14px; }
      `}</style>
    </div>
  );
}

export default function PropertiesList() {
  const { properties, propError, tenants, ui, setUi, buildings } = useOwner();
  const [q, setQ] = useState(ui.q || "");
  const [sheet, setSheet] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setUi({ q }), 200);
    return () => clearTimeout(id);
  }, [q, setUi]);

  const list = useMemo(() => properties ?? [], [properties]);
  const withOcc = useMemo(() => list.map((p) => ({ p, occ: occupancyOf(p, tenants) })), [list, tenants]);
  const counts = {
    all: withOcc.length,
    occupied: withOcc.filter((x) => x.occ === "occupied").length,
    vacant: withOcc.filter((x) => x.occ !== "occupied").length,
  };
  const areas = [...new Set(list.map((p) => p.area).filter(Boolean))].sort();
  const types = [...new Set(list.map((p) => p.property_type).filter(Boolean))].sort();

  const rows = useMemo(() => {
    const needle = (ui.q || "").trim().toLowerCase();
    const out = withOcc.filter(({ p, occ }) => {
      if (ui.occ === "occupied" && occ !== "occupied") return false;
      if (ui.occ === "vacant" && occ === "occupied") return false;
      if (ui.area && p.area !== ui.area) return false;
      if (ui.type && p.property_type !== ui.type) return false;
      if (!needle) return true;
      const tenantNames = tenants.filter((t) => t.property_id === p.property_id).map((t) => t.name).join(" ");
      return [p.property_id, p.title, p.area, p.full_address, bhkLabel(p), p.property_type, tenantNames]
        .join(" ").toLowerCase().includes(needle);
    });
    const occPct = (p) => occupancyPct(tenants.filter((t) => t.property_id === p.property_id)) ?? -1;
    const interest = (p) => (p.likes || 0) + (p.visit_requests || 0) + (p.visits_booked || 0) * 2 + (p.shortlisted || 0);
    out.sort((a, b) => {
      switch (ui.sort) {
        case "rent_desc": return (Number(b.p.rent) || 0) - (Number(a.p.rent) || 0);
        case "rent_asc": return (Number(a.p.rent) || 0) - (Number(b.p.rent) || 0);
        case "occupancy": return occPct(b.p) - occPct(a.p);
        case "activity": return interest(b.p) - interest(a.p);
        default: return new Date(b.p.linked_at || 0) - new Date(a.p.linked_at || 0);
      }
    });
    return out;
  }, [withOcc, ui, tenants]);

  return (
    <>
      <TopBar title="My Properties" right={
        <Link to={op("/properties/new")} className="oz-btn oz-btn--primary oz-btn--sm"><Plus size={16} /> Add</Link>
      } />
      <BuildingsStrip buildings={buildings} />
      <div className="oz-tabs" role="tablist" style={{ marginTop: 10 }}>
        {[["all", "All"], ["occupied", "Occupied"], ["vacant", "Vacant"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={ui.occ === k} className={`oz-tab${ui.occ === k ? " oz-tab--on" : ""}`}
            onClick={() => setUi({ occ: k })}>{label} ({counts[k]})</button>
        ))}
      </div>
      <div className="oz-pad" style={{ paddingBottom: 4 }}>
        <div className="oz-search" style={{ marginBottom: 10 }}>
          <Search size={17} />
          <input className="oz-input" type="search" placeholder="Search by location, BHK, or tenant…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="oz-chips oz-chips--scroll">
          <Chip on={ui.sort !== "recent"} onClick={() => setSheet("sort")}><ArrowUpDown size={14} /> Sort</Chip>
          <Chip on={Boolean(ui.area)} onClick={() => setSheet("area")}><MapPin size={14} /> {ui.area || "Location"}</Chip>
          <Chip on={Boolean(ui.type)} onClick={() => setSheet("type")}><Building2 size={14} /> {ui.type || "Property Type"}</Chip>
          {(ui.area || ui.type || ui.sort !== "recent") && <Chip onClick={() => setUi({ area: "", type: "", sort: "recent" })}>Clear</Chip>}
        </div>
      </div>
      <div className="oz-pad oz-list">
        {!properties ? <Loading /> : propError ? <Empty>{propError}</Empty> : rows.length === 0 ? (
          <Empty action={list.length === 0 ? <Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add a property</Link> : null}>
            {list.length === 0 ? "No properties yet." : "Nothing matches that. Try clearing a filter."}
          </Empty>
        ) : rows.map(({ p }) => <PropertyRow key={p.property_id} property={p} tenants={tenants} />)}
      </div>

      {sheet === "sort" && (
        <Sheet title="Sort by" onClose={() => setSheet("")}>
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" className="oz-menurow" onClick={() => { setUi({ sort: k }); setSheet(""); }}
              style={ui.sort === k ? { color: "var(--em)", fontWeight: 700 } : undefined}>{label}</button>
          ))}
        </Sheet>
      )}
      {sheet === "area" && (
        <Sheet title="Location" onClose={() => setSheet("")}>
          <div className="oz-pad oz-chips">
            <Chip on={!ui.area} onClick={() => { setUi({ area: "" }); setSheet(""); }}>All locations</Chip>
            {areas.map((a) => <Chip key={a} on={ui.area === a} onClick={() => { setUi({ area: a }); setSheet(""); }}>{a}</Chip>)}
          </div>
        </Sheet>
      )}
      {sheet === "type" && (
        <Sheet title="Property type" onClose={() => setSheet("")}>
          <div className="oz-pad oz-chips">
            <Chip on={!ui.type} onClick={() => { setUi({ type: "" }); setSheet(""); }}>All types</Chip>
            {types.map((t) => <Chip key={t} on={ui.type === t} onClick={() => { setUi({ type: t }); setSheet(""); }}>{t}</Chip>)}
            {types.length === 0 && <span className="oz-meta">Add a property type to your flats to filter by it.</span>}
          </div>
        </Sheet>
      )}
    </>
  );
}
