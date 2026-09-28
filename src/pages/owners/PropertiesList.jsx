/** PRD 02 — the portfolio: All / Occupied / Vacant, search, sort, location and type filters. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Building2, MapPin, Plus, Search } from "lucide-react";
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

export default function PropertiesList() {
  const { properties, propError, tenants, ui, setUi } = useOwner();
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
      <div className="oz-tabs" role="tablist">
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
