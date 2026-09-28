/**
 * The property form's "MovEazy partners" block.
 *
 * For MovEazy's own inventory: whether the broker app shows it at all, and the
 * brokerage share a non-Premium partner would get. Premium partners always see
 * it at 100% (they close without sharing); the percentage is kept for the
 * plans that come later. Both are inventory columns no tenant or broker can
 * read directly (partner_schema.sql).
 *
 * For a flat a partner added in the broker app, the partner controls the
 * sharing, so this shows who added it and how they chose to share it instead.
 */
import { C } from "./crmUi";
import { formatForDisplay } from "../../lib/mobile";
import { describeSharing } from "../../lib/partners";

const PCTS = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

export default function CrmPartnerFields({ value, onChange, partnerInfo }) {
  if (partnerInfo) {
    const b = partnerInfo.broker;
    return (
      <div className="crm-card" style={{ display: "grid", gap: 4, background: C.accentSoft, borderColor: C.accentSoft }}>
        <span className="crm-label">From the partner app</span>
        <span style={{ fontSize: 12.5 }}>
          Added by <strong>{b?.name || "a partner"}</strong>
          {b?.agency ? ` (${b.agency})` : ""}{b?.phone ? ` · ${formatForDisplay(b.phone)}` : ""}
        </span>
        <span className="crm-mute" style={{ fontSize: 11.5 }}>Their sharing: {describeSharing(partnerInfo)}</span>
      </div>
    );
  }

  const on = value.partner_visible !== false;
  return (
    <div className="crm-card" style={{ display: "grid", gap: 8 }}>
      <span className="crm-label">MovEazy partners</span>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={on} style={{ marginTop: 2 }}
          onChange={(e) => onChange({ partner_visible: e.target.checked })} />
        <span style={{ fontSize: 12.5 }}>
          Share with broker partners
          <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
            Shown locked in the broker app; Premium partners unlock it and keep the share set in Brokers → Prices &amp; shares.
          </span>
        </span>
      </label>
      {on && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, flex: 1 }}>
            Brokerage share without Premium
            <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>Kept for future plans — not shown to partners today.</span>
          </span>
          <select className="crm-input" style={{ width: 84 }} value={Number(value.partner_share_pct ?? 50)}
            onChange={(e) => onChange({ partner_share_pct: Number(e.target.value) })}>
            {PCTS.map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
