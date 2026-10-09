/**
 * Editing a client's requirement — in their record, and in "Modify
 * requirements" on the Curate list screen. Every change is passed up at once
 * (the caller re-ranks, then saves behind it).
 *
 * Localities are a search, not a wall of a hundred chips: what's picked shows
 * as chips (tap to drop), typing lists what matches.
 */
import { useMemo, useState } from "react";
import {
  ALL_LOCALITIES, DEALBREAKERS, FLAT_TYPES, FURNISHINGS, MUST_HAVES, OCCUPANTS,
} from "../../data/preferenceOptions";
import { DEFAULT_RADIUS_KM } from "../../lib/curation";
import { C, Chip } from "./crmUi";

export function ChipRow({ options, selected, onToggle, disabled }) {
  const set = new Set(selected ?? []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => (
        <Chip key={o} on={set.has(o)} disabled={disabled} onClick={() => onToggle(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function LocalityPicker({ selected = [], onToggle, disabled }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return ALL_LOCALITIES.filter((l) => l.toLowerCase().includes(s) && !selected.includes(l)).slice(0, 12);
  }, [q, selected]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map((l) => (
            <Chip key={l} on disabled={disabled} onClick={() => onToggle(l)} title="Remove">{l} ×</Chip>
          ))}
        </div>
      )}
      {!disabled && (
        <input className="crm-input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={selected.length ? "Add another locality…" : "Search a locality…"} />
      )}
      {hits.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {hits.map((l) => <Chip key={l} onClick={() => { onToggle(l); setQ(""); }}>+ {l}</Chip>)}
        </div>
      )}
    </div>
  );
}

const Label = ({ children }) => <span className="crm-label">{children}</span>;

/**
 * @param {object}   req       the requirement being edited
 * @param {boolean}  canEdit
 * @param {Function} onChange  (nextReq) => void
 * @param {object}   [office]  the office the client gave us ({ display|label, lat, lng }), if any
 * @param {boolean}  [compact] only what changes the ranking and the curate rules
 */
export default function RequirementFields({ req, canEdit, onChange, office = null, compact = false }) {
  const set = (patch) => onChange({ ...req, ...patch });
  const toggle = (key, value) => {
    const cur = req[key] ?? [];
    set({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };
  const officeName = office?.display || office?.label || "";
  const hasOffice = Number.isFinite(Number(office?.lat ?? office?.latitude));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Label>Localities</Label>
        <div style={{ marginTop: 5 }}>
          <LocalityPicker selected={req.localities ?? []} disabled={!canEdit} onToggle={(v) => toggle("localities", v)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Budget min</Label>
          <input className="crm-input crm-num" type="number" inputMode="numeric" disabled={!canEdit}
            value={req.budget_min ?? ""} placeholder="30000"
            onChange={(e) => set({ budget_min: e.target.value === "" ? null : Number(e.target.value) })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Budget max</Label>
          <input className="crm-input crm-num" type="number" inputMode="numeric" disabled={!canEdit}
            value={req.budget_max ?? ""} placeholder="50000"
            onChange={(e) => set({ budget_max: e.target.value === "" ? null : Number(e.target.value) })} />
        </label>
      </div>

      <div>
        <Label>Flat type</Label>
        <div style={{ marginTop: 5 }}>
          <ChipRow options={FLAT_TYPES} selected={req.flat_types} disabled={!canEdit}
            onToggle={(v) => toggle("flat_types", v)} />
        </div>
      </div>

      <div>
        <Label>Furnishing</Label>
        <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FURNISHINGS.map((f) => (
            <Chip key={f} on={req.furnishing === f} disabled={!canEdit}
              onClick={() => set({ furnishing: req.furnishing === f ? "" : f })}>
              {f}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <Label>Occupants</Label>
        <div style={{ marginTop: 5 }}>
          <ChipRow options={OCCUPANTS} selected={req.occupants} disabled={!canEdit}
            onToggle={(v) => toggle("occupants", v)} />
        </div>
      </div>

      {!compact && (
        <>
          <div>
            <Label>Must haves</Label>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={MUST_HAVES} selected={req.must_haves} disabled={!canEdit}
                onToggle={(v) => toggle("must_haves", v)} />
            </div>
          </div>
          <div>
            <Label>Deal breakers</Label>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={DEALBREAKERS} selected={req.deal_breakers} disabled={!canEdit}
                onToggle={(v) => toggle("deal_breakers", v)} />
            </div>
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Move in</Label>
          <input className="crm-input" disabled={!canEdit} value={req.move_in ?? ""}
            placeholder="15 Oct 2026, or ASAP"
            onChange={(e) => set({ move_in: e.target.value })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Label>Show matches above</Label>
          <input className="crm-input crm-num" type="number" min="0" max="100" disabled={!canEdit}
            value={req.min_score ?? 60}
            onChange={(e) => set({ min_score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label>Distance from office (km, straight line)</Label>
        <input className="crm-input crm-num" type="number" inputMode="decimal" min="1" max="100" step="0.5"
          disabled={!canEdit} value={req.office_radius_km ?? DEFAULT_RADIUS_KM}
          onChange={(e) => {
            const v = Number(e.target.value);
            set({ office_radius_km: Number.isFinite(v) && v > 0 ? Math.min(100, v) : DEFAULT_RADIUS_KM });
          }} />
        <span className="crm-mute" style={{ fontSize: 11, lineHeight: 1.45, color: hasOffice ? C.textDim : C.textMute }}>
          {hasOffice
            ? `Flats this close to ${officeName || "their office"} count as their area when pre-selecting.`
            : "They haven't told us their office, so only their localities count."}
        </span>
      </label>
    </div>
  );
}
