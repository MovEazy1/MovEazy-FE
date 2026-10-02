/**
 * The property form's "Owner & building" block (crm_onboarding.sql).
 *
 * Two questions on every upload — is the owner onboarded, and is this one of
 * several units in a building — plus the owner's own email and phone, which
 * can be added now or on any later edit. With them, the flat (and its
 * building) shows up in that owner's app the moment they sign in. Staff only:
 * it lives in inventory_private, never on the public listing.
 */
import { C } from "./crmUi";
import { buildingUrl } from "../../lib/buildings";

function YesNo({ value, onChange, yes, no }) {
  const opt = (v, label) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={value === v}
      style={{
        flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", font: "inherit",
        border: `1px solid ${value === v ? C.accent : C.line}`, background: value === v ? C.accentSoft : "#fff",
        color: value === v ? C.accent : C.text,
      }}>{label}</button>
  );
  return <div style={{ display: "flex", gap: 6 }}>{opt(true, yes)}{opt(false, no)}</div>;
}

/**
 * `value`/`onChange`: the internal details (owner_onboarded, multi_unit, owner_email, owner_phone, source).
 * `building`/`onBuilding`: { id, newName } — an existing building, or the name of a new one.
 * `options`: crm_building_options(). `links`: crm_property_links() on an edit, else null.
 */
export default function CrmOwnerFields({ value, onChange, building, onBuilding, options, links, floor }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const picked = (options ?? []).find((b) => b.id === building.id);
  const owner = links?.owner;
  const hasContact = Boolean(String(value.owner_email || "").trim() || String(value.owner_phone || "").trim());

  return (
    <div className="crm-card" style={{ display: "grid", gap: 10, borderColor: value.owner_onboarded === null || value.multi_unit === null ? C.gold : undefined }}>
      <span className="crm-label">Owner &amp; building</span>

      <div style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Is the owner onboarded?</span>
        <YesNo value={value.owner_onboarded} onChange={(v) => set({ owner_onboarded: v })} yes="Yes, onboarded" no="Not yet" />
        <span className="crm-mute" style={{ fontSize: 11 }}>Onboarded = they use the MovEazy owner app (owners.moveazy.co.in).</span>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Owner's contact <span className="crm-mute" style={{ fontWeight: 400 }}>— now, or on any later edit</span></span>
        <input className="crm-input" type="email" placeholder="Owner's Google email" value={value.owner_email || ""}
          onChange={(e) => set({ owner_email: e.target.value })} />
        <input className="crm-input" inputMode="tel" placeholder="Owner's mobile" value={value.owner_phone || ""}
          onChange={(e) => set({ owner_phone: e.target.value })} />
        {owner ? (
          <span style={{ fontSize: 11.5, color: C.accent, fontWeight: 600 }}>
            ✓ In {owner.name || owner.email}'s owner app{owner.email ? ` (${owner.email})` : ""}
          </span>
        ) : (
          <span className="crm-mute" style={{ fontSize: 11 }}>
            {hasContact
              ? "Shows up in their owner app — with its leads, visits and QR — as soon as they sign in with this email. The mobile is used only when there is no email."
              : "Add the owner's email and the flat appears in their owner app when they sign in."}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Does this building contain multiple units?</span>
        <YesNo value={value.multi_unit} onChange={(v) => set({ multi_unit: v })} yes="Yes, several flats" no="No, just this one" />
      </div>

      {value.multi_unit === true && (
        <div style={{ display: "grid", gap: 6 }}>
          <select className="crm-input" value={building.id || (building.newName !== undefined ? "__new" : "")}
            onChange={(e) => onBuilding(e.target.value === "__new" ? { id: "", newName: "" } : { id: e.target.value })}>
            <option value="">Pick the building…</option>
            <option value="__new">+ New building</option>
            {(options ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.area ? ` · ${b.area}` : ""} · {b.flats} flat{b.flats === 1 ? "" : "s"}</option>
            ))}
          </select>
          {!building.id && building.newName !== undefined && (
            <input className="crm-input" placeholder="Building name, e.g. Sunrise Residency" value={building.newName}
              onChange={(e) => onBuilding({ id: "", newName: e.target.value })} />
          )}
          <span className="crm-mute" style={{ fontSize: 11 }}>
            {picked ? <>QR page: <a href={buildingUrl(picked.code)} target="_blank" rel="noreferrer" style={{ color: C.accent }}>/building/{picked.code}</a> · </> : null}
            The flat goes on the {String(floor ?? "").trim() === "" ? "floor set above (set one — tenants see flats floor by floor)" : `floor set above (${floor})`}.
            {picked && !picked.owner_joined && !picked.owner_email && !picked.owner_phone && hasContact ? " The owner contact above is saved on the building too." : ""}
          </span>
        </div>
      )}

      {(value.source === "broker" || links?.partner) && (
        <span className="crm-mute" style={{ fontSize: 11, lineHeight: 1.45 }}>
          {links?.partner
            ? <>Now in <strong>{links.partner.name}</strong>'s partner app as their listing.</>
            : "Added for a broker: it becomes their own listing in the partner app once they join MovEazy Partners on a Premium plan (matched on the broker's email, else mobile)."}
        </span>
      )}
    </div>
  );
}
