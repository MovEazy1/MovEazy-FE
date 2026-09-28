/**
 * Brokers → MovEazy partners → Prices, shares & landing pages.
 *
 * The one place the team changes what brokers pay, what they keep, the owner
 * calculator's assumptions and the landing pages' headline numbers. Saving
 * writes program_settings through admin_set_program_settings(), which checks
 * partners.manage and every range itself; the brokerage share is live in the
 * partner app on the next read, the rest on the next landing page load.
 */
import { useEffect, useState } from "react";
import { Btn, C, shortDate } from "./crmUi";
import { adminSaveProgramSettings, fetchLandingSettings } from "../../lib/landingSettings";

const GROUPS = [
  ["Broker Premium", [
    ["premiumPrice", "Offer price (₹/month)", "num"],
    ["premiumListPrice", "Regular price, struck through (₹/month)", "num"],
  ]],
  ["Brokerage the broker keeps", [
    ["propertyShare", "On MovEazy-posted properties (%) — live in the app", "num"],
    ["clientShare", "On MovEazy clients (%) — default; override per broker below", "num"],
    ["avgBrokerage", "Average brokerage per deal (₹) — calculator only", "num"],
  ]],
  ["Owner calculator", [
    ["paintMarket", "Repainting a 2 BHK at market (₹)", "num"],
    ["paintMoveazy", "Repainting through MovEazy (₹)", "num"],
    ["paintCycles", "MovEazy painting price, first N tenant cycles", "num"],
    ["hourlyValue", "Owner's time (₹/hour)", "num"],
    ["vacantDaysWith", "Vacant days between tenants with MovEazy", "num"],
  ]],
  ["Landing pages", [
    ["statBrokers", "Stat: brokers", "text"],
    ["statProperties", "Stat: properties", "text"],
    ["statRating", "Stat: rating", "text"],
    ["videoBroker", "Broker video link (https://… — empty hides the button)", "text"],
    ["videoOwner", "Owner video link (https://…)", "text"],
  ]],
];

export default function CrmProgramSettings({ canManage, onToast, onSaved }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLandingSettings({ fresh: true }).then((s) => { setSaved(s); setDraft(s); });
  }, []);

  if (!saved) return <div className="crm-mute" style={{ padding: 12, fontSize: 12 }}>Loading settings…</div>;

  const changed = Object.keys(draft).filter((k) => String(draft[k] ?? "") !== String(saved[k] ?? ""));
  const save = async () => {
    const patch = {};
    for (const [, fields] of GROUPS) {
      for (const [k, , kind] of fields) {
        if (!changed.includes(k)) continue;
        if (kind === "num") {
          const n = Number(draft[k]);
          if (draft[k] === "" || !Number.isFinite(n)) { onToast(`Enter a number for "${k}"`, "error"); return; }
          patch[k] = n;
        } else {
          patch[k] = String(draft[k] ?? "").trim();
        }
      }
    }
    setBusy(true);
    try {
      const next = await adminSaveProgramSettings(patch);
      setSaved(next);
      setDraft(next);
      onSaved?.(next);
      onToast("Settings saved — live now");
    } catch (e) {
      onToast(e?.message || "Could not save the settings.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {GROUPS.map(([title, fields]) => (
          <div key={title} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: C.bg }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{title}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {fields.map(([k, label, kind]) => (
                <label key={k} style={{ display: "grid", gap: 3 }}>
                  <span className="crm-mute" style={{ fontSize: 11.5 }}>{label}</span>
                  <input className="crm-input" inputMode={kind === "num" ? "decimal" : undefined} disabled={!canManage || busy}
                    value={draft[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                    style={changed.includes(k) ? { borderColor: C.gold } : undefined} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn variant="primary" sm disabled={!canManage || busy || changed.length === 0} onClick={save}>
          {busy ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "Saved"}
        </Btn>
        {changed.length > 0 && <Btn sm disabled={busy} onClick={() => setDraft(saved)}>Discard</Btn>}
        <span className="crm-mute" style={{ fontSize: 11.5 }}>
          {saved.updatedAt ? `Last changed on ${shortDate(saved.updatedAt)}.` : ""}
          {!canManage && " You need the partners.manage permission to change these."}
        </span>
      </div>
    </div>
  );
}
