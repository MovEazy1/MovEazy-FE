/**
 * The areas: the one list every area picker shows — the tenant's
 * questionnaire, List my Flat, the owner, partner and society apps, and the
 * CRM's own forms (lib/areas.js; table `areas`, MovEazy-BE/supabase/areas.sql).
 *
 * Add an area; say whether tenants see it as a quick chip; put it inside a
 * wider one (asking for "HSR Extension" then reaches "Kudlu Gate" flats);
 * arrange the order the chips show in; remove it — it leaves every picker,
 * while flats and clients already in it keep it — or add it back.
 *
 * Only the super admin changes the list; everyone else in the CRM sees it.
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, MapPin, Pencil, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Toast } from "./crmUi";
import { isSuperAdminEmail } from "../../lib/adminScopes";
import { reorderAreas, saveArea, useAreas } from "../../lib/areas";

const norm = (s) => String(s || "").trim().toLowerCase();

export default function CrmAreasPage() {
  const { inventory, access } = useCrm();
  const canEdit = isSuperAdminEmail(access.email);
  const { rows, chips, loaded } = useAreas();
  const [tab, setTab] = useState("on");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ name: "", parent_id: "", chip: false });
  const [renaming, setRenaming] = useState(null); // { id, name }

  const say = (message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); };
  const on = rows.filter((r) => r.active);
  const off = rows.filter((r) => !r.active);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const hasChildren = useMemo(() => new Set(rows.map((r) => r.parent_id).filter(Boolean)), [rows]);
  // A wider area is one that isn't itself inside another.
  const parents = on.filter((r) => !r.parent_id);

  // How many flats each area holds (their area, or "also maps to").
  const flats = useMemo(() => {
    const m = new Map();
    for (const l of inventory ?? []) {
      for (const a of new Set([l.area, ...(l.nearby_areas ?? [])].map(norm).filter(Boolean))) m.set(a, (m.get(a) || 0) + 1);
    }
    return m;
  }, [inventory]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) say(ok);
      return true;
    } catch (e) {
      say(e?.message || "Couldn't change the list", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const done = await run(() => saveArea({ name, chip: draft.chip, parent_id: draft.parent_id || null }), `${name} added`);
    if (done) setDraft({ name: "", parent_id: "", chip: false });
  };
  const move = (k, dir) => {
    const ids = on.map((r) => r.id);
    const j = k + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[k], ids[j]] = [ids[j], ids[k]];
    run(() => reorderAreas(ids));
  };
  const rename = async () => {
    const name = renaming.name.trim();
    if (!name || name === byId.get(renaming.id)?.name) { setRenaming(null); return; }
    if (await run(() => saveArea({ id: renaming.id, name }), "Renamed")) setRenaming(null);
  };

  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Areas</h1>
          <p style={{ color: C.textDim, fontSize: 13.5, margin: 0, maxWidth: "70ch", lineHeight: 1.6 }}>
            The one list every area picker shows: tenants choosing where they want to live, owners and partners
            listing a flat, the society app and the CRM's own forms. Nobody can type an area that isn't here.
            {!canEdit && " Only the super admin can change it."}
          </p>
        </div>

        {canEdit && (
          <div className="crm-wrap" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 12, border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface }}>
            <input className="crm-input" style={{ flex: "1 1 200px", minWidth: 0 }} placeholder="New area, e.g. Bommanahalli" maxLength={60}
              value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="New area name" />
            <select className="crm-input" style={{ flex: "0 1 210px" }} value={draft.parent_id} onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })} aria-label="Inside a wider area">
              <option value="">Not inside another area</option>
              {parents.map((p) => <option key={p.id} value={p.id}>Inside {p.name}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.textDim, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.chip} onChange={(e) => setDraft({ ...draft, chip: e.target.checked })} /> Quick chip for tenants
            </label>
            <Btn variant="primary" disabled={busy || draft.name.trim().length < 2} onClick={add}>+ Add area</Btn>
          </div>
        )}

        <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Tenants' quick chips, in order: </strong>
          {chips.length ? chips.join(" · ") : "none — tenants find every area by searching"}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Chip on={tab === "on"} onClick={() => setTab("on")}>On the list · {on.length}</Chip>
          <Chip on={tab === "off"} onClick={() => setTab("off")}>Removed · {off.length}</Chip>
        </div>

        {!loaded && <span className="crm-mute" style={{ fontSize: 12 }}>Loading the list…</span>}

        {tab === "on" && (on.length === 0 ? <Empty>No areas on the list yet.</Empty> : (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            {on.map((r, k) => {
              const parent = r.parent_id && byId.get(r.parent_id);
              const n = flats.get(norm(r.name)) || 0;
              return (
                <div key={r.id} className="crm-wrap" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: k ? `1px solid ${C.lineSoft}` : "none", flexWrap: "wrap" }}>
                  {canEdit && (
                    <span style={{ display: "flex", gap: 2 }}>
                      <button type="button" className="crm-btn" style={{ padding: 4 }} disabled={busy || k === 0} onClick={() => move(k, -1)} aria-label={`Move ${r.name} up`}><ArrowUp size={14} /></button>
                      <button type="button" className="crm-btn" style={{ padding: 4 }} disabled={busy || k === on.length - 1} onClick={() => move(k, 1)} aria-label={`Move ${r.name} down`}><ArrowDown size={14} /></button>
                    </span>
                  )}
                  <span style={{ flex: "1 1 180px", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <MapPin size={14} color={C.textMute} style={{ flexShrink: 0 }} />
                    {renaming?.id === r.id ? (
                      <>
                        <input className="crm-input" autoFocus value={renaming.name} maxLength={60} style={{ flex: 1, minWidth: 0 }}
                          onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(null); }} aria-label="Area name" />
                        <button type="button" className="crm-btn" style={{ padding: 4 }} disabled={busy} onClick={rename} aria-label="Save name"><Check size={14} /></button>
                        <button type="button" className="crm-btn" style={{ padding: 4 }} onClick={() => setRenaming(null)} aria-label="Cancel"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <strong style={{ fontSize: 14 }}>{r.name}</strong>
                        {parent && <span className="crm-mute" style={{ fontSize: 12 }}>in {parent.name}</span>}
                        {canEdit && <button type="button" className="crm-btn" style={{ padding: 3, border: "none", background: "transparent" }} onClick={() => setRenaming({ id: r.id, name: r.name })} aria-label={`Rename ${r.name}`}><Pencil size={13} color={C.textMute} /></button>}
                      </>
                    )}
                  </span>
                  <span className="crm-mute" style={{ fontSize: 12, minWidth: 54 }}>{n} flat{n === 1 ? "" : "s"}</span>
                  {canEdit ? (
                    <>
                      <Chip on={r.chip} onClick={() => !busy && run(() => saveArea({ id: r.id, chip: !r.chip }))}>{r.chip ? "Quick chip" : "Search only"}</Chip>
                      <select className="crm-input" style={{ width: 190 }} value={r.parent_id || ""} disabled={busy || hasChildren.has(r.id)}
                        title={hasChildren.has(r.id) ? "Other areas sit inside this one" : ""}
                        onChange={(e) => run(() => saveArea({ id: r.id, parent_id: e.target.value || null }))} aria-label={`Wider area for ${r.name}`}>
                        <option value="">{hasChildren.has(r.id) ? "Has areas inside" : "Not inside another"}</option>
                        {parents.filter((p) => p.id !== r.id).map((p) => <option key={p.id} value={p.id}>Inside {p.name}</option>)}
                      </select>
                      <Btn sm variant="danger" disabled={busy} onClick={() => run(() => saveArea({ id: r.id, active: false }), `${r.name} removed from the pickers`)}>Remove</Btn>
                    </>
                  ) : (
                    <span className="crm-mute" style={{ fontSize: 12 }}>{r.chip ? "Quick chip" : "Search only"}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {tab === "off" && (
          <>
            <p className="crm-mute" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              Removed areas are on no picker. Flats and clients already in them keep the name. Add one back and it goes to the end of the list.
            </p>
            {off.length === 0 ? <Empty>Nothing removed.</Empty> : (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                {off.map((r, k) => {
                  const n = flats.get(norm(r.name)) || 0;
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: k ? `1px solid ${C.lineSoft}` : "none" }}>
                      <MapPin size={14} color={C.textMute} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.textDim }}>{r.name}</span>
                      <span className="crm-mute" style={{ fontSize: 12 }}>{n} flat{n === 1 ? "" : "s"}</span>
                      {canEdit && <Btn sm disabled={busy} onClick={() => run(() => saveArea({ id: r.id, active: true }), `${r.name} is back on the list`)}>Add back</Btn>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
