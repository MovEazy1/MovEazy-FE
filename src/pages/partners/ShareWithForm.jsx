/**
 * PRD 07 — who can discover a property and what brokerage each audience gets.
 * Every selected group carries its own percentage (stored per group, not
 * globally); "All MovEazy Brokers" has a separate one. "Only me" clears both.
 */
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { pp } from "../../lib/partners";

export const PCT_OPTIONS = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

export const EMPTY_SHARE = { platformOn: false, platformPct: 50, groupPct: {} };

/** Form state → the shape partner_set_sharing() takes. */
export function toSharing(v) {
  return {
    platformPct: v.platformOn ? Number(v.platformPct) : null,
    groups: Object.entries(v.groupPct).map(([group_id, pct]) => ({ group_id, pct: Number(pct) })),
  };
}

/** Who sees it, in a few words ("All MovEazy brokers · 50% + 2 groups"). */
export function shareSummary(share, groups = []) {
  const g = Object.keys(share.groupPct || {});
  const parts = [];
  if (share.platformOn) parts.push(`All MovEazy brokers · ${share.platformPct}%`);
  if (g.length) parts.push(g.length === 1 ? (groups.find((x) => x.id === g[0])?.name || "1 group") : `${g.length} groups`);
  return parts.length ? parts.join(" + ") : "Only me";
}

/** partner_listing_sharing() → form state. */
export function fromSharing(s) {
  return {
    platformOn: s?.platform_pct != null,
    platformPct: s?.platform_pct != null ? Number(s.platform_pct) : 50,
    groupPct: Object.fromEntries((s?.groups ?? []).map((g) => [g.group_id, Number(g.pct)])),
  };
}

function PctSelect({ value, onChange, label }) {
  return (
    <select className="pz-select" style={{ width: 92, padding: "8px 10px" }} value={value} aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}>
      {PCT_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
    </select>
  );
}

export default function ShareWithForm({ value, onChange, groups }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const groupsOn = Object.keys(value.groupPct).length > 0;
  const onlyMe = !groupsOn && !value.platformOn;

  const toggleGroup = (id) => {
    const next = { ...value.groupPct };
    if (id in next) delete next[id]; else next[id] = 50;
    set({ groupPct: next });
  };

  return (
    <div className="pz-card">
      <label className="pz-radio">
        <input type="radio" checked={onlyMe} onChange={() => set({ platformOn: false, groupPct: {} })} />
        <span><strong style={{ display: "block", fontSize: 16 }}>Only me</strong><span className="pz-meta">Keep this property private</span></span>
      </label>

      <div style={{ borderTop: "1px solid var(--line)" }}>
        <label className="pz-radio" style={{ paddingBottom: groups.length ? 6 : 14 }}>
          <input type="checkbox" className="pz-check" checked={groupsOn} disabled={!groups.length}
            onChange={() => set({ groupPct: groupsOn ? {} : Object.fromEntries(groups.slice(0, 1).map((g) => [g.id, 50])) })} />
          <span><strong style={{ display: "block", fontSize: 16 }}>My Groups</strong>
            <span className="pz-meta">
              {groups.length ? "Share with selected groups — only their members see it" : <>You're not in a group yet. <Link to={pp("/groups")} style={{ color: "var(--g)" }}>Create one</Link></>}
            </span></span>
        </label>
        {groups.length > 0 && (
          <div style={{ padding: "0 14px 12px 46px" }}>
            {groups.map((g) => (
              <div key={g.id} className="pz-between" style={{ padding: "6px 0" }}>
                <label className="pz-row" style={{ gap: 10, cursor: "pointer", flex: 1, minWidth: 0 }}>
                  <input type="checkbox" className="pz-check" checked={g.id in value.groupPct} onChange={() => toggleGroup(g.id)} />
                  <span style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                </label>
                {g.id in value.groupPct && (
                  <PctSelect label={`Brokerage for ${g.name}`} value={value.groupPct[g.id]}
                    onChange={(p) => set({ groupPct: { ...value.groupPct, [g.id]: p } })} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--line)" }}>
        <label className="pz-radio" style={{ paddingBottom: value.platformOn ? 6 : 14 }}>
          <input type="checkbox" className="pz-check" checked={value.platformOn} onChange={() => set({ platformOn: !value.platformOn })} />
          <span><strong style={{ display: "block", fontSize: 16 }}>All Moveazy Brokers</strong>
            <span className="pz-meta">Share across the platform broker network</span></span>
        </label>
        {value.platformOn && (
          <div className="pz-between" style={{ padding: "0 14px 14px 46px" }}>
            <span style={{ fontSize: 15 }}>Brokerage Share</span>
            <PctSelect label="Brokerage for all brokers" value={value.platformPct} onChange={(p) => set({ platformPct: p })} />
          </div>
        )}
      </div>

      <p className="pz-hint pz-row" style={{ gap: 6, alignItems: "flex-start", padding: "0 14px 14px", margin: 0 }}>
        <Info size={14} style={{ flex: "none", marginTop: 2 }} />
        Every listing is also live on moveazy.co.in. Your contact and brokerage are only shown to the brokers you choose here.
      </p>
    </div>
  );
}
