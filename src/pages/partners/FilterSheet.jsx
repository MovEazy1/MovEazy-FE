/** PRD 02 — the compact filter sheet. Only high-value filters in V1. */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  BHK_CHIPS, BROKERAGE_CHIPS, EMPTY_FILTERS, FURNISHING_CHIPS, POPULAR_LOCATIONS, PROPERTY_TYPES, applyFilters,
} from "../../lib/partnerFilters";
import { ALL_LOCALITIES } from "../../data/preferenceOptions";
import { Chip, Sheet } from "./partnerUi";

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function FilterSheet({ value, rows, query = "", onApply, onClose }) {
  const [f, setF] = useState({ ...EMPTY_FILTERS, ...(value || {}) });
  const [loc, setLoc] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const count = useMemo(() => applyFilters(rows ?? [], f, query).length, [rows, f, query]);
  const suggestions = useMemo(() => {
    const q = loc.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL_LOCALITIES.filter((a) => a.toLowerCase().includes(q) && !f.locations.includes(a)).slice(0, 6);
  }, [loc, f.locations]);
  const chipsFor = [...new Set([...POPULAR_LOCATIONS, ...f.locations])];

  return (
    <Sheet title="Filters" onClose={onClose}
      action={<button type="button" className="pz-btn pz-btn--ghost" onClick={() => setF({ ...EMPTY_FILTERS })}>Reset</button>}>
      <div className="pz-pad">
        <div className="pz-field">
          <span className="pz-label">Location</span>
          <div className="pz-search" style={{ marginBottom: 8 }}>
            <Search size={17} />
            <input className="pz-input" placeholder="Search locations" value={loc} onChange={(e) => setLoc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && loc.trim()) { set({ locations: toggle(f.locations, suggestions[0] || loc.trim()) }); setLoc(""); }
              }} />
          </div>
          {suggestions.length > 0 && (
            <div className="pz-chips" style={{ marginBottom: 8 }}>
              {suggestions.map((s) => (
                <Chip key={s} soft onClick={() => { set({ locations: [...f.locations, s] }); setLoc(""); }}>+ {s}</Chip>
              ))}
            </div>
          )}
          <div className="pz-chips">
            {chipsFor.map((a) => (
              <Chip key={a} on={f.locations.includes(a)} onClick={() => set({ locations: toggle(f.locations, a) })}>{a}</Chip>
            ))}
          </div>
        </div>

        <div className="pz-field">
          <span className="pz-label">BHK</span>
          <div className="pz-chips">
            <Chip on={!f.bhk.length} onClick={() => set({ bhk: [] })}>Any</Chip>
            {BHK_CHIPS.map((b) => <Chip key={b} on={f.bhk.includes(b)} onClick={() => set({ bhk: toggle(f.bhk, b) })}>{b}</Chip>)}
          </div>
        </div>

        <div className="pz-field">
          <span className="pz-label">Rent Range (₹)</span>
          <div className="pz-row">
            <input className="pz-input" inputMode="numeric" placeholder="Min" value={f.rentMin}
              onChange={(e) => set({ rentMin: e.target.value.replace(/\D/g, "") })} />
            <span className="pz-meta">–</span>
            <input className="pz-input" inputMode="numeric" placeholder="Max" value={f.rentMax}
              onChange={(e) => set({ rentMax: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>

        <div className="pz-field">
          <span className="pz-label">Brokerage Share</span>
          <div className="pz-chips">
            {BROKERAGE_CHIPS.map((c) => (
              <Chip key={c.label} on={f.brokerageMin === c.min} onClick={() => set({ brokerageMin: c.min })}>{c.label}</Chip>
            ))}
          </div>
        </div>

        <div className="pz-field">
          <span className="pz-label">Property Type</span>
          <div className="pz-chips">
            <Chip on={!f.types.length} onClick={() => set({ types: [] })}>Any</Chip>
            {PROPERTY_TYPES.map((t) => <Chip key={t} on={f.types.includes(t)} onClick={() => set({ types: toggle(f.types, t) })}>{t}</Chip>)}
          </div>
        </div>

        <div className="pz-field">
          <span className="pz-label">Furnishing</span>
          <div className="pz-chips">
            <Chip on={!f.furnishing.length} onClick={() => set({ furnishing: [] })}>Any</Chip>
            {FURNISHING_CHIPS.map((t) => (
              <Chip key={t} on={f.furnishing.includes(t)} onClick={() => set({ furnishing: toggle(f.furnishing, t) })}>{t}</Chip>
            ))}
          </div>
        </div>

        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={() => onApply(f)}>
          Apply Filters{rows ? ` · ${count} ${count === 1 ? "property" : "properties"}` : ""}
        </button>
      </div>
    </Sheet>
  );
}
