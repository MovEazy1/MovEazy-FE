/**
 * Brokers → Unions: the groups our partners have made (partner_group_add.sql).
 * Every CRM user sees each union with its owner and admins, and can open one
 * to add partners by mobile number (an approved partner is in at once; any
 * other number is held as "Invited" for 30 days and joins when it signs up and
 * is approved), remove members, make someone admin or hand the union to a new
 * owner, and rename it. A new union needs an approved partner as its owner.
 * Unions are not deleted here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Btn, C, Chip, Empty, Toast, shortDate } from "./crmUi";
import { whatsappUrl } from "../../lib/crmSettings";
import { formatForDisplay, normalizeIndianMobile } from "../../lib/mobile";
import {
  addedMessage, adminListPartners, cancelPendingMember, crmCreateUnion, crmListUnions, crmUnionAdd, crmUnionRemove, crmUnionSetRole,
  crmUpdateUnion, fetchGroupMembers, fetchGroupPending, friendlyError,
} from "../../lib/partners";

const ROLE_TONE = { owner: C.accent, admin: C.gold, member: C.textMute };
const phoneOf = (p) => formatForDisplay(p) || p || "";

/** "Name · phone" suggestions for the number boxes: approved partners only. */
function PartnerOptions({ id, partners }) {
  return (
    <datalist id={id}>
      {partners.map((p) => <option key={p.user_id} value={p.phone}>{[p.name, p.agency].filter(Boolean).join(" · ")}</option>)}
    </datalist>
  );
}

export default function CrmUnionsSection() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [partners, setPartners] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setRows(await crmListUnions());
      setError("");
    } catch (e) {
      setRows([]);
      setError(friendlyError(e, "Could not load unions."));
    }
  }, []);
  useEffect(() => {
    load();
    adminListPartners().then((list) => setPartners(list.filter((p) => p.status === "approved" && p.phone)), () => {});
  }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((g) => !needle
      || [g.name, g.description, ...g.admins.flatMap((a) => [a.name, a.phone])].join(" ").toLowerCase().includes(needle));
  }, [rows, q]);
  const current = open && rows?.find((g) => g.id === open);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "10px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
        <input className="crm-input" style={{ maxWidth: 260 }} placeholder="Search union, owner, admin, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="crm-mute" style={{ fontSize: 12 }}>{rows ? `${rows.length} union${rows.length === 1 ? "" : "s"}` : ""}</span>
        <Btn sm variant="primary" onClick={() => setCreating((o) => !o)}>{creating ? "Close" : "New union"}</Btn>
        <Btn sm onClick={load}>Refresh</Btn>
      </div>
      {creating && (
        <NewUnion partners={partners} onToast={showToast}
          onCreated={async (id) => { setCreating(false); await load(); setOpen(id); }} />
      )}

      <div className="crm-scroll" style={{ flex: 1 }}>
        {rows === null ? <Empty>Loading unions…</Empty> : error ? <Empty>{error}</Empty> : shown.length === 0 ? (
          <Empty>{rows.length ? "Nothing matches that." : "No partner has made a union yet."}</Empty>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Union</th><th>Owner &amp; admins</th><th>Members</th>
                <th title="Published flats shared into the union">Flats</th>
                <th title="Numbers added that join when they sign up and are approved">Invited</th>
                <th>Created</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => setOpen(g.id)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    {g.description && (
                      <div className="crm-mute" title={g.description}
                        style={{ fontSize: 11, maxWidth: 280, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {g.description}
                      </div>
                    )}
                  </td>
                  <td>
                    {g.admins.length === 0 ? <span className="crm-mute">—</span> : g.admins.map((a) => (
                      <div key={a.user_id} style={{ fontSize: 12.5 }}>
                        <span style={{ fontWeight: a.role === "owner" ? 700 : 500 }}>{a.name || "Partner"}</span>
                        <span style={{ color: ROLE_TONE[a.role], fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", marginLeft: 5 }}>{a.role}</span>
                        {a.phone && (
                          <a href={whatsappUrl(a.phone, `Hi ${a.name?.split(" ")[0] || ""}, this is MovEazy about your union ${g.name}.`)}
                            target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ color: C.textMute, marginLeft: 6 }}>{phoneOf(a.phone)}</a>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="crm-num">{g.member_count}</td>
                  <td className="crm-num">{g.property_count}</td>
                  <td className="crm-num">{g.invited_count || <span className="crm-mute">—</span>}</td>
                  <td className="crm-num crm-mute">
                    {shortDate(g.created_at)}
                    {g.created_by_name && <div style={{ fontSize: 10.5 }}>by {g.created_by_name}</div>}
                  </td>
                  <td><Btn sm onClick={(e) => { e.stopPropagation(); setOpen(g.id); }}>Open</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {current && <UnionDrawer union={current} partners={partners} onClose={() => setOpen(null)} onChanged={load} onToast={showToast} />}
      <Toast {...(toast ?? {})} />
    </div>
  );
}

function NewUnion({ partners, onCreated, onToast }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e) => {
    e.preventDefault();
    if (!normalizeIndianMobile(owner)) { onToast("Enter the owner's 10-digit mobile", "error"); return; }
    setBusy(true);
    try {
      const id = await crmCreateUnion(name.trim(), desc.trim(), owner.trim());
      onToast(`${name.trim()} created`);
      await onCreated(id);
    } catch (err) {
      onToast(friendlyError(err, "Could not create the union."), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={create} className="crm-card" style={{ margin: "0 12px 10px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ display: "grid", gap: 3, fontSize: 11.5, flex: "1 1 180px" }}>Union name
        <input className="crm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarjapur Brokers" maxLength={80} required />
      </label>
      <label style={{ display: "grid", gap: 3, fontSize: 11.5, flex: "1 1 200px" }}>Description (optional)
        <input className="crm-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Area, who it's for…" maxLength={400} />
      </label>
      <label style={{ display: "grid", gap: 3, fontSize: 11.5, flex: "1 1 170px" }}>Owner's mobile (approved partner)
        <input className="crm-input" list="union-owner-opts" inputMode="tel" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="10-digit mobile" required />
        <PartnerOptions id="union-owner-opts" partners={partners} />
      </label>
      <Btn variant="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create union"}</Btn>
      <span className="crm-mute" style={{ fontSize: 11, flexBasis: "100%" }}>The owner is told in their partner app and can add partners and admins from there.</span>
    </form>
  );
}

function UnionDrawer({ union, partners, onClose, onChanged, onToast }) {
  const [members, setMembers] = useState(null);
  const [pending, setPending] = useState([]);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [last, setLast] = useState(null);
  const [name, setName] = useState(union.name);
  const [desc, setDesc] = useState(union.description || "");

  const loadMembers = useCallback(() => Promise.all([
    fetchGroupMembers(union.id).then(setMembers, () => setMembers([])),
    fetchGroupPending(union.id).then(setPending),
  ]), [union.id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) onToast(typeof ok === "function" ? ok(r) : ok);
      await Promise.all([loadMembers(), onChanged()]);
      return r;
    } catch (e) {
      onToast(friendlyError(e), "error");
      return null;
    } finally {
      setBusy("");
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!normalizeIndianMobile(phone)) { onToast("Enter a 10-digit mobile number", "error"); return; }
    const r = await act("add", () => crmUnionAdd(union.id, phone.trim()), (x) =>
      x.status === "added" ? `${x.name || phoneOf(x.phone)} added to ${union.name}`
        : x.status === "already" ? `${x.name || phoneOf(x.phone)} is already a member`
          : `${phoneOf(x.phone)} invited — joins when they sign up and are approved`);
    if (r) { setLast(r); setPhone(""); }
  };

  const label = { fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 6px" };
  const edited = name.trim() !== union.name || desc.trim() !== (union.description || "");

  return (
    <div role="dialog" aria-label={union.name} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,34,30,.35)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} className="crm-drawer"
        style={{ width: "min(560px, 100%)", height: "100%", background: C.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 34px rgba(16,34,30,.18)" }}>
        <div className="crm-colhead">
          <span className="crm-label" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{union.name}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="crm-scroll" style={{ flex: 1, padding: 16, display: "grid", gap: 14, alignContent: "start" }}>
          <div className="crm-card" style={{ display: "grid", gap: 8 }}>
            <div style={label}>Name &amp; description</div>
            <input className="crm-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Union name" />
            <input className="crm-input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={400} placeholder="Description" aria-label="Description" />
            {edited && (
              <div><Btn sm variant="primary" disabled={!!busy} onClick={() => act("edit", () => crmUpdateUnion(union.id, name.trim(), desc.trim()), "Union saved")}>Save</Btn></div>
            )}
            <span className="crm-mute" style={{ fontSize: 11.5 }}>
              {union.member_count} members · {union.property_count} flats shared · created {shortDate(union.created_at)}{union.created_by_name ? ` by ${union.created_by_name}` : ""}
            </span>
          </div>

          <form onSubmit={add} className="crm-card" style={{ display: "grid", gap: 8 }}>
            <div style={label}>Add a partner</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="crm-input" list="union-add-opts" inputMode="tel" placeholder="Mobile number, or pick a partner" value={phone}
                onChange={(e) => setPhone(e.target.value)} style={{ flex: 1 }} />
              <PartnerOptions id="union-add-opts" partners={partners} />
              <Btn variant="primary" type="submit" disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add"}</Btn>
            </div>
            <span className="crm-mute" style={{ fontSize: 11.5 }}>
              An approved partner is in straight away and told in their app. Any other number waits as Invited for 30 days and joins when it signs up and is approved.
            </span>
            {last && last.status !== "already" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <span>{last.status === "added" ? `${last.name || phoneOf(last.phone)} added.` : `${phoneOf(last.phone)} invited.`}</span>
                <a href={whatsappUrl(last.phone, addedMessage({ groupName: union.name, groupId: union.id, fromName: "MovEazy", invited: last.status === "invited", phone: phoneOf(last.phone), name: last.name }))}
                  target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 600 }}>Tell them on WhatsApp</a>
              </div>
            )}
          </form>

          <div>
            <div style={label}>Members {members ? `(${members.length})` : ""}</div>
            {members === null ? <Empty pad={16}>Loading…</Empty> : members.length === 0 ? <Empty pad={16}>No members.</Empty> : (
              <div className="crm-card" style={{ padding: 0 }}>
                {members.map((m, i) => (
                  <div key={m.user_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "9px 12px", borderTop: i ? `1px solid ${C.line}` : 0 }}>
                    <span style={{ flex: "1 1 180px", minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{m.name || "Partner"}</span>
                      <span style={{ color: ROLE_TONE[m.role], fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", marginLeft: 6 }}>{m.role}</span>
                      <div className="crm-mute" style={{ fontSize: 11.5 }}>
                        {m.phone && <a href={whatsappUrl(m.phone, `Hi ${m.name?.split(" ")[0] || ""}, this is MovEazy.`)} target="_blank" rel="noreferrer" style={{ color: C.textMute }}>{phoneOf(m.phone)}</a>}
                        {[m.agency, `joined ${shortDate(m.joined_at)}`].filter(Boolean).map((x) => ` · ${x}`)}
                      </div>
                    </span>
                    {m.role !== "owner" && (
                      <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <Chip on={m.role === "admin"} disabled={!!busy}
                          onClick={() => act(m.user_id, () => crmUnionSetRole(union.id, m.user_id, m.role === "admin" ? "member" : "admin"),
                            m.role === "admin" ? `${m.name} is a member now` : `${m.name} is an admin`)}>Admin</Chip>
                        <Btn sm disabled={!!busy}
                          onClick={() => window.confirm(`Make ${m.name || "this partner"} the owner of ${union.name}? The current owner stays as an admin.`)
                            && act(m.user_id, () => crmUnionSetRole(union.id, m.user_id, "owner"), `${m.name} owns ${union.name} now`)}>Make owner</Btn>
                        <Btn sm disabled={!!busy}
                          onClick={() => window.confirm(`Remove ${m.name || "this partner"} from ${union.name}?`)
                            && act(m.user_id, () => crmUnionRemove(union.id, m.user_id), `${m.name} removed`)}>Remove</Btn>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div>
              <div style={label}>Invited ({pending.length}) — join when they sign up</div>
              <div className="crm-card" style={{ padding: 0 }}>
                {pending.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 12px", borderTop: i ? `1px solid ${C.line}` : 0 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <a href={whatsappUrl(p.phone, addedMessage({ groupName: union.name, groupId: union.id, fromName: "MovEazy", invited: true, phone: phoneOf(p.phone) }))}
                        target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: C.text }}>{phoneOf(p.phone)}</a>
                      <div className="crm-mute" style={{ fontSize: 11.5 }}>Added by {p.added_by_label || "a partner"} · {shortDate(p.created_at)} · until {shortDate(p.expires_at)}</div>
                    </span>
                    <Btn sm disabled={!!busy} onClick={() => window.confirm(`Cancel the invite for ${phoneOf(p.phone)}?`)
                      && act(p.id, () => cancelPendingMember(p.id), "Invite cancelled")}>Cancel</Btn>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
