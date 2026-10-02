/**
 * Properties tab → "Add to property / society" on one flat.
 *
 * A dropdown of every building and society; picking one puts the flat in it
 * at once (crm_set_flat_building). From there the database does the rest
 * (crm_onboarding.sql): in a building the flat goes to the building's owner,
 * in a society it keeps its own owner, and the building's partner broker gets
 * it on the building's QR and in their visit requests.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, Plus, X } from "lucide-react";
import { C } from "./crmUi";
import { setCrmFlatBuilding } from "../../lib/crmPropertyInternal";

export default function CrmBuildingPicker({ listing, buildings, onDone, onToast }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [unitNo, setUnitNo] = useState(listing.unit_no || "");
  const [busy, setBusy] = useState("");
  const ref = useRef(null);
  const current = buildings.find((b) => b.id === listing.building_id);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return buildings
      .filter((b) => !needle || `${b.name} ${b.area}`.toLowerCase().includes(needle))
      // The flat's own locality first: that's where its building almost always is.
      .sort((a, b) => Number(b.area === listing.area) - Number(a.area === listing.area) || a.name.localeCompare(b.name));
  }, [buildings, q, listing.area]);

  const put = async (b) => {
    setBusy(b ? b.id : "out");
    try {
      await setCrmFlatBuilding(listing.property_id, b ? b.id : null, null, b ? unitNo.trim() : null);
      onToast(b
        ? `${listing.property_id} is now in ${b.name}${b.kind === "society" ? " (keeps its own owner)" : b.owner_joined ? " — and in its owner's app" : ""}`
        : `${listing.property_id} taken out of ${current?.name || "its building"}`);
      setOpen(false);
      await onDone?.();
    } catch (e) {
      onToast(e?.message || "Could not move the flat", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="crm-btn crm-btn--sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        title={current ? `In ${current.name} — change` : "Add this flat to a property or society"}
        style={current ? { borderColor: C.gold, color: C.gold } : undefined}>
        <Building2 size={13} /> {current ? "Change property" : "Add to property / society"}
      </button>
      {open && (
        <div role="dialog" aria-label="Add to a property or society"
          style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 40, width: 300, background: "#fff",
            border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 14px 34px rgba(16,34,30,.18)", padding: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 6 }}>
            <input className="crm-input" autoFocus placeholder="Search properties…" value={q} onChange={(e) => setQ(e.target.value)} />
            <input className="crm-input" placeholder="House no." value={unitNo} onChange={(e) => setUnitNo(e.target.value.slice(0, 20))} aria-label="House number (optional)" />
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gap: 2 }}>
            {shown.length === 0 && <span className="crm-mute" style={{ fontSize: 12, padding: 6 }}>No property by that name.</span>}
            {shown.map((b) => {
              const here = b.id === listing.building_id;
              return (
                <button key={b.id} type="button" disabled={Boolean(busy)} onClick={() => put(b)}
                  style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left", border: 0, borderRadius: 7, padding: "7px 8px", cursor: "pointer",
                    font: "inherit", background: here ? C.accentSoft : "transparent", color: C.text }}
                  onMouseEnter={(e) => { if (!here) e.currentTarget.style.background = C.surface; }}
                  onMouseLeave={(e) => { if (!here) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</strong>
                    <span className="crm-mute" style={{ fontSize: 11 }}>
                      {b.kind === "society" ? "Society" : "Building"} · {b.area || "—"} · {b.flats} flat{b.flats === 1 ? "" : "s"}
                      {b.kind === "building" ? (b.owner_joined ? ` · ${b.owner_name || "owner"} in app` : b.owner_email ? " · owner invited" : "") : ""}
                    </span>
                  </span>
                  {busy === b.id ? <span className="crm-mute" style={{ fontSize: 11 }}>…</span> : here ? <Check size={14} color={C.accent} /> : null}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 8 }}>
            <Link to={`/crm/buildings/new?flats=${listing.property_id}`} className="crm-btn crm-btn--sm" style={{ textDecoration: "none" }}><Plus size={13} /> New property / society</Link>
            {current && (
              <button type="button" className="crm-btn crm-btn--sm" disabled={Boolean(busy)} onClick={() => put(null)} style={{ color: C.coral }}>
                <X size={13} /> Take out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
