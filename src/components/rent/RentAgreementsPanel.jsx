/**
 * The in-app rent-agreement surface, shared by the owner, broker and tenant
 * apps and the main site: a list of the person's agreements and a "Request a
 * rent agreement" form. The requester's role comes from the app it is mounted
 * in. Parties sign through the link at /rent/sign/:token (siteOrigin()).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { siteCity } from "../../lib/cities";
import CitySelect from "../city/CitySelect";
import { RentStyles, StatusBadge, Steps, Field } from "./rentUi";
import {
  FURNISHING, PARKING, UTILITIES, ROLE_LABEL, emptyRequest, toRequestPayload, validateRequest,
  requestRentAgreement, fetchMyAgreements, renewAgreement, getCurrentLatLng,
  signedDocUrl, signUrl, fmtINR, fmtDate,
} from "../../lib/rentAgreements";

export default function RentAgreementsPanel({ role = "tenant", title = "Rent agreements", city }) {
  const { user, loginWithGoogle } = useAuth();
  const [items, setItems] = useState(null);
  const [mode, setMode] = useState("list"); // list | new
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await fetchMyAgreements()); } catch (e) { setErr(e.message || "Could not load."); setItems([]); }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) {
    return (
      <div className="ra-wrap"><RentStyles />
        <div className="ra-h">{title}</div>
        <div className="ra-sub">Sign in to request a rent agreement and see your agreements.</div>
        <button className="ra-btn primary" onClick={loginWithGoogle}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div className="ra-wrap"><RentStyles />
      <div className="ra-row">
        <div>
          <div className="ra-h">{title}</div>
          <div className="ra-sub">Prepared by a MovEazy-verified vendor, stamped and e-signed.</div>
        </div>
        {mode === "list" && <button className="ra-btn primary" onClick={() => setMode("new")}>Request</button>}
      </div>
      {err && <div className="ra-err">{err}</div>}

      {mode === "new" ? (
        <RequestForm role={role} city={city || siteCity()} busy={busy} setBusy={setBusy}
          onCancel={() => setMode("list")}
          onDone={async () => { setMode("list"); await load(); }} />
      ) : items === null ? (
        <div className="ra-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="ra-card ra-muted">No agreements yet. Tap <b>Request</b> to start one.</div>
      ) : (
        items.map((a) => <AgreementCard key={a.id} a={a} onChanged={load} />)
      )}
    </div>
  );
}

function AgreementCard({ a, onChanged }) {
  const [url, setUrl] = useState("");
  const mine = a.my_party;
  const canSign = mine && !mine.signed && (a.status === "ready_to_sign" || a.status === "partially_signed");

  useEffect(() => {
    let live = true;
    if (a.has_document && a.document_path) signedDocUrl(a.document_path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [a.has_document, a.document_path]);

  const renew = async () => { try { await renewAgreement(a.id); await onChanged(); } catch (e) { alert(e.message); } };

  return (
    <div className="ra-card">
      <div className="ra-row">
        <div style={{ fontWeight: 700 }}>
          {a.details?.flat_type ? `${a.details.flat_type} · ` : ""}{a.details?.address || a.city}
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="ra-muted" style={{ marginTop: 4 }}>
        {fmtINR(a.rent)}/mo · deposit {fmtINR(a.deposit)} · {fmtDate(a.start_date)} → {fmtDate(a.renewal_date)}
      </div>
      <Steps status={a.status} />

      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {a.status === "unpaid" && <span className="ra-muted">Our team will contact you to collect {fmtINR(a.price)}, then send it to the vendor to prepare.</span>}
        {canSign && <a className="ra-btn primary" href={signUrl(mine.sign_token)}>Review & e-sign</a>}
        {a.has_document && url && <a className="ra-btn ghost" href={url} target="_blank" rel="noreferrer">Download PDF</a>}
        {a.renew_due && <button className="ra-btn primary" onClick={renew}>Renew</button>}
      </div>

      <div className="ra-muted" style={{ marginTop: 8 }}>
        {(a.parties || []).map((p) => `${ROLE_LABEL[p.role]}: ${p.signed ? "✓ signed" : "awaiting"}`).join("  ·  ")}
      </div>
    </div>
  );
}

/* ── The request form ───────────────────────────────────────────────────────── */

function RequestForm({ role, city, onCancel, onDone, busy, setBusy }) {
  const [f, setF] = useState(() => emptyRequest(role, city));
  const [errs, setErrs] = useState([]);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const setIn = (key, patch) => setF((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  const toggleUtil = (u) => set({ utilities: f.utilities.includes(u) ? f.utilities.filter((x) => x !== u) : [...f.utilities, u] });
  const setOcc = (i, patch) => set({ occupants: f.occupants.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const addOcc = () => set({ occupants: [...f.occupants, { name: "", relation: "", age: "" }] });

  const submit = async () => {
    const v = validateRequest(f);
    setErrs(v);
    if (v.length) return;
    setBusy(true);
    try {
      const latlng = await getCurrentLatLng();      // nearest-vendor routing
      await requestRentAgreement(toRequestPayload(f, latlng));
      await onDone();
    } catch (e) { setErrs([e.message || "Could not submit."]); }
    finally { setBusy(false); }
  };

  const I = (val, on, props = {}) => <input className="ra-input" value={val} onChange={(e) => on(e.target.value)} {...props} />;

  return (
    <div>
      {errs.length > 0 && (
        <div className="ra-err">{errs.map((m, i) => <div key={i}>{m}</div>)}</div>
      )}

      <div className="ra-sec">Property</div>
      <div className="ra-grid2">
        <Field label="City"><CitySelect className="ra-select" value={f.city} onChange={(c) => set({ city: c })} /></Field>
        <Field label="Area / locality">{I(f.area, (v) => set({ area: v }), { placeholder: "e.g. HSR Layout" })}</Field>
      </div>
      <div className="ra-grid3">
        <Field label="Building / society">{I(f.address.building, (v) => setIn("address", { building: v }))}</Field>
        <Field label="Flat no.">{I(f.address.flat_no, (v) => setIn("address", { flat_no: v }))}</Field>
        <Field label="Floor">{I(f.address.floor, (v) => setIn("address", { floor: v }))}</Field>
      </div>
      <div className="ra-grid3">
        <Field label="Street">{I(f.address.street, (v) => setIn("address", { street: v }))}</Field>
        <Field label="Locality">{I(f.address.locality, (v) => setIn("address", { locality: v }))}</Field>
        <Field label="Pincode">{I(f.address.pincode, (v) => setIn("address", { pincode: v }), { inputMode: "numeric" })}</Field>
      </div>
      <div className="ra-grid2">
        <Field label="Flat type">{I(f.flat_type, (v) => set({ flat_type: v }), { placeholder: "2 BHK" })}</Field>
        <Field label="Furnishing">
          <select className="ra-select" value={f.furnishing} onChange={(e) => set({ furnishing: e.target.value })}>
            {FURNISHING.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      </div>

      <div className="ra-sec">Owner (lessor)</div>
      <div className="ra-grid3">
        <Field label="Full name">{I(f.owner.name, (v) => setIn("owner", { name: v }))}</Field>
        <Field label="Mobile">{I(f.owner.mobile, (v) => setIn("owner", { mobile: v }), { inputMode: "tel" })}</Field>
        <Field label="Email (to sign)">{I(f.owner.email, (v) => setIn("owner", { email: v }), { type: "email" })}</Field>
      </div>
      <Field label="Owner's permanent address">{I(f.owner.address || "", (v) => setIn("owner", { address: v }))}</Field>

      <div className="ra-sec">Tenant (lessee)</div>
      <div className="ra-grid3">
        <Field label="Full name">{I(f.tenant.name, (v) => setIn("tenant", { name: v }))}</Field>
        <Field label="Mobile">{I(f.tenant.mobile, (v) => setIn("tenant", { mobile: v }), { inputMode: "tel" })}</Field>
        <Field label="Email (to sign)">{I(f.tenant.email, (v) => setIn("tenant", { email: v }), { type: "email" })}</Field>
      </div>
      <Field label="Aadhaar number (kept private — only the vendor sees it)">
        {I(f.tenant.aadhaar, (v) => setIn("tenant", { aadhaar: v }), { inputMode: "numeric", placeholder: "XXXX XXXX XXXX" })}
      </Field>
      <div className="ra-sec" style={{ fontSize: 12 }}>Occupants</div>
      {f.occupants.map((o, i) => (
        <div className="ra-grid3" key={i}>
          <Field label={i === 0 ? "Name" : ""}>{I(o.name, (v) => setOcc(i, { name: v }))}</Field>
          <Field label={i === 0 ? "Relation" : ""}>{I(o.relation, (v) => setOcc(i, { relation: v }), { placeholder: "self / spouse…" })}</Field>
          <Field label={i === 0 ? "Age" : ""}>{I(o.age, (v) => setOcc(i, { age: v }), { inputMode: "numeric" })}</Field>
        </div>
      ))}
      <button type="button" className="ra-btn ghost" style={{ padding: "6px 10px" }} onClick={addOcc}>+ Add occupant</button>

      <div className="ra-sec">Terms</div>
      <div className="ra-grid2">
        <Field label="Monthly rent (₹)">{I(f.rent, (v) => set({ rent: v }), { inputMode: "numeric" })}</Field>
        <Field label="Security deposit (₹)">{I(f.deposit, (v) => set({ deposit: v }), { inputMode: "numeric" })}</Field>
      </div>
      <div className="ra-grid2">
        <Field label="Maintenance">
          <select className="ra-select" value={f.maintenance} onChange={(e) => set({ maintenance: e.target.value })}>
            <option value="included">Included in rent</option>
            <option value="extra">Extra</option>
          </select>
        </Field>
        <Field label="Maintenance amount (₹)">{I(f.maintenance_amount, (v) => set({ maintenance_amount: v }), { inputMode: "numeric", disabled: f.maintenance !== "extra" })}</Field>
      </div>
      <div className="ra-grid2">
        <Field label="Start date">{I(f.start_date, (v) => set({ start_date: v }), { type: "date" })}</Field>
        <Field label="Duration (months)">{I(f.duration_months, (v) => set({ duration_months: v }), { inputMode: "numeric" })}</Field>
      </div>
      <div className="ra-grid3">
        <Field label="Lock-in (months)">{I(f.lock_in_months, (v) => set({ lock_in_months: v }), { inputMode: "numeric" })}</Field>
        <Field label="Notice (months)">{I(f.notice_months, (v) => set({ notice_months: v }), { inputMode: "numeric" })}</Field>
        <Field label="Annual increment (%)">{I(f.increment_pct, (v) => set({ increment_pct: v }), { inputMode: "numeric" })}</Field>
      </div>
      <div className="ra-grid3">
        <Field label="Rent due day">{I(f.rent_due_day, (v) => set({ rent_due_day: v }), { inputMode: "numeric" })}</Field>
        <Field label="Parking">
          <select className="ra-select" value={f.parking} onChange={(e) => set({ parking: e.target.value })}>
            {PARKING.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Repaint at exit (months)">{I(f.repaint_months, (v) => set({ repaint_months: v }), { inputMode: "numeric" })}</Field>
      </div>
      <Field label="Utilities paid by tenant">
        <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
          {UTILITIES.map((u) => <span key={u} className={`ra-chip ${f.utilities.includes(u) ? "on" : ""}`} onClick={() => toggleUtil(u)}>{u}</span>)}
          <span className={`ra-chip ${f.pets ? "on" : ""}`} onClick={() => set({ pets: !f.pets })}>Pets allowed</span>
        </div>
      </Field>

      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginTop: 16 }}>
        <button className="ra-btn primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit request"}</button>
        <button className="ra-btn ghost" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      <div className="ra-muted" style={{ marginTop: 8 }}>
        We'll ask your location to pick the nearest vendor. Our team will contact you to collect the fee; then the vendor prepares and stamps your agreement.
      </div>
    </div>
  );
}
