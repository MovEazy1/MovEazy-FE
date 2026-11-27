/**
 * MovEazy Vendor — vendor.moveazy.co.in.
 *
 * The local agreement shop's app: a simple queue of paid requests routed to
 * them, each with the full details (including the tenant's Aadhaar, which only
 * the vendor and CRM super-admin ever see), one-tap sign links to share on
 * WhatsApp, and an upload for the stamped PDF — from a laptop or a phone.
 *
 * Access is allow-listed: a vendor is a row in rent_vendors with their Google
 * email (added in CRM → Rent agreements). Anyone else sees a holding screen.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { RentStyles, StatusBadge, Field } from "../../components/rent/rentUi";
import {
  fetchVendorMe, fetchVendorQueue, fetchVendorAgreement,
  uploadStampedPdf, vendorRecordUpload, vendorFlag, signedDocUrl,
  waShareSign, signUrl, fmtINR, fmtDate, ROLE_LABEL,
} from "../../lib/rentAgreements";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export default function VendorApp() {
  const { user, loading, loginWithGoogle } = useAuth();
  const [vendor, setVendor] = useState(undefined); // undefined=loading, null=not a vendor
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (user) fetchVendorMe().then(setVendor).catch(() => setVendor(null)); }, [user]);

  const load = useCallback(async () => {
    try { setItems(await fetchVendorQueue(tab)); } catch (e) { setErr(e.message); setItems([]); }
  }, [tab]);
  useEffect(() => { if (vendor) load(); }, [vendor, tab, load]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = items || [];
    return !s ? arr : arr.filter((a) =>
      JSON.stringify([a.details?.address, a.city, ...(a.parties || []).map((p) => p.name + p.mobile)]).toLowerCase().includes(s));
  }, [items, q]);

  if (loading) return <Shell><div className="ra-muted">Loading…</div></Shell>;
  if (!user) return (
    <Shell>
      <div className="ra-h">MovEazy Vendor</div>
      <div className="ra-sub">Sign in with your registered Google account.</div>
      <button className="ra-btn primary" onClick={() => loginWithGoogle()}>Sign in with Google</button>
    </Shell>
  );
  if (vendor === undefined) return <Shell><div className="ra-muted">Checking your access…</div></Shell>;
  if (!vendor) return (
    <Shell>
      <div className="ra-h">Not a registered vendor</div>
      <div className="ra-sub">This account ({user.email}) isn't set up as a MovEazy agreement vendor. Ask the MovEazy team to add you.</div>
    </Shell>
  );

  if (open) return <VendorDetail id={open} vendor={vendor} onBack={() => { setOpen(null); load(); }} />;

  return (
    <Shell wide>
      <div className="ra-row">
        <div>
          <div className="ra-h">{vendor.name}</div>
          <div className="ra-sub">{vendor.area ? `${vendor.area}, ` : ""}{vendor.city} · agreement vendor</div>
        </div>
      </div>
      {err && <div className="ra-err">{err}</div>}

      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 6, margin: "8px 0" }}>
        {TABS.map((t) => (
          <span key={t.key} className={`ra-chip ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>{t.label}</span>
        ))}
      </div>
      <input className="ra-input" placeholder="Search address, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />

      {items === null ? <div className="ra-muted">Loading…</div>
        : list.length === 0 ? <div className="ra-card ra-muted">Nothing here.</div>
        : list.map((a) => (
          <div className="ra-card" key={a.id} onClick={() => setOpen(a.id)} style={{ cursor: "pointer" }}>
            <div className="ra-row">
              <div style={{ fontWeight: 700 }}>{a.details?.flat_type ? `${a.details.flat_type} · ` : ""}{a.details?.address || a.city}</div>
              <StatusBadge status={a.status} />
            </div>
            <div className="ra-muted" style={{ marginTop: 4 }}>
              {fmtINR(a.rent)}/mo · {fmtDate(a.start_date)} start · {(a.parties || []).map((p) => `${ROLE_LABEL[p.role]} ${p.name}`).join(", ")}
            </div>
          </div>
        ))}
    </Shell>
  );
}

function VendorDetail({ id, onBack }) {
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [docUrl, setDocUrl] = useState("");

  const load = useCallback(async () => {
    try { const data = await fetchVendorAgreement(id); setA(data); if (data?.document_path) signedDocUrl(data.document_path).then(setDocUrl); }
    catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <Shell><button className="ra-btn ghost" onClick={onBack}>← Back</button><div className="ra-err">{err}</div></Shell>;
  if (!a) return <Shell><div className="ra-muted">Loading…</div></Shell>;

  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const { path, name } = await uploadStampedPdf(a.id, file);
      await vendorRecordUpload(a.id, path, name);
      await load();
    } catch (e) { setErr(e.message || "Upload failed."); }
    finally { setBusy(false); }
  };
  const flag = async (patch) => { try { await vendorFlag(a.id, patch.stamped, patch.registered); await load(); } catch (e) { setErr(e.message); } };

  const d = a.details || {};
  return (
    <Shell wide>
      <button className="ra-btn ghost" onClick={onBack} style={{ padding: "6px 10px" }}>← Back</button>
      <div className="ra-row" style={{ marginTop: 8 }}>
        <div className="ra-h">{d.flat_type ? `${d.flat_type} · ` : ""}{d.address || a.city}</div>
        <StatusBadge status={a.status} />
      </div>
      {err && <div className="ra-err">{err}</div>}

      <div className="ra-card">
        <Row k="City / area" v={`${a.city}${d.area ? " · " + d.area : ""}`} />
        <Row k="Rent / deposit" v={`${fmtINR(a.rent)} / ${fmtINR(a.deposit)}`} />
        <Row k="Term" v={`${fmtDate(a.start_date)} → ${fmtDate(a.renewal_date)} (${a.duration_months} mo)`} />
        <Row k="Maintenance" v={d.maintenance === "extra" ? `Extra ${fmtINR(d.maintenance_amount)}` : "Included"} />
        <Row k="Notice / lock-in" v={`${d.notice_months ?? "—"} / ${d.lock_in_months ?? "—"} mo`} />
        <Row k="Increment / due day" v={`${d.increment_pct ?? "—"}% / ${d.rent_due_day ?? "—"}`} />
        <Row k="Utilities (tenant)" v={(d.utilities || []).join(", ") || "—"} />
        <Row k="Parking / pets / repaint" v={`${d.parking || "—"} / ${d.pets ? "yes" : "no"} / ${d.repaint_months ?? "—"} mo`} />
      </div>

      <div className="ra-sec">Owner (lessor)</div>
      <PartyBlock p={(a.parties || []).find((x) => x.role === "owner")} extra={d.owner_address} a={a} />
      <div className="ra-sec">Tenant (lessee)</div>
      <PartyBlock p={(a.parties || []).find((x) => x.role === "tenant")} a={a}
        aadhaar={a.tenant_aadhaar} occupants={d.occupants} />

      <div className="ra-sec">Stamped agreement</div>
      {a.has_document
        ? <div className="ra-ok">Uploaded: {a.document_name}. {docUrl && <a href={docUrl} target="_blank" rel="noreferrer">View</a>} — you can replace it by uploading again.</div>
        : <div className="ra-muted" style={{ marginBottom: 8 }}>Upload the final stamped PDF. The owner and tenant can then e-sign.</div>}
      <label className="ra-btn primary" style={{ display: "inline-block" }}>
        {busy ? "Uploading…" : a.has_document ? "Replace PDF" : "Upload stamped PDF"}
        <input type="file" accept="application/pdf,image/*" hidden disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])} />
      </label>

      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 12 }}>
        <span className={`ra-chip ${a.stamped ? "on" : ""}`} onClick={() => flag({ stamped: !a.stamped })}>{a.stamped ? "✓ " : ""}Stamped</span>
        <span className={`ra-chip ${a.registered ? "on" : ""}`} onClick={() => flag({ registered: !a.registered })}>{a.registered ? "✓ " : ""}Registered</span>
      </div>
    </Shell>
  );
}

function PartyBlock({ p, extra, aadhaar, occupants, a }) {
  if (!p) return null;
  return (
    <div className="ra-card">
      <div style={{ fontWeight: 700 }}>{p.name || "—"} <span className="ra-muted">· {p.signed ? "✓ signed" : "not signed"}</span></div>
      <div className="ra-muted" style={{ marginTop: 4 }}>
        {p.mobile || "—"}{p.email ? ` · ${p.email}` : ""}{extra ? ` · ${extra}` : ""}
      </div>
      {aadhaar && <div className="ra-muted" style={{ marginTop: 4 }}>Aadhaar: <b>{aadhaar}</b></div>}
      {occupants?.length ? <div className="ra-muted" style={{ marginTop: 4 }}>Occupants: {occupants.map((o) => `${o.name}${o.relation ? ` (${o.relation}${o.age ? `, ${o.age}` : ""})` : ""}`).join("; ")}</div> : null}
      {p.sign_token && !p.signed && (
        <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <a className="ra-btn wa" href={waShareSign(p, a)} target="_blank" rel="noreferrer">Send sign link on WhatsApp</a>
          <button className="ra-btn ghost" onClick={() => { navigator.clipboard?.writeText(signUrl(p.sign_token)); }}>Copy link</button>
        </div>
      )}
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="ra-row" style={{ padding: "3px 0" }}><span className="ra-muted">{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div>
);

function Shell({ children, wide }) {
  return <div className="ra-wrap" style={{ maxWidth: wide ? 820 : 720, minHeight: "70vh" }}><RentStyles />{children}</div>;
}
