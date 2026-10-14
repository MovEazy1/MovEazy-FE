/**
 * Who can close this flat, and the share of the brokerage each one gets —
 * every medium listed, each on at 50% to start (AddProperty, EditSharing):
 *   All MovEazy Partners  [50 %] ×   → "Are you sure?" — it then isn't shared
 *                                      with any other partner (only that flat;
 *                                      Edit can share it again)
 *   each association group [50 %] ×
 * The number is free (0–100). Same form state as ShareWithForm
 * ({ platformOn, platformPct, groupPct }), saved with toSharing().
 */
import { useState } from "react";
import { Users, X } from "lucide-react";
import { Sheet } from "./partnerUi";

export const DEFAULT_PCT = 50;

/** A new flat: shared everywhere at 50%. */
export const defaultShare = (groups = []) => ({
  platformOn: true, platformPct: DEFAULT_PCT,
  groupPct: Object.fromEntries(groups.map((g) => [g.id, DEFAULT_PCT])),
});

/** What's typed → a whole percentage, 0–100 ("" while typing). */
export const cleanPct = (v) => {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 3);
  return d === "" ? "" : Math.min(100, Number(d));
};

function PctInput({ value, onChange, label }) {
  return (
    <label className="sm-pct" aria-label={label}>
      <input inputMode="numeric" value={value} onChange={(e) => onChange(cleanPct(e.target.value))}
        onBlur={() => { if (value === "") onChange(DEFAULT_PCT); }} />
      <span>%</span>
    </label>
  );
}

export default function ShareMediums({ value, onChange, groups = [] }) {
  const [confirm, setConfirm] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  const setGroup = (id, pct) => {
    const next = { ...value.groupPct };
    if (pct == null) delete next[id]; else next[id] = pct;
    set({ groupPct: next });
  };

  return (
    <div className="sm">
      <style>{CSS}</style>
      <p className="sm-help">
        Share of <b>your brokerage</b> the other partner gets if they close this deal. A higher share gets your flat closed faster.
      </p>

      <div className={`sm-row${value.platformOn ? "" : " sm-row--off"}`}>
        <span className="sm-name"><b>All MovEazy Partners</b>
          <span>{value.platformOn ? "Every verified partner can match it to their tenants" : "Not shared with other partners"}</span></span>
        {value.platformOn ? (
          <>
            <PctInput label="Brokerage share for all MovEazy partners" value={value.platformPct} onChange={(p) => set({ platformPct: p })} />
            <button type="button" className="sm-x" aria-label="Don't share with all partners" onClick={() => setConfirm(true)}><X size={16} /></button>
          </>
        ) : (
          <button type="button" className="pz-btn pz-btn--sm" onClick={() => set({ platformOn: true, platformPct: DEFAULT_PCT })}>Share</button>
        )}
      </div>

      {groups.map((g) => {
        const on = g.id in value.groupPct;
        return (
          <div key={g.id} className={`sm-row${on ? "" : " sm-row--off"}`}>
            <span className="sm-name"><b><Users size={13} style={{ verticalAlign: -2 }} /> {g.name}</b><span>{on ? "Association group" : "Not shared with this group"}</span></span>
            {on ? (
              <>
                <PctInput label={`Brokerage share for ${g.name}`} value={value.groupPct[g.id]} onChange={(p) => setGroup(g.id, p)} />
                <button type="button" className="sm-x" aria-label={`Don't share with ${g.name}`} onClick={() => setGroup(g.id, null)}><X size={16} /></button>
              </>
            ) : (
              <button type="button" className="pz-btn pz-btn--sm" onClick={() => setGroup(g.id, DEFAULT_PCT)}>Share</button>
            )}
          </div>
        );
      })}

      {confirm && (
        <Sheet title="Not share this flat?" onClose={() => setConfirm(false)}>
          <div className="pz-pad">
            <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.55 }}>
              Are you sure you don&apos;t want to share this inventory with our other trusted partners? Once marked, this inventory will
              never be shared with any other partner. (Only this flat — your other flats stay as they are.)
            </p>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={() => setConfirm(false)}>Keep sharing</button>
            <button type="button" className="pz-btn pz-btn--ghost" style={{ width: "100%", marginTop: 8 }}
              onClick={() => { set({ platformOn: false }); setConfirm(false); }}>Yes, don&apos;t share it</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

const CSS = `
.sm { display: grid; gap: 8px; }
.sm-help { margin: 0 0 2px; font-size: 13px; line-height: 1.45; color: var(--dim); }
.sm-help b { color: var(--ink); }
.sm-row { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; border: 1px solid var(--line); background: #fff; }
.sm-row--off { background: #F8F7F3; }
.sm-row--off .sm-name b { color: var(--dim); }
.sm-name { flex: 1; min-width: 0; display: grid; gap: 1px; }
.sm-name b { font-size: 14.5px; }
.sm-name span { font-size: 12px; color: var(--dim); }
.sm-pct { display: inline-flex; align-items: center; gap: 2px; height: 40px; padding: 0 10px; border: 1.5px solid var(--g); border-radius: 10px; background: #fff; }
.sm-pct input { width: 34px; border: 0; outline: 0; font: inherit; font-size: 16px; font-weight: 800; text-align: right; background: transparent; color: var(--ink); }
.sm-pct span { font-weight: 800; color: var(--dim); }
.sm-x { flex: none; width: 34px; height: 34px; border: 0; border-radius: 99px; background: #F1EFEA; color: var(--dim); display: grid; place-items: center; cursor: pointer; }
`;
