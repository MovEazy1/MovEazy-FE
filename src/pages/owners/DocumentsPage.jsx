/**
 * Documents: rental agreements, police verification, move-in photos. Files
 * live in the private owner-docs bucket under the owner's own folder and open
 * through a short-lived signed link; the rows are readable by the owner (and
 * the super admin) only. Receipts and statements are out of V1 with the rest
 * of rent tracking.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOwner } from "./OwnerApp";
import { Chip, Confirm, Empty, Loading, Sheet, TopBar, toast } from "./ownerUi";
import {
  DOC_KINDS, deleteDocument, fetchDocuments, fmtDate, friendlyError, propertyName, signedUrl, uploadDocument,
} from "../../lib/owners";

const kindLabel = Object.fromEntries(DOC_KINDS);
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function UploadSheet({ onClose, onUploaded, propertyId, tenantId, defaultKind = "agreement" }) {
  const { user } = useAuth();
  const { properties, tenants } = useOwner();
  const [f, setF] = useState({ kind: defaultKind, title: "", property_id: propertyId || "", tenant_id: tenantId || "", file: null });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.file) return toast("Choose a file", "error");
    if (f.file.size > 15 * 1048576) return toast("That file is over 15 MB", "error");
    setBusy(true);
    try {
      const row = await uploadDocument(user.uid, { ...f, title: f.title || f.file.name });
      onUploaded(row);
      toast("Document saved");
      onClose();
    } catch (err) {
      toast(friendlyError(err, "Could not upload that file."), "error");
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add document" onClose={onClose}>
      <form className="oz-pad" onSubmit={submit}>
        <div className="oz-field">
          <span className="oz-label">Type</span>
          <div className="oz-chips">{DOC_KINDS.map(([k, label]) => <Chip key={k} on={f.kind === k} onClick={() => set({ kind: k })}>{label}</Chip>)}</div>
        </div>
        <div className="oz-field">
          <label className="oz-label" htmlFor="ud-file">File</label>
          <input id="ud-file" className="oz-input" type="file" accept="application/pdf,image/*" onChange={(e) => set({ file: e.target.files?.[0] || null })} />
        </div>
        <div className="oz-field">
          <label className="oz-label" htmlFor="ud-title">Name</label>
          <input id="ud-title" className="oz-input" value={f.title} placeholder={f.file?.name || "Lease agreement 2025"} onChange={(e) => set({ title: e.target.value })} />
        </div>
        {!propertyId && (
          <div className="oz-field">
            <label className="oz-label" htmlFor="ud-prop">Property</label>
            <select id="ud-prop" className="oz-select" value={f.property_id} onChange={(e) => set({ property_id: e.target.value, tenant_id: "" })}>
              <option value="">Not for a specific property</option>
              {(properties ?? []).map((p) => <option key={p.property_id} value={p.property_id}>{propertyName(p)}</option>)}
            </select>
          </div>
        )}
        {!tenantId && f.property_id && (
          <div className="oz-field">
            <label className="oz-label" htmlFor="ud-tenant">Tenant</label>
            <select id="ud-tenant" className="oz-select" value={f.tenant_id} onChange={(e) => set({ tenant_id: e.target.value })}>
              <option value="">Not for a specific tenant</option>
              {tenants.filter((t) => t.property_id === f.property_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <p className="oz-hint oz-row" style={{ gap: 6, alignItems: "flex-start" }}>
          <ShieldAlert size={14} style={{ flex: "none", marginTop: 2 }} /> Private to you. Please don't upload Aadhaar or PAN copies.
        </p>
        <button type="submit" className="oz-btn oz-btn--primary oz-btn--block" disabled={busy}>{busy ? "Uploading…" : "Save document"}</button>
      </form>
    </Sheet>
  );
}

/** The list, optionally scoped to one tenant or property, with its own Add button. */
export function DocumentList({ tenantId = null, propertyId = null, defaultKind, kind = "" }) {
  const { byId, tenants } = useOwner();
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetchDocuments().then((d) => { setDocs(d); setError(""); },
    (e) => { setDocs([]); setError(friendlyError(e, "Could not load documents.")); }), []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (docs ?? []).filter((d) =>
    (!tenantId || d.tenant_id === tenantId) && (!propertyId || tenantId || d.property_id === propertyId) && (!kind || d.kind === kind)),
  [docs, tenantId, propertyId, kind]);

  const open = async (d) => {
    const w = window.open("", "_blank");
    const url = await signedUrl(d.storage_path);
    if (!url) { w?.close(); toast("Could not open that file", "error"); return; }
    if (w) w.location.href = url; else window.location.href = url;
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteDocument(del);
      setDocs((ds) => ds.filter((x) => x.id !== del.id));
      setDel(null);
      toast("Document deleted");
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="oz-btn oz-btn--soft" style={{ width: "100%", marginBottom: 12 }} onClick={() => setAdding(true)}>
        <Plus size={16} /> Add document
      </button>
      {docs === null ? <Loading /> : error ? <Empty>{error}</Empty> : rows.length === 0 ? (
        <Empty icon={<FileText size={22} />}>No documents yet. Keep the signed agreement here so it's never lost in a chat.</Empty>
      ) : (
        <div className="oz-card">
          {rows.map((d) => {
            const p = d.property_id ? byId.get(d.property_id) : null;
            const t = d.tenant_id ? tenants.find((x) => x.id === d.tenant_id) : null;
            return (
              <div key={d.id} className="oz-menurow" style={{ cursor: "default" }}>
                <span className="oz-avatar" style={{ background: "var(--champ2)" }}><FileText size={17} /></span>
                <button type="button" onClick={() => open(d)} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", textAlign: "left", font: "inherit", cursor: "pointer", padding: 0, color: "inherit" }}>
                  <strong style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</strong>
                  <span className="oz-sub">{[kindLabel[d.kind], t?.name, !tenantId && p ? propertyName(p) : "", fmtDate(d.created_at, { day: "numeric", month: "short", year: "numeric" }), size(d.size_bytes)].filter(Boolean).join(" · ")}</span>
                </button>
                <button type="button" className="oz-iconbtn" aria-label={`Delete ${d.title}`} onClick={() => setDel(d)}><Trash2 size={17} color="var(--red)" /></button>
              </div>
            );
          })}
        </div>
      )}
      {adding && (
        <UploadSheet propertyId={propertyId} tenantId={tenantId} defaultKind={defaultKind || kind || "agreement"}
          onClose={() => setAdding(false)} onUploaded={(row) => setDocs((ds) => [row, ...(ds ?? [])])} />
      )}
      {del && (
        <Confirm title="Delete this document?" danger busy={busy} confirmLabel="Delete" body={`${del.title} will be permanently removed.`}
          onClose={() => setDel(null)} onConfirm={remove} />
      )}
    </>
  );
}

export default function DocumentsPage() {
  const [params] = useSearchParams();
  const propertyId = params.get("property") || null;
  const { byId } = useOwner();
  const [kind, setKind] = useState("");
  const scoped = propertyId ? byId.get(propertyId) : null;
  return (
    <>
      <TopBar title={scoped ? `Documents · ${scoped.flat_type || "Flat"}` : "Documents"} back />
      <div className="oz-pad" style={{ paddingBottom: 0 }}>
        <div className="oz-chips oz-chips--scroll">
          <Chip on={!kind} onClick={() => setKind("")}>All</Chip>
          {DOC_KINDS.map(([k, label]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
        </div>
      </div>
      <div className="oz-pad"><DocumentList propertyId={propertyId} kind={kind} /></div>
    </>
  );
}
