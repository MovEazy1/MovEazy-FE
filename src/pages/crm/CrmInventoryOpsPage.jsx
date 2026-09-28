/**
 * Inventory Ops — the team's side of the owner app.
 *
 *   Requests   repairs, service bookings and Home Designer calls, worked from
 *              open to resolved: vendor, schedule, quote (at or above the
 *              approval limit it waits for the owner), final cost, notes.
 *   Owners     who has signed up, auto-approve, approve / suspend, and linking
 *              a flat the team listed to the owner it belongs to.
 *   Catalogue  the services owners can book, with "from" prices.
 *
 * Every write goes through owner_schema.sql, which checks inventory.ops itself;
 * disabled buttons here are only a courtesy. Staff can read everything here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Toast, inr, shortDate } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { whatsappUrl } from "../../lib/crmSettings";
import { fetchNotifications, markNotificationRead } from "../../lib/crmPayments";
import { formatForDisplay } from "../../lib/mobile";
import {
  REQUEST_STATUS, SLOTS, adminLinkProperty, adminListOwners, adminOwnerSettings, adminSetOwnerStatus,
  adminUnlinkProperty, fetchOpsData, friendlyError, opsUpdateRequest, saveCatalogueItem, signedUrl,
} from "../../lib/owners";
import { coverPhoto } from "../../lib/listingMedia";

const KIND_LABEL = { repair: "Repair", service: "Service", designer_call: "Designer call" };
const STATUSES = ["open", "scheduled", "in_progress", "awaiting_approval", "resolved", "cancelled"];
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function RequestPanel({ req, owner, listingById, tenants, canWrite, threshold, onSaved, onToast }) {
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    setF({
      status: req.status, vendor_name: req.vendor_name, vendor_phone: req.vendor_phone,
      scheduled_at: toLocalInput(req.scheduled_at), quote_amount: req.quote_amount ?? "", quote_note: req.quote_note,
      final_cost: req.final_cost ?? "", assigned_to: req.assigned_to, internal_note: req.internal_note, message: "", message_internal: false,
    });
    let alive = true;
    Promise.all((req.photos ?? []).map((p) => signedUrl(p, 900))).then((u) => { if (alive) setPhotos(u.filter(Boolean)); });
    return () => { alive = false; };
  }, [req]);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        vendor_name: f.vendor_name, vendor_phone: f.vendor_phone,
        scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : "",
        quote_note: f.quote_note, final_cost: f.final_cost === "" ? "" : String(f.final_cost),
        assigned_to: f.assigned_to, internal_note: f.internal_note,
      };
      if (f.status !== req.status) patch.status = f.status;
      if (String(f.quote_amount) !== String(req.quote_amount ?? "") && f.quote_amount !== "") patch.quote_amount = String(f.quote_amount);
      if (f.message.trim()) { patch.message = f.message.trim(); patch.message_internal = f.message_internal; }
      await opsUpdateRequest(req.id, patch);
      onToast("Request updated");
      onSaved();
    } catch (e) {
      onToast(friendlyError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const props = (req.property_ids?.length ? req.property_ids : [req.property_id]).map((id) => listingById.get(id) || { property_id: id });
  const people = tenants.filter((t) => props.some((p) => p.property_id === t.property_id));
  const input = (key, props2 = {}) => (
    <input className="crm-input" value={f[key] ?? ""} disabled={!canWrite} onChange={(e) => set({ [key]: e.target.value })} {...props2} />
  );

  return (
    <div style={{ display: "grid", gap: 10, padding: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{req.title}</div>
        <div className="crm-mute" style={{ fontSize: 11.5 }}>
          {KIND_LABEL[req.kind]} · raised {shortDate(req.created_at)} · prefers {req.preferred_date ? shortDate(req.preferred_date) : "any day"}, {SLOTS.find((s) => s[0] === req.preferred_slot)?.[1] || "any time"}
        </div>
      </div>

      <div className="crm-card" style={{ display: "grid", gap: 4 }}>
        <span className="crm-label">Owner</span>
        <span style={{ fontSize: 12.5 }}>{owner?.name || "—"} · {owner?.email}</span>
        {owner?.phone && (
          <a href={whatsappUrl(owner.phone, `Hi ${owner.name?.split(" ")[0] || ""}, this is MovEazy about your request "${req.title}".`)}
            target="_blank" rel="noreferrer" style={{ color: C.wa, fontSize: 12.5, fontWeight: 600 }}>WhatsApp {formatForDisplay(owner.phone)}</a>
        )}
      </div>

      <div className="crm-card" style={{ display: "grid", gap: 6 }}>
        <span className="crm-label">{props.length > 1 ? `Properties · ${props.length}` : "Property"}</span>
        {props.map((p) => {
          const cover = p.cover_image_url || coverPhoto(p.images ?? []);
          return (
            <div key={p.property_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {cover ? <img src={cover} alt="" style={{ width: 54, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <span style={{ width: 54, height: 40, background: C.surfaceAlt, borderRadius: 6 }} />}
              <span style={{ fontSize: 12, minWidth: 0 }}>
                <Link to={`/crm/properties/${p.property_id}/edit`} style={{ color: C.accent, fontWeight: 700 }}>{p.property_id}</Link>
                {" "}{[p.flat_type, p.area].filter(Boolean).join(" · ")}
                {req.kind === "designer_call" && (p.images ?? []).length > 0 && (
                  <span className="crm-mute"> · {(p.images ?? []).map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" style={{ color: C.accent }}>{i ? ", " : ""}{i + 1}</a>))} photos</span>
                )}
                {req.kind === "designer_call" && !(p.images ?? []).length && <span className="crm-mute"> · no photos yet</span>}
              </span>
            </div>
          );
        })}
        {people.length > 0 && (
          <span className="crm-mute" style={{ fontSize: 11.5 }}>
            Tenant{people.length > 1 ? "s" : ""} for access: {people.map((t) => `${t.name}${t.phone ? ` ${formatForDisplay(t.phone)}` : ""}`).join(", ")}
          </span>
        )}
      </div>

      {(req.description || photos.length > 0) && (
        <div className="crm-card">
          {req.description && <p style={{ margin: 0, fontSize: 12.5, whiteSpace: "pre-wrap" }}>{req.description}</p>}
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} /></a>)}
            </div>
          )}
        </div>
      )}

      <div className="crm-card" style={{ display: "grid", gap: 7 }}>
        <span className="crm-label">Work it</span>
        <label style={{ display: "grid", gap: 3 }}><span className="crm-mute" style={{ fontSize: 11 }}>Status</span>
          <select className="crm-input" value={f.status} disabled={!canWrite} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {input("vendor_name", { placeholder: "Vendor / professional" })}
          {input("vendor_phone", { placeholder: "Vendor phone", inputMode: "tel" })}
        </div>
        <label style={{ display: "grid", gap: 3 }}><span className="crm-mute" style={{ fontSize: 11 }}>Scheduled for</span>
          {input("scheduled_at", { type: "datetime-local" })}
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <label style={{ display: "grid", gap: 3 }}><span className="crm-mute" style={{ fontSize: 11 }}>Quote (₹) — owner approves ≥ {inr(threshold)}</span>
            {input("quote_amount", { inputMode: "numeric" })}</label>
          <label style={{ display: "grid", gap: 3 }}><span className="crm-mute" style={{ fontSize: 11 }}>Final cost (₹)</span>
            {input("final_cost", { inputMode: "numeric" })}</label>
        </div>
        {input("quote_note", { placeholder: "What the quote covers (the owner sees this)" })}
        {input("assigned_to", { placeholder: "Assigned to (staff email)" })}
        <textarea className="crm-input" rows={2} value={f.internal_note ?? ""} disabled={!canWrite} placeholder="Internal note — never shown to the owner"
          onChange={(e) => set({ internal_note: e.target.value })} />
        <textarea className="crm-input" rows={2} value={f.message ?? ""} disabled={!canWrite} placeholder="Update for the timeline"
          onChange={(e) => set({ message: e.target.value })} />
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11.5 }}>
          <input type="checkbox" checked={Boolean(f.message_internal)} disabled={!canWrite} onChange={(e) => set({ message_internal: e.target.checked })} />
          Keep this update internal
        </label>
        <Btn variant="primary" onClick={save} disabled={!canWrite || saving}>{saving ? "Saving…" : "Save"}</Btn>
        {!canWrite && <span className="crm-mute" style={{ fontSize: 11 }}>You need the Inventory Ops permission to change requests.</span>}
      </div>

      <div className="crm-card" style={{ display: "grid", gap: 4 }}>
        <span className="crm-label">Timeline</span>
        {req.events.map((e) => (
          <div key={e.id} style={{ fontSize: 12 }}>
            <span className="crm-mute crm-num">{shortDate(e.at)} {new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
            {" · "}<strong>{e.actor}</strong>{" "}{e.message}{!e.visible_to_owner && <span className="crm-mute"> (internal)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsView({ data, listingById, canWrite, reload, onToast }) {
  const [status, setStatus] = useState("active");
  const [kind, setKind] = useState("");
  const [openId, setOpenId] = useState("");
  const ownerBy = useMemo(() => new Map(data.owners.map((o) => [o.user_id, o])), [data.owners]);
  const rows = data.requests.filter((r) =>
    (status === "all" || (status === "active" ? !["resolved", "cancelled"].includes(r.status) : r.status === status))
    && (!kind || r.kind === kind));
  const open = data.requests.find((r) => r.id === openId);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", flex: "none" }}>
          {[["active", "Active"], ["awaiting_approval", "Awaiting owner"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => (
            <Chip key={k} on={status === k} onClick={() => setStatus(k)}>{l}</Chip>
          ))}
          <span style={{ width: 10 }} />
          {[["", "Every kind"], ["repair", "Repairs"], ["service", "Services"], ["designer_call", "Designer calls"]].map(([k, l]) => (
            <Chip key={k || "any"} on={kind === k} onClick={() => setKind(k)}>{l}</Chip>
          ))}
        </div>
        <div className="crm-scroll" style={{ flex: 1 }}>
          {rows.length === 0 ? <Empty>No requests here.</Empty> : (
            <table className="crm-table">
              <thead><tr><th>Raised</th><th>Kind</th><th>Request</th><th>Property</th><th>Owner</th><th>Status</th><th>Quote</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const o = ownerBy.get(r.owner_id);
                  const st = REQUEST_STATUS[r.status];
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} style={{ cursor: "pointer", background: r.id === openId ? C.surfaceAlt : undefined }}>
                      <td className="crm-mute crm-num">{shortDate(r.created_at)}</td>
                      <td>{KIND_LABEL[r.kind]}</td>
                      <td style={{ fontWeight: 600 }}>{r.title}</td>
                      <td className="crm-num">{r.property_id}{(r.property_ids ?? []).length > 1 ? ` +${r.property_ids.length - 1}` : ""}</td>
                      <td>{o?.name || "—"}</td>
                      <td><span style={{ fontWeight: 700, color: st?.tone === "red" ? C.coral : st?.tone === "green" ? C.accent : st?.tone === "amber" ? C.gold : C.text }}>{st?.label}</span></td>
                      <td className="crm-num">{r.quote_amount != null ? `${inr(r.quote_amount)} · ${r.quote_status}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {open && (
        <div className="crm-col" style={{ width: 380, flex: "none" }}>
          <div className="crm-colhead"><span className="crm-label">Request</span><Btn sm onClick={() => setOpenId("")}>Close</Btn></div>
          <div className="crm-scroll" style={{ flex: 1 }}>
            <RequestPanel req={open} owner={ownerBy.get(open.owner_id)} listingById={listingById} tenants={data.tenants}
              canWrite={canWrite} threshold={data.settings?.quote_approval_threshold ?? 2000} onSaved={reload} onToast={onToast} />
          </div>
        </div>
      )}
    </div>
  );
}

function OwnersView({ data, listingById, canWrite, reload, onToast }) {
  const [owners, setOwners] = useState(null);
  const [link, setLink] = useState({ property: "", owner: "" });
  const [threshold, setThreshold] = useState(String(data.settings?.quote_approval_threshold ?? 2000));
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState("");

  const load = useCallback(() => adminListOwners().then(setOwners, (e) => { setOwners([]); onToast(friendlyError(e), "error"); }), [onToast]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); await Promise.all([load(), reload()]); onToast(ok); }
    catch (e) { onToast(friendlyError(e), "error"); }
    finally { setBusy(""); }
  };
  const linksBy = useMemo(() => {
    const m = new Map();
    for (const l of data.links) { if (!m.has(l.owner_id)) m.set(l.owner_id, []); m.get(l.owner_id).push(l); }
    return m;
  }, [data.links]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: `1px solid ${C.line}`, background: C.surface, display: "grid", gap: 10, flex: "none" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" style={{ width: 16, height: 16, marginTop: 2 }} checked={data.settings?.auto_approve ?? true}
            disabled={!canWrite || busy === "auto"}
            onChange={(e) => { const on = e.target.checked; act("auto", () => adminOwnerSettings({ autoApprove: on }), on ? "Owners are approved automatically" : "New owners now wait for approval"); }} />
          <span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Automatic approval</span>
            <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>
              Ticked: an owner is in as soon as they sign in with Google and verify their mobile. Unticked: they wait on a verification screen.
              {data.settings?.updated_by ? ` Last changed by ${data.settings.updated_by} on ${shortDate(data.settings.updated_at)}.` : ""}
            </span>
          </span>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="crm-label" style={{ flex: "none" }}>Owner approves quotes from ₹</span>
          <input className="crm-input" style={{ width: 100 }} inputMode="numeric" value={threshold} disabled={!canWrite}
            onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ""))} />
          <Btn sm disabled={!canWrite || busy === "thr"} onClick={() => act("thr", () => adminOwnerSettings({ threshold: Number(threshold) || 0 }), "Approval limit saved")}>Save</Btn>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="crm-label" style={{ flex: "none" }}>Link a flat</span>
          <input className="crm-input" style={{ width: 130 }} placeholder="MZ-XXXXXX" value={link.property}
            onChange={(e) => setLink((l) => ({ ...l, property: e.target.value.toUpperCase() }))} />
          <select className="crm-input" value={link.owner} onChange={(e) => setLink((l) => ({ ...l, owner: e.target.value }))}>
            <option value="">to owner…</option>
            {(owners ?? []).map((o) => <option key={o.user_id} value={o.user_id}>{o.name || o.email} · {formatForDisplay(o.phone)}</option>)}
          </select>
          <Btn sm variant="primary" disabled={!canWrite || !link.property || !link.owner || busy === "link"}
            onClick={() => act("link", () => adminLinkProperty(link.property, link.owner), `${link.property} linked`).then(() => setLink({ property: "", owner: "" }))}>
            Link
          </Btn>
          <span className="crm-mute" style={{ fontSize: 11 }}>Check the owner's number against the listing's contact first — linking gives them its tenants and requests.</span>
        </div>
      </div>
      <div className="crm-scroll" style={{ flex: 1 }}>
        {owners === null ? <Empty>Loading owners…</Empty> : owners.length === 0 ? <Empty>No owner has signed up yet.</Empty> : (
          <table className="crm-table">
            <thead><tr><th>Owner</th><th>Mobile</th><th>Status</th><th>Joined</th><th>Flats</th><th>Tenants</th><th>Open requests</th><th /></tr></thead>
            <tbody>
              {owners.flatMap((o) => {
                const mine = linksBy.get(o.user_id) ?? [];
                const rows = [(
                  <tr key={o.user_id}>
                    <td><div style={{ fontWeight: 600 }}>{o.name || "—"}</div><div className="crm-mute" style={{ fontSize: 11 }}>{o.email}</div></td>
                    <td className="crm-num">{o.phone ? <a href={whatsappUrl(o.phone, `Hi ${o.name?.split(" ")[0] || ""}, this is MovEazy about your owner account.`)} target="_blank" rel="noreferrer" style={{ color: C.text }}>{formatForDisplay(o.phone)}</a> : "—"}</td>
                    <td><span style={{ fontWeight: 700, textTransform: "capitalize", color: o.status === "approved" ? C.accent : o.status === "pending" ? C.gold : C.coral }}>{o.status}</span>
                      {o.approved_by === "auto" && <div className="crm-mute" style={{ fontSize: 10.5 }}>auto-approved</div>}</td>
                    <td className="crm-mute crm-num">{shortDate(o.created_at)}</td>
                    <td className="crm-num"><button type="button" className="crm-btn crm-btn--sm" onClick={() => setOpenId(openId === o.user_id ? "" : o.user_id)}>{o.property_count}</button></td>
                    <td className="crm-num">{o.tenant_count}</td>
                    <td className="crm-num">{o.open_requests}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        {o.status !== "approved" && <Btn sm variant="primary" disabled={!canWrite || !!busy} onClick={() => act(o.user_id, () => adminSetOwnerStatus(o.user_id, "approved"), `${o.name} approved`)}>{o.status === "suspended" ? "Reinstate" : "Approve"}</Btn>}
                        {o.status !== "suspended" && <Btn sm disabled={!canWrite || !!busy} onClick={() => window.confirm(`Suspend ${o.name}? They lose access to the owner app.`) && act(o.user_id, () => adminSetOwnerStatus(o.user_id, "suspended"), `${o.name} suspended`)}>Suspend</Btn>}
                      </div>
                    </td>
                  </tr>
                )];
                if (openId === o.user_id) {
                  rows.push(
                    <tr key={`${o.user_id}-flats`}>
                      <td colSpan={8} style={{ background: C.surface }}>
                        {mine.length === 0 ? <span className="crm-mute" style={{ fontSize: 12 }}>No flats linked.</span> : mine.map((l) => {
                          const f = listingById.get(l.property_id);
                          return (
                            <div key={l.property_id} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12 }} className="crm-num">
                              <Link to={`/crm/properties/${l.property_id}/edit`} style={{ color: C.accent, fontWeight: 700 }}>{l.property_id}</Link>
                              <span>{f ? `${f.flat_type || "—"} · ${f.area || "—"} · ${inr(f.rent)} · ${f.status}` : ""}</span>
                              <span className="crm-mute">linked {l.linked_by === "auto" ? "automatically" : `by ${l.linked_by}`} {shortDate(l.linked_at)}</span>
                              {canWrite && <button type="button" className="crm-btn crm-btn--sm" onClick={() => window.confirm(`Unlink ${l.property_id} from ${o.name}?`) && act(`u-${l.property_id}`, () => adminUnlinkProperty(l.property_id), "Unlinked")}>Unlink</button>}
                            </div>
                          );
                        })}
                      </td>
                    </tr>,
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CatalogueView({ data, canWrite, reload, onToast }) {
  const [rows, setRows] = useState(() => data.catalogue.map((c) => ({ ...c })));
  const [busy, setBusy] = useState("");
  useEffect(() => { setRows(data.catalogue.map((c) => ({ ...c }))); }, [data.catalogue]);
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async (r) => {
    setBusy(r.id || "new");
    try { await saveCatalogueItem(r); await reload(); onToast(`${r.title} saved`); }
    catch (e) { onToast(friendlyError(e), "error"); }
    finally { setBusy(""); }
  };
  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <table className="crm-table">
        <thead><tr><th>Id</th><th>Category</th><th>Title</th><th>From ₹</th><th>Summary</th><th>Included (one per line)</th><th>Duration</th><th>Popular</th><th>Live</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || `new-${i}`}>
              <td><input className="crm-input" style={{ width: 120 }} value={r.id} disabled={!canWrite || data.catalogue.some((c) => c.id === r.id)} onChange={(e) => set(i, { id: e.target.value })} /></td>
              <td><select className="crm-input" value={r.category} disabled={!canWrite} onChange={(e) => set(i, { category: e.target.value })}>
                {["cleaning", "repairs", "appliances", "painting", "other"].map((c) => <option key={c}>{c}</option>)}</select></td>
              <td><input className="crm-input" value={r.title} disabled={!canWrite} onChange={(e) => set(i, { title: e.target.value })} /></td>
              <td><input className="crm-input" style={{ width: 80 }} inputMode="numeric" value={r.from_price} disabled={!canWrite} onChange={(e) => set(i, { from_price: e.target.value.replace(/\D/g, "") })} /></td>
              <td><input className="crm-input" value={r.summary} disabled={!canWrite} onChange={(e) => set(i, { summary: e.target.value })} /></td>
              <td><textarea className="crm-input" rows={2} value={r.scope} disabled={!canWrite} onChange={(e) => set(i, { scope: e.target.value })} /></td>
              <td><input className="crm-input" style={{ width: 90 }} value={r.duration} disabled={!canWrite} onChange={(e) => set(i, { duration: e.target.value })} /></td>
              <td><input type="checkbox" checked={Boolean(r.popular)} disabled={!canWrite} onChange={(e) => set(i, { popular: e.target.checked })} /></td>
              <td><input type="checkbox" checked={r.active !== false} disabled={!canWrite} onChange={(e) => set(i, { active: e.target.checked })} /></td>
              <td><Btn sm variant="primary" disabled={!canWrite || busy === (r.id || "new")} onClick={() => save(r)}>Save</Btn></td>
            </tr>
          ))}
        </tbody>
      </table>
      {canWrite && (
        <div style={{ padding: 12 }}>
          <Btn onClick={() => setRows((rs) => [...rs, { id: "", category: "repairs", title: "", from_price: 0, summary: "", scope: "", duration: "", popular: false, active: true, sort: 100 + rs.length }])}>
            + Add a service
          </Btn>
        </div>
      )}
    </div>
  );
}

export default function CrmInventoryOpsPage() {
  const { access, inventory } = useCrm();
  const canWrite = access.has(SCOPES.INVENTORY_OPS);
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get("view") || "requests");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await fetchOpsData());
      setError("");
    } catch (e) {
      setError(friendlyError(e, "Could not load Inventory Ops."));
      setData({ requests: [], owners: [], links: [], settings: null, tenants: [], catalogue: [] });
    }
    fetchNotifications({ unreadOnly: true, type: "owner_request" }).then(setNotes);
  }, []);
  useEffect(() => { load(); }, [load]);

  const listingById = useMemo(() => new Map(inventory.map((f) => [f.property_id, f])), [inventory]);
  const counts = data ? {
    requests: data.requests.filter((r) => !["resolved", "cancelled"].includes(r.status)).length,
    owners: data.owners.length,
    catalogue: data.catalogue.filter((c) => c.active).length,
  } : {};

  const clearNotes = async () => {
    for (const n of notes) { try { await markNotificationRead(n.id); } catch { /* ignore */ } }
    setNotes([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">Inventory Ops</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {notes.length > 0 && (
            <button type="button" className="crm-btn crm-btn--sm" onClick={clearNotes} title={notes.map((n) => `${n.title} — ${n.body}`).join("\n")}>
              {notes.length} new request{notes.length > 1 ? "s" : ""} · mark seen
            </button>
          )}
          <Btn sm onClick={load}>Refresh</Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, flex: "none" }}>
        {[["requests", "Requests"], ["owners", "Owners"], ["catalogue", "Service catalogue"]].map(([k, l]) => (
          <Chip key={k} on={view === k} onClick={() => setView(k)}>{l}{data ? ` · ${counts[k]}` : ""}</Chip>
        ))}
      </div>
      {!data ? <Empty>Loading…</Empty> : error ? <Empty>{error}</Empty> : view === "owners" ? (
        <OwnersView data={data} listingById={listingById} canWrite={canWrite} reload={load} onToast={showToast} />
      ) : view === "catalogue" ? (
        <CatalogueView data={data} canWrite={canWrite} reload={load} onToast={showToast} />
      ) : (
        <RequestsView data={data} listingById={listingById} canWrite={canWrite} reload={load} onToast={showToast} />
      )}
      <Toast {...(toast ?? {})} />
    </div>
  );
}
