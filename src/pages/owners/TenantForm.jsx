/**
 * Add or edit a tenant. Only what an owner needs to keep: who they are, how to
 * reach them, and the tenancy dates. No ID numbers, no rent terms (PRD: "Do
 * not request unnecessary sensitive information").
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useOwner } from "./OwnerApp";
import { Confirm, Empty, Loading, TopBar, toast } from "./ownerUi";
import { normalizeIndianMobile } from "../../lib/mobile";
import { cleanLinkedIn, friendlyError, occupancyOf, op, propertyName, saveTenant, updateProperty } from "../../lib/owners";

export default function TenantForm() {
  const { id } = useParams();
  const { tenants, properties } = useOwner();
  const existing = id ? tenants.find((t) => t.id === id) : null;
  if (!properties) return <><TopBar title="Tenant" back /><Loading /></>;
  if (id && !existing) return <><TopBar title="Edit tenant" back /><Empty>That tenant isn't in your records.</Empty></>;
  return <TenantFormInner key={existing?.id || "new"} existing={existing} />;
}

function TenantFormInner({ existing }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { properties, tenants, setTenants, reloadProperties } = useOwner();
  const [f, setF] = useState(() => ({
    property_id: existing?.property_id || params.get("property") || properties[0]?.property_id || "",
    name: existing?.name || "", phone: existing?.phone || "", email: existing?.email || "",
    occupation: existing?.occupation || "", company: existing?.company || "", linkedin_url: existing?.linkedin_url || "",
    move_in_date: existing?.move_in_date || "", lease_end_date: existing?.lease_end_date || "", notes: existing?.notes || "",
    status: existing?.status || "active",
  }));
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [askOccupied, setAskOccupied] = useState(null);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const x = {};
    if (!f.property_id) x.property_id = "Pick the property";
    if (!f.name.trim()) x.name = "Enter the tenant's name";
    if (!normalizeIndianMobile(f.phone)) x.phone = "Enter a 10-digit mobile number";
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) x.email = "That doesn't look like an email";
    if (f.linkedin_url && !cleanLinkedIn(f.linkedin_url)) x.linkedin_url = "Paste a linkedin.com/in/… profile link";
    if (f.move_in_date && f.lease_end_date && f.lease_end_date < f.move_in_date) x.lease_end_date = "Ends before it starts";
    setErr(x);
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const row = await saveTenant(f, existing?.id);
      setTenants((ts) => (existing ? ts.map((t) => (t.id === row.id ? row : t)) : [row, ...ts]));
      toast(existing ? "Tenant updated" : "Tenant added");
      const p = properties.find((x2) => x2.property_id === row.property_id);
      // A flat someone now lives in should not still be advertised.
      if (!existing && p && occupancyOf(p, tenants) !== "occupied" && p.status !== "rented") {
        setAskOccupied({ property: p, tenantId: row.id });
        setSaving(false);
        return;
      }
      navigate(op(`/tenants/${row.id}`), { replace: true });
    } catch (e2) {
      toast(friendlyError(e2, "Could not save the tenant."), "error");
      setSaving(false);
    }
  };

  const markOccupied = async () => {
    setSaving(true);
    try {
      await updateProperty(askOccupied.property.property_id, { status: "rented" });
      await reloadProperties();
      toast("Marked occupied — it's off moveazy.co.in");
    } catch (e) {
      toast(friendlyError(e), "error");
    }
    navigate(op(`/tenants/${askOccupied.tenantId}`), { replace: true });
  };

  const field = (key, label, props = {}) => (
    <div className="oz-field">
      <label className="oz-label" htmlFor={`tf-${key}`}>{label}</label>
      <input id={`tf-${key}`} className="oz-input" value={f[key]} onChange={(e) => set({ [key]: e.target.value })} {...props} />
      {err[key] && <div className="oz-err">{err[key]}</div>}
    </div>
  );

  return (
    <>
      <TopBar title={existing ? "Edit Tenant" : "Add Tenant"} back />
      <form className="oz-pad" onSubmit={submit} noValidate>
        <div className="oz-section">
          <div className="oz-field">
            <label className="oz-label" htmlFor="tf-property">Property</label>
            <select id="tf-property" className="oz-select" value={f.property_id} onChange={(e) => set({ property_id: e.target.value })}>
              {properties.map((p) => <option key={p.property_id} value={p.property_id}>{propertyName(p)}</option>)}
            </select>
            {err.property_id && <div className="oz-err">{err.property_id}</div>}
          </div>
          {field("name", "Full name *", { placeholder: "Rahul Mehta", autoFocus: !existing })}
          {field("phone", "Mobile number *", { inputMode: "tel", placeholder: "98765 43210" })}
          {field("email", "Email", { type: "email", placeholder: "rahul@gmail.com" })}
        </div>
        <div className="oz-section">
          <h2 className="oz-h2">Work <span className="oz-hint">optional</span></h2>
          <div className="oz-grid2">
            {field("occupation", "Occupation", { placeholder: "Software Engineer" })}
            {field("company", "Company", { placeholder: "Google" })}
          </div>
          {field("linkedin_url", "LinkedIn", { placeholder: "linkedin.com/in/rahul", inputMode: "url" })}
        </div>
        <div className="oz-section">
          <h2 className="oz-h2">Tenancy</h2>
          <div className="oz-grid2">
            {field("move_in_date", "Move-in date", { type: "date" })}
            {field("lease_end_date", "Expected move-out", { type: "date" })}
          </div>
          <div className="oz-field" style={{ marginBottom: 0 }}>
            <label className="oz-label" htmlFor="tf-notes">Notes</label>
            <textarea id="tf-notes" className="oz-textarea" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })}
              placeholder="Two flatmates, has a car, prefers WhatsApp…" />
          </div>
        </div>
        <p className="oz-hint">Don't store Aadhaar or PAN numbers here — keep the signed agreement in Documents instead.</p>
        <button type="submit" className="oz-btn oz-btn--primary oz-btn--block" disabled={saving}>{saving ? "Saving…" : existing ? "Save changes" : "Add tenant"}</button>
      </form>
      {askOccupied && (
        <Confirm title="Mark the flat as occupied?" busy={saving} confirmLabel="Yes, mark occupied"
          body={`${propertyName(askOccupied.property)} is still ${askOccupied.property.status === "published" ? "live on MovEazy" : "marked vacant"}. Marking it occupied takes it off the site and the broker network.`}
          onClose={() => navigate(op(`/tenants/${askOccupied.tenantId}`), { replace: true })} onConfirm={markOccupied} />
      )}
    </>
  );
}
