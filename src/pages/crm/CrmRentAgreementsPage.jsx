/**
 * CRM → Rent agreements. Requests (city-filtered, by status) with mark-paid,
 * vendor assignment and cancel; upcoming renewals; the local vendors; and the
 * per-city price. Super-admin-only actions are gated here and again in Postgres.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { isSuperAdminEmail } from "../../lib/adminAccess";
import { CITIES } from "../../lib/cities";
import CitySelect from "../../components/city/CitySelect";
import { useCityFilter } from "./crmCityFilter";
import { RentStyles, StatusBadge, Field } from "../../components/rent/rentUi";
import {
  crmRentList, crmRentDetail, crmRentMarkPaid, crmRentAssignVendor, crmRentCancel,
  crmRentVendors, crmRentVendorSave, crmRentPrices, crmRentSetPrice, crmRentRenewals,
  waShareSign, signUrl, fmtINR, fmtDate, ROLE_LABEL,
} from "../../lib/rentAgreements";

const TABS = ["Requests", "Renewals", "Vendors", "Pricing"];
const STATUSES = ["", "unpaid", "with_vendor", "ready_to_sign", "partially_signed", "completed", "cancelled"];

export default function CrmRentAgreementsPage() {
  const { user } = useAuth();
  const isSuper = isSuperAdminEmail(user?.email);
  const cf = useCityFilter();
  const city = cf.all ? null : cf.city;
  const [tab, setTab] = useState("Requests");

  return (
    <div className="ra-wrap" style={{ maxWidth: 900 }}>
      <RentStyles />
      <div className="ra-h">Rent agreements</div>
      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 6, margin: "8px 0 4px", flexWrap: "wrap" }}>
        {TABS.map((t) => <span key={t} className={`ra-chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</span>)}
      </div>
      {tab === "Requests" && <Requests city={city} isSuper={isSuper} />}
      {tab === "Renewals" && <Renewals city={city} />}
      {tab === "Vendors" && <Vendors isSuper={isSuper} />}
      {tab === "Pricing" && <Pricing isSuper={isSuper} />}
    </div>
  );
}

/* ── Requests ───────────────────────────────────────────────────────────────── */

function Requests({ city, isSuper }) {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try { setItems(await crmRentList(city, status || null)); } catch (e) { setErr(e.message); setItems([]); }
  }, [city, status]);
  useEffect(() => { load(); }, [load]);

  if (open) return <Detail id={open} isSuper={isSuper} onBack={() => { setOpen(null); load(); }} />;

  return (
    <div>
      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <select className="ra-select" style={{ maxWidth: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {err && <div className="ra-err">{err}</div>}
      {items === null ? <div className="ra-muted">Loading…</div>
        : items.length === 0 ? <div className="ra-card ra-muted">No requests.</div>
        : items.map((a) => (
          <div className="ra-card" key={a.id} onClick={() => setOpen(a.id)} style={{ cursor: "pointer" }}>
            <div className="ra-row">
              <div style={{ fontWeight: 700 }}>{a.details?.flat_type ? `${a.details.flat_type} · ` : ""}{a.details?.address || a.city}</div>
              <StatusBadge status={a.status} />
            </div>
            <div className="ra-muted" style={{ marginTop: 4 }}>
              {a.city} · {fmtINR(a.rent)}/mo · {(a.parties || []).map((p) => `${ROLE_LABEL[p.role]} ${p.name}`).join(", ")}
              {!a.paid && " · UNPAID"} {a.vendor ? ` · ${a.vendor.name}` : " · no vendor"}
            </div>
          </div>
        ))}
    </div>
  );
}

function Detail({ id, isSuper, onBack }) {
  const [a, setA] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setA(await crmRentDetail(id)); setVendors(await crmRentVendors()); } catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div><button className="ra-btn ghost" onClick={onBack}>← Back</button><div className="ra-err">{err}</div></div>;
  if (!a) return <div className="ra-muted">Loading…</div>;

  const act = async (fn) => { setBusy(true); setErr(""); try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const d = a.details || {};
  const cityVendors = vendors.filter((v) => v.city === a.city);

  return (
    <div>
      <button className="ra-btn ghost" onClick={onBack} style={{ padding: "6px 10px" }}>← Back</button>
      <div className="ra-row" style={{ marginTop: 8 }}>
        <div className="ra-h">{d.flat_type ? `${d.flat_type} · ` : ""}{d.address || a.city}</div>
        <StatusBadge status={a.status} />
      </div>
      {err && <div className="ra-err">{err}</div>}

      <div className="ra-card">
        <Row k="City / area" v={`${a.city}${d.area ? " · " + d.area : ""}`} />
        <Row k="Requested by" v={ROLE_LABEL[a.requester_role] || a.requester_role} />
        <Row k="Rent / deposit" v={`${fmtINR(a.rent)} / ${fmtINR(a.deposit)}`} />
        <Row k="Term" v={`${fmtDate(a.start_date)} → ${fmtDate(a.renewal_date)}`} />
        <Row k="Price / paid" v={`${fmtINR(a.price)} · ${a.paid ? "PAID " + fmtDate(a.paid_at) : "unpaid"}`} />
        <Row k="Aadhaar" v={a.tenant_aadhaar || "—"} />
      </div>

      {(a.parties || []).map((p) => (
        <div className="ra-card" key={p.role}>
          <div style={{ fontWeight: 700 }}>{ROLE_LABEL[p.role]}: {p.name} <span className="ra-muted">· {p.signed ? "✓ signed " + fmtDate(p.signed_at) : "awaiting"}</span></div>
          <div className="ra-muted">{p.mobile} {p.email ? `· ${p.email}` : ""}</div>
          {p.sign_token && !p.signed && (
            <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 6 }}>
              <a className="ra-btn wa" href={waShareSign(p, a)} target="_blank" rel="noreferrer">WhatsApp sign link</a>
              <button className="ra-btn ghost" onClick={() => navigator.clipboard?.writeText(signUrl(p.sign_token))}>Copy link</button>
            </div>
          )}
        </div>
      ))}

      <div className="ra-sec">Actions</div>
      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
        {isSuper && !a.paid && a.status !== "cancelled" &&
          <button className="ra-btn primary" disabled={busy} onClick={() => act(() => crmRentMarkPaid(a.id, "crm"))}>Mark paid → send to vendor</button>}
        {isSuper && a.status !== "cancelled" && a.status !== "completed" &&
          <button className="ra-btn ghost" disabled={busy} onClick={() => { if (confirm("Cancel this agreement?")) act(() => crmRentCancel(a.id)); }}>Cancel</button>}
      </div>
      <Field label="Assign / change vendor">
        <select className="ra-select" value={a.vendor?.id || ""} disabled={busy}
          onChange={(e) => act(() => crmRentAssignVendor(a.id, e.target.value || null))}>
          <option value="">— unassigned —</option>
          {cityVendors.map((v) => <option key={v.id} value={v.id}>{v.name} {v.area ? `(${v.area})` : ""}</option>)}
        </select>
      </Field>

      <div className="ra-sec">Activity</div>
      <div className="ra-card ra-muted" style={{ lineHeight: 1.9 }}>
        {(a.events || []).map((e, i) => <div key={i}>{fmtDate(e.at)} · {e.kind.replace(/_/g, " ")}{e.actor ? ` · ${e.actor}` : ""}</div>)}
      </div>
    </div>
  );
}

/* ── Renewals ───────────────────────────────────────────────────────────────── */

function Renewals({ city }) {
  const [items, setItems] = useState(null);
  useEffect(() => { crmRentRenewals(city).then(setItems).catch(() => setItems([])); }, [city]);
  if (items === null) return <div className="ra-muted">Loading…</div>;
  if (!items.length) return <div className="ra-card ra-muted">No renewals due in the next 45 days.</div>;
  return items.map((a) => {
    const owner = (a.parties || []).find((p) => p.role === "owner");
    const tenant = (a.parties || []).find((p) => p.role === "tenant");
    const overdue = new Date(a.renewal_date) < new Date();
    return (
      <div className="ra-card" key={a.id}>
        <div className="ra-row">
          <div style={{ fontWeight: 700 }}>{a.details?.address || a.city}</div>
          <span className="ra-badge" style={{ background: overdue ? "#fef2f2" : "#fffbeb", color: overdue ? "#991b1b" : "#92400e" }}>
            {overdue ? "Overdue " : "Renews "}{fmtDate(a.renewal_date)}
          </span>
        </div>
        <div className="ra-muted" style={{ marginTop: 4 }}>{a.city} · {fmtINR(a.rent)}/mo</div>
        <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 8 }}>
          {owner?.mobile && <a className="ra-btn wa" target="_blank" rel="noreferrer"
            href={`https://wa.me/91${owner.mobile}?text=${encodeURIComponent(`Hi ${owner.name}, your MovEazy rent agreement is due for renewal on ${fmtDate(a.renewal_date)}. Reply to renew it.`)}`}>WhatsApp owner</a>}
          {tenant?.mobile && <a className="ra-btn ghost" target="_blank" rel="noreferrer"
            href={`https://wa.me/91${tenant.mobile}?text=${encodeURIComponent(`Hi ${tenant.name}, your MovEazy rent agreement is due for renewal on ${fmtDate(a.renewal_date)}.`)}`}>WhatsApp tenant</a>}
        </div>
      </div>
    );
  });
}

/* ── Vendors ────────────────────────────────────────────────────────────────── */

function Vendors({ isSuper }) {
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setItems(await crmRentVendors()); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (v) => { setErr(""); try { await crmRentVendorSave(v); setEdit(null); await load(); } catch (e) { setErr(e.message); } };

  return (
    <div>
      {err && <div className="ra-err">{err}</div>}
      {isSuper && !edit && <button className="ra-btn primary" onClick={() => setEdit({ active: true, city: "Bengaluru" })}>+ Add vendor</button>}
      {edit && <VendorForm v={edit} onSave={save} onCancel={() => setEdit(null)} />}
      {items === null ? <div className="ra-muted">Loading…</div>
        : items.map((v) => (
          <div className="ra-card" key={v.id}>
            <div className="ra-row">
              <div style={{ fontWeight: 700 }}>{v.name} {!v.active && <span className="ra-muted">(inactive)</span>}</div>
              {isSuper && <button className="ra-btn ghost" style={{ padding: "4px 10px" }} onClick={() => setEdit(v)}>Edit</button>}
            </div>
            <div className="ra-muted" style={{ marginTop: 4 }}>{v.area ? `${v.area}, ` : ""}{v.city} · {v.email} · {v.phone || "—"}{v.lat ? ` · 📍${v.lat.toFixed?.(3)},${v.lng?.toFixed?.(3)}` : " · no location"}</div>
          </div>
        ))}
    </div>
  );
}

function VendorForm({ v, onSave, onCancel }) {
  const [f, setF] = useState({ lat: "", lng: "", phone: "", area: "", ...v });
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const I = (val, on, props = {}) => <input className="ra-input" value={val ?? ""} onChange={(e) => on(e.target.value)} {...props} />;
  return (
    <div className="ra-card">
      <div className="ra-grid2">
        <Field label="Shop / vendor name">{I(f.name, (x) => set({ name: x }))}</Field>
        <Field label="Google email (sign-in)">{I(f.email, (x) => set({ email: x }), { type: "email" })}</Field>
      </div>
      <div className="ra-grid2">
        <Field label="City"><CitySelect className="ra-select" value={f.city} onChange={(c) => set({ city: c })} /></Field>
        <Field label="Area / sub-locality">{I(f.area, (x) => set({ area: x }), { placeholder: "HSR Layout" })}</Field>
      </div>
      <div className="ra-grid3">
        <Field label="Phone">{I(f.phone, (x) => set({ phone: x }), { inputMode: "tel" })}</Field>
        <Field label="Latitude">{I(f.lat, (x) => set({ lat: x }), { inputMode: "decimal", placeholder: "12.91" })}</Field>
        <Field label="Longitude">{I(f.lng, (x) => set({ lng: x }), { inputMode: "decimal", placeholder: "77.64" })}</Field>
      </div>
      <label className="ra-chip" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={!!f.active} onChange={(e) => set({ active: e.target.checked })} /> Active
      </label>
      <div className="ra-muted" style={{ margin: "6px 0" }}>Set the shop's latitude/longitude so requests route to the nearest vendor. (From Google Maps: right-click the shop → copy the two numbers.)</div>
      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <button className="ra-btn primary" onClick={() => onSave(f)}>Save</button>
        <button className="ra-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────────────── */

function Pricing({ isSuper }) {
  const [prices, setPrices] = useState(null);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState({});
  const load = useCallback(async () => { try { setPrices(await crmRentPrices()); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (city) => {
    setErr("");
    try { await crmRentSetPrice(city, draft[city]); await load(); setDraft((d) => ({ ...d, [city]: undefined })); }
    catch (e) { setErr(e.message); }
  };

  if (prices === null) return <div className="ra-muted">Loading…</div>;
  return (
    <div>
      <div className="ra-muted" style={{ marginBottom: 8 }}>The price a requester pays, per city. 0 means requests in that city stay unpaid until you set one.</div>
      {err && <div className="ra-err">{err}</div>}
      {CITIES.map((c) => (
        <div className="ra-card ra-row" key={c.name}>
          <div style={{ fontWeight: 700 }}>{c.label}</div>
          <div className="ra-row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <input className="ra-input" style={{ width: 110 }} inputMode="numeric" disabled={!isSuper}
              value={draft[c.name] ?? (prices[c.name] ?? 0)} onChange={(e) => setDraft((d) => ({ ...d, [c.name]: e.target.value }))} />
            {isSuper && draft[c.name] !== undefined && <button className="ra-btn primary" style={{ padding: "6px 12px" }} onClick={() => save(c.name)}>Save</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="ra-row" style={{ padding: "3px 0" }}><span className="ra-muted">{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div>
);
