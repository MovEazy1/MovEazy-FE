/**
 * The MovEazy team's tenants for a building (building_tenant_tracks.sql):
 * the "Add tenant" bar at the top of the building in the CRM, the form that
 * adds a tenant or moves them along — Visit done / pending, liked or not, and
 * then where they stand or why not — and their cards in Calls & feedback.
 * A reason typed under "Any other issue" is offered on every building after.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Btn, C, Chip } from "./crmUi";
import { removeTenantReason, saveTenantTrack } from "../../lib/crmPropertyInternal";
import { DISLIKE_REASONS, LIKED_STATUSES, trackSummary } from "../../lib/buildings";

const tone = (t) => (t.liked_status === "paid_token" ? C.accent : t.liked_status === "will_pay_token" ? C.gold : t.liked === "disliked" ? C.coral : C.textDim);

/** The bar at the top of the building: add a tenant. */
export function TenantTrackBar({ count, onAdd }) {
  return (
    <button type="button" onClick={onAdd}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", border: 0, borderBottom: `1px solid ${C.line}`,
        background: C.accent, color: "#fff", padding: "11px 16px", font: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Plus size={18} /> Add tenant &amp; status</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.9 }}>{count} tenant{count === 1 ? "" : "s"}</span>
    </button>
  );
}

/** The tenants in the building's Calls & feedback, newest first. Tap one to update. */
export function TenantTrackList({ tracks, onOpen }) {
  if (!tracks.length) return <span className="crm-mute" style={{ fontSize: 12 }}>No tenants added yet — use the bar at the top.</span>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {tracks.map((t) => (
        <button key={t.id} type="button" onClick={() => onOpen(t)}
          style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", background: "#fff", cursor: "pointer", font: "inherit", fontSize: 12.5 }}>
          <strong>{t.name || "Tenant"}</strong> · {t.phone}
          {(t.flats ?? []).length > 0 && <span className="crm-mute"> · flat {t.flats.join(", ")}</span>}
          <div style={{ color: tone(t), fontWeight: 600, marginTop: 2 }}>{trackSummary(t)}</div>
          {t.note && <div className="crm-mute" style={{ marginTop: 2 }}>{t.note}</div>}
          <div className="crm-mute" style={{ fontSize: 11, marginTop: 2 }}>
            {new Date(t.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            {t.updated_by ? ` · ${t.updated_by}` : ""}
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Add a tenant (`track` empty, or just { phone, name } from the QR) or update their card. `flats`: the building's flats
 * ({ property_id, unit_no }); `reasons`: the typed ones on offer ({ id, label }).
 */
export function TenantTrackSheet({ buildingId, flats, track, reasons, onClose, onSaved, onReasonsChange }) {
  const [f, setF] = useState(() => ({
    phone: track?.phone || "", name: track?.name || "", note: track?.note || "",
    property_ids: track?.property_ids ?? [], visit: track?.visit || "pending", liked: track?.liked || "",
    liked_status: track?.liked_status || "", reasons: track?.reasons ?? [], follow_up_on: track?.follow_up_on || "",
  }));
  const isCard = Boolean(track?.id);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const toggle = (key, v) => setF((cur) => ({ ...cur, [key]: cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v] }));
  const offered = [...DISLIKE_REASONS, ...reasons.map((r) => ({ id: r.label, label: r.label, custom: r.id }))];
  // A typed reason on this card that's no longer on the list still shows, so it can be unticked.
  for (const r of f.reasons) if (!offered.some((o) => o.id === r)) offered.push({ id: r, label: r });

  const addOther = () => {
    const v = other.trim().replace(/\s+/g, " ");
    if (v.length < 2) return;
    if (!f.reasons.some((r) => r.toLowerCase() === v.toLowerCase())) set({ reasons: [...f.reasons, v] });
    setOther("");
  };
  const removeOption = async (r) => {
    try { await removeTenantReason(r.custom); onReasonsChange?.(); set({ reasons: f.reasons.filter((x) => x !== r.id) }); }
    catch (e) { setErr(e?.message || "Couldn't remove it."); }
  };
  const save = async () => {
    const digits = f.phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) { setErr("Enter the tenant's 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    try {
      const pending = other.trim().length >= 2 && !f.reasons.includes(other.trim()) ? [other.trim()] : [];
      const saved = await saveTenantTrack(buildingId, { ...f, phone: digits, reasons: [...f.reasons, ...pending] });
      onSaved(saved);
    } catch (e) {
      setErr(e?.message || "Couldn't save. Please try again.");
      setBusy(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 6px" };
  const row = { display: "flex", gap: 6, flexWrap: "wrap" };
  return (
    <div role="dialog" aria-label={isCard ? "Update tenant" : "Add tenant"} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,34,30,.35)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px, 100%)", height: "100%", background: C.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 34px rgba(16,34,30,.18)" }}>
        <div className="crm-colhead">
          <span className="crm-label">{isCard ? `Update ${track.name || track.phone}` : track?.phone ? `Add status · ${track.name || track.phone}` : "Add tenant"}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="crm-scroll" style={{ flex: 1, padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="crm-input" inputMode="tel" placeholder="Tenant's mobile *" value={f.phone} disabled={Boolean(track?.phone)}
              onChange={(e) => set({ phone: e.target.value })} />
            <input className="crm-input" placeholder="Name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          {flats.length > 0 && (
            <div>
              <div style={label}>Flats they saw</div>
              <div style={row}>
                {flats.map((x) => (
                  <Chip key={x.property_id} on={f.property_ids.includes(x.property_id)} onClick={() => toggle("property_ids", x.property_id)}>
                    {x.unit_no || x.property_id}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={label}>Visit</div>
            <div style={row}>
              <Chip on={f.visit === "done"} onClick={() => set({ visit: "done" })}>Visit Done</Chip>
              <Chip on={f.visit === "pending"} onClick={() => set({ visit: "pending" })}>Visit Pending</Chip>
            </div>
          </div>

          {f.visit === "done" && (
            <div>
              <div style={label}>The flat</div>
              <div style={row}>
                <Chip on={f.liked === "liked"} onClick={() => set({ liked: "liked" })}>Liked the flat</Chip>
                <Chip on={f.liked === "disliked"} onClick={() => set({ liked: "disliked" })}>Did not like the flat</Chip>
              </div>
            </div>
          )}

          {f.visit === "done" && f.liked === "liked" && (
            <div>
              <div style={label}>Where they are</div>
              <div style={row}>
                {LIKED_STATUSES.map((s) => (
                  <Chip key={s.id} on={f.liked_status === s.id} onClick={() => set({ liked_status: f.liked_status === s.id ? "" : s.id })}>{s.label}</Chip>
                ))}
              </div>
              {f.liked_status === "paid_token" && (
                <div className="crm-mute" style={{ fontSize: 11.5, marginTop: 6 }}>
                  {f.property_ids.length ? "The flats picked above are marked booked on the QR page." : "Pick the flat above to mark it booked on the QR page."}
                </div>
              )}
            </div>
          )}

          {f.visit === "done" && f.liked === "disliked" && (
            <div>
              <div style={label}>Why not (pick any)</div>
              <div style={row}>
                {offered.map((r) => (
                  <span key={r.id} style={{ display: "inline-flex", alignItems: "center" }}>
                    <Chip on={f.reasons.includes(r.id)} onClick={() => toggle("reasons", r.id)}>{r.label}</Chip>
                    {r.custom && (
                      <button type="button" aria-label={`Remove "${r.label}" from the list`} onClick={() => removeOption(r)}
                        style={{ border: 0, background: "none", cursor: "pointer", color: C.textMute, padding: "0 2px" }}><X size={13} /></button>
                    )}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input className="crm-input" placeholder="Any other issue — type it" value={other} maxLength={60}
                  onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} />
                <Btn onClick={addOther} disabled={other.trim().length < 2}>Add</Btn>
              </div>
              <div className="crm-mute" style={{ fontSize: 11, marginTop: 4 }}>A reason you add here is offered on every building from now on.</div>
            </div>
          )}

          <div>
            <div style={label}>Follow up on</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input className="crm-input" type="date" value={f.follow_up_on} onChange={(e) => set({ follow_up_on: e.target.value })} style={{ maxWidth: 200 }} />
              {f.follow_up_on && <Btn sm onClick={() => set({ follow_up_on: "" })}>Clear</Btn>}
            </div>
          </div>

          <textarea className="crm-input" rows={2} placeholder="Note" value={f.note} maxLength={1000} onChange={(e) => set({ note: e.target.value })} />
          {err && <div style={{ color: C.coral, fontSize: 12.5, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
          <Btn variant="primary" onClick={save} disabled={busy} style={{ width: "100%" }}>{busy ? "Saving…" : isCard ? "Update" : "Save"}</Btn>
        </div>
      </div>
    </div>
  );
}
