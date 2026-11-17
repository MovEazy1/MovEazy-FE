/**
 * A society partner's numbers at a society — the manager, the guards, the
 * brokers — and asking them for flats ("Ask for inventory").
 *
 *   ContactSections  three sections, one under the other: saved numbers
 *                    (Call · WhatsApp · Edit · Remove), then a Name + Phone
 *                    row that saves itself once both are in (or on Save),
 *                    and "Add another" at the bottom.
 *   AdviceNudge      fewer than the advised numbers (1 manager, 2 guards,
 *                    4 brokers): which to add, and why.
 *   SocietyEnquiries tenants who asked for a flat in this society.
 *
 * A removed number is kept for the MovEazy team (society_contacts_v2.sql) but
 * is gone from here. One number of any kind is enough to submit a society.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import { pp } from "../../lib/partners";
import { fetchSocietyLeads, removeSocietyContact, saveSocietyContact, stageLabel } from "../../lib/societyPartners";

const errText = (e) => e?.message || "Something went wrong.";
const digits = (p) => String(p || "").replace(/\D/g, "").slice(-10);

/** What we advise per kind, and how each section reads. */
export const KINDS = [
  { id: "manager", advised: 1, one: "manager", many: "managers", title: "Add Society Manager Details", nameLabel: "Manager name" },
  {
    id: "guard", advised: 2, one: "security guard", many: "security guards", title: "Add Security Guard Details", nameLabel: "Guard name",
    advice: "Add at least 2–3 security guards to ensure a regular supply of inventory.",
  },
  {
    id: "broker", advised: 4, one: "broker", many: "brokers", title: "Add Broker Details", nameLabel: "Broker name",
    advice: "Add at least 4–5 society brokers to ensure you have a regular supply of inventory.",
  },
];

/** The kinds below what we advise: [{ kind, need }]. */
export function shortfall(counts) {
  if (!counts) return [];
  return KINDS.map((k) => ({ kind: k, need: Math.max(0, k.advised - Number(counts[k.id] || 0)) })).filter((x) => x.need > 0);
}

/** "1 more manager, 1 more security guard and 3 more brokers". */
export function shortfallText(list) {
  const parts = list.map(({ kind, need }) => `${need} more ${need === 1 ? kind.one : kind.many}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "";
}

/** The nudge to add more numbers, after a society is submitted with fewer than advised. */
export function AdviceNudge({ counts, compact = false, style }) {
  const list = shortfall(counts);
  if (!list.length) return null;
  return (
    <div style={{ background: "#FFF4E5", color: "#7A4A0B", borderRadius: 10, padding: compact ? "6px 9px" : 10, fontSize: compact ? 12 : 13, lineHeight: 1.45, ...style }}>
      <b>Add {shortfallText(list)}.</b>
      {!compact && " Only you will have access to these numbers — they help make sure no tenant interested in this society gets skipped because you couldn't get a flat on time."}
    </div>
  );
}

/** WhatsApp to a contact, asking for flats to let. */
export function askInventoryUrl(contact, societyName, partnerName) {
  const first = String(contact?.name || "").trim().split(/\s+/)[0];
  const text = `Hi${first ? ` ${first}` : ""}, this is ${partnerName || "your MovEazy partner"} from MovEazy. `
    + `Are any flats available for rent in ${societyName || "your society"}? I have tenants looking right now.`;
  return `https://wa.me/91${digits(contact.phone)}?text=${encodeURIComponent(text)}`;
}

const valid = (kind, f) => digits(f.phone).length === 10 && (kind !== "broker" || f.name.trim().length >= 2);

/** One saved number: Call, WhatsApp, Edit, Remove. */
function SavedRow({ c, kind, society, partnerName, onSaved }) {
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { onSaved(await saveSocietyContact({ id: c.id, society_id: society.id, kind: kind.id, name: edit.name, phone: edit.phone })); setEdit(null); toast("Saved"); }
    catch (e) { toast(errText(e), "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${c.name || formatPhone(c.phone)}?`)) return;
    setBusy(true);
    try { onSaved(await removeSocietyContact(c.id)); toast("Contact removed"); } catch (e) { toast(errText(e), "error"); setBusy(false); }
  };
  if (edit) {
    return (
      <div style={{ display: "grid", gap: 6, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
        <input className="pz-input" value={edit.name} maxLength={80} placeholder={kind.nameLabel} aria-label={kind.nameLabel} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        <input className="pz-input" value={edit.phone} maxLength={14} inputMode="tel" placeholder="Phone no" aria-label="Phone no" onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" disabled={busy || !valid(kind.id, edit)} onClick={save}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="pz-btn pz-btn--sm" onClick={() => setEdit(null)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)", minWidth: 0 }}>
      <span style={{ width: 30, height: 30, borderRadius: 99, background: "#E8F5EC", color: "var(--g)", display: "grid", placeItems: "center", flex: "none" }}><Check size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || kind.one[0].toUpperCase() + kind.one.slice(1)}</b>
        <span className="pz-meta">{formatPhone(c.phone)}</span>
      </span>
      <a className="pz-iconbtn" href={`tel:+91${digits(c.phone)}`} aria-label={`Call ${c.name || "them"}`}><Phone size={17} /></a>
      <a className="pz-iconbtn" href={askInventoryUrl(c, society.name, partnerName)} target="_blank" rel="noreferrer" aria-label="Ask for flats on WhatsApp" style={{ color: "#16A34A" }}><WhatsAppIcon size={18} /></a>
      <button type="button" className="pz-iconbtn" aria-label="Edit" disabled={busy} onClick={() => setEdit({ name: c.name || "", phone: c.phone || "" })}><Pencil size={16} /></button>
      <button type="button" className="pz-iconbtn" aria-label="Remove" disabled={busy} onClick={remove}><Trash2 size={16} /></button>
    </div>
  );
}

/** The Name + Phone row: saves itself a moment after both are in, or now on Save. */
function DraftRow({ kind, society, onSaved, onDone }) {
  const [f, setF] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const sent = useRef("");
  const save = async (auto = false) => {
    const key = `${f.name.trim()}|${digits(f.phone)}`;
    if (busy || sent.current === key || !valid(kind.id, f)) return;
    sent.current = key;
    setBusy(true);
    try {
      onSaved(await saveSocietyContact({ society_id: society.id, kind: kind.id, name: f.name, phone: f.phone }));
      setF({ name: "", phone: "" });
      sent.current = "";
      toast(auto ? `${kind.one[0].toUpperCase() + kind.one.slice(1)} saved` : "Saved");
      onDone?.();
    } catch (e) { sent.current = ""; toast(errText(e), "error"); } finally { setBusy(false); }
  };
  // Auto-save once a name and a 10-digit number are in, after typing stops.
  useEffect(() => {
    if (f.name.trim().length < 2 || digits(f.phone).length !== 10) return undefined;
    const t = setTimeout(() => save(true), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.name, f.phone]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "8px 0", borderTop: "1px solid var(--line)", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
        <input className="pz-input" value={f.name} maxLength={80} placeholder={kind.nameLabel} aria-label={kind.nameLabel} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="pz-input" value={f.phone} maxLength={14} inputMode="tel" placeholder="Phone no" aria-label="Phone no" onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" style={{ flex: "none" }} disabled={busy || !valid(kind.id, f)} onClick={() => save(false)}>
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}

/** One section: its numbers, a row to add one, "Add another". */
function KindSection({ n, kind, society, partnerName, onSaved }) {
  const saved = (society.contacts ?? []).filter((c) => c.kind === kind.id);
  const [adding, setAdding] = useState(false);
  const showDraft = adding || saved.length === 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <b style={{ display: "block", fontSize: 14.5 }}>{n}. {kind.title}</b>
      {kind.advice && <p className="pz-hint" style={{ margin: "2px 0 4px" }}>{kind.advice}</p>}
      {saved.map((c) => <SavedRow key={c.id} c={c} kind={kind} society={society} partnerName={partnerName} onSaved={onSaved} />)}
      {showDraft && <DraftRow kind={kind} society={society} onSaved={onSaved} onDone={() => setAdding(false)} />}
      {saved.length > 0 && !adding && (
        <button type="button" className="pz-btn pz-btn--block" style={{ minHeight: 40, fontSize: 14, marginTop: 6 }} onClick={() => setAdding(true)}>
          <Plus size={15} /> Add another {kind.one}
        </button>
      )}
    </div>
  );
}

export function ContactSections({ society, partnerName, onSaved }) {
  return (
    <>
      {KINDS.map((k, i) => <KindSection key={k.id} n={i + 1} kind={k} society={society} partnerName={partnerName} onSaved={onSaved} />)}
      <p className="pz-hint" style={{ margin: 0 }}>Only you and MovEazy see these numbers. Each one saves itself once a name and number are in.</p>
    </>
  );
}

/** Tenants who asked for a flat in this society, newest first. */
export function SocietyEnquiries({ societyId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchSocietyLeads().then((r) => alive && setRows(r.filter((l) => l.society_id === societyId)), () => alive && setRows([]));
    return () => { alive = false; };
  }, [societyId]);
  if (rows === null) return null;
  return (
    <div className="pz-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 15 }}>Tenant enquiries · {rows.length}</b>
        {rows.length > 0 && <Link to={pp("/societies?tab=leads")} className="pz-btn pz-btn--sm">All leads</Link>}
      </div>
      {rows.length === 0 ? (
        <p className="pz-hint" style={{ margin: "6px 0 0" }}>No tenant has asked yet. When one does, they show here first — ask your numbers below for a flat.</p>
      ) : rows.slice(0, 6).map((l) => (
        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)", minWidth: 0 }}>
          <UserRound size={18} color="var(--dim)" style={{ flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name || "A tenant"}</b>
            <span className="pz-meta">{stageLabel(l.stage)} · {new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </span>
          {l.phone && <a className="pz-iconbtn" href={`tel:+91${digits(l.phone)}`} aria-label={`Call ${l.name || "the tenant"}`}><Phone size={17} /></a>}
          {l.phone && <a className="pz-iconbtn" href={`https://wa.me/91${digits(l.phone)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp the tenant" style={{ color: "#16A34A" }}><WhatsAppIcon size={18} /></a>}
        </div>
      ))}
    </div>
  );
}
