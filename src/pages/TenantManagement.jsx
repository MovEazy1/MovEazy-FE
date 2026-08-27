/**
 * "Tenant Management" — for an owner, two things per property:
 * 1. How much interest it's getting (views, shortlists, visit requests/bookings,
 *    likes/dislikes) — backed by the my_listing_stats() RPC
 *    (MovEazy-BE/supabase/owner_dashboard_stats.sql), security-definer and
 *    scoped server-side to the caller's own poster_id, returning only
 *    aggregate counts, never who did what.
 * 2. Who's actually renting it — name, contact, rent, due day — added by the
 *    owner and invited to join MovEazy (see MovEazy-BE/supabase/tenants_schema.sql,
 *    lib/tenants.js). The invite is sent via the same EmailJS pipeline used
 *    elsewhere in the app (lib/emailService.js) when it's configured; either
 *    way the owner can copy the same message to send over WhatsApp/SMS
 *    themselves, since a non-technical owner shouldn't be blocked on an email
 *    template existing.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchMyListingStats } from "../lib/ownerDashboard";
import { fetchTenantsFor, addTenant, removeTenant, markInviteSent } from "../lib/tenants";
import { triggerTenantInviteEmail, tenantInviteMessage } from "../lib/emailService";

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const STATUS = {
  published: { label: "Live", bg: "#ecfdf5", fg: "#15803d", bd: "#a7f3d0" },
  paused:    { label: "Paused", bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  rented:    { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
  sold:      { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
};
const TENANT_STATUS = {
  invited: { label: "Invited", bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  active:  { label: "Active", bg: "#ecfdf5", fg: "#15803d", bd: "#a7f3d0" },
};

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-2 text-center">
      <p className="text-[15px] font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1 leading-tight break-words">{label}</p>
    </div>
  );
}

const emptyForm = { name: "", phone: "", email: "", rentAmount: "", rentDueDay: "1" };

export default function TenantManagement() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [tenantsByProperty, setTenantsByProperty] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [formFor, setFormFor] = useState(null); // property_id currently showing the add-tenant form
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [busyId, setBusyId] = useState(""); // tenant id mid-action (invite/remove)
  const [noteById, setNoteById] = useState({}); // { [tenant.id]: "Invite sent" | "Copied — paste it into WhatsApp" | ... }

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchMyListingStats();
      setRows(data);
      const ids = data.map((r) => r.property_id);
      if (ids.length) setTenantsByProperty(await fetchTenantsFor(ids));
    } catch (e) {
      setErr(e?.message || "Could not load your leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    load();
  }, [authLoading, user]);

  const openForm = (propertyId) => {
    setFormFor(propertyId);
    setForm(emptyForm);
    setFormErr("");
  };

  const saveTenant = async (propertyId) => {
    setSaving(true);
    setFormErr("");
    try {
      const created = await addTenant(propertyId, form);
      setTenantsByProperty((prev) => ({ ...prev, [propertyId]: [created, ...(prev[propertyId] || [])] }));
      setFormFor(null);
      setForm(emptyForm);
    } catch (e) {
      setFormErr(e?.message || "Could not add this tenant.");
    } finally {
      setSaving(false);
    }
  };

  const inviteMessageFor = (propertyRow, tenant) => {
    const inviteLink = `${window.location.origin}/auth?next=/rent-management`;
    return tenantInviteMessage({
      tenantName: tenant.name,
      ownerName: user?.name || user?.email?.split("@")[0],
      listingTitle: propertyRow?.title || propertyRow?.area,
      rentAmount: tenant.rent_amount,
      rentDueDay: tenant.rent_due_day,
      inviteLink,
    });
  };

  const sendInvite = async (propertyRow, tenant) => {
    setBusyId(tenant.id);
    try {
      const inviteLink = `${window.location.origin}/auth?next=/rent-management`;
      const res = tenant.email
        ? await triggerTenantInviteEmail({
            toEmail: tenant.email,
            tenantName: tenant.name,
            ownerName: user?.name || user?.email?.split("@")[0],
            listingTitle: propertyRow?.title || propertyRow?.area,
            rentAmount: tenant.rent_amount,
            rentDueDay: tenant.rent_due_day,
            inviteLink,
          })
        : { ok: false, skipped: true };
      await markInviteSent(tenant.id);
      setTenantsByProperty((prev) => ({
        ...prev,
        [propertyRow.property_id]: (prev[propertyRow.property_id] || []).map((t) =>
          t.id === tenant.id ? { ...t, invited_at: new Date().toISOString() } : t
        ),
      }));
      setNoteById((n) => ({
        ...n,
        [tenant.id]: res.ok ? "Invite emailed ✓" : "Couldn't email it — use “Copy invite” below to send it yourself.",
      }));
    } finally {
      setBusyId("");
    }
  };

  const copyInvite = async (propertyRow, tenant) => {
    const text = inviteMessageFor(propertyRow, tenant);
    try {
      await navigator.clipboard.writeText(text);
      setNoteById((n) => ({ ...n, [tenant.id]: "Copied — paste it into WhatsApp or SMS" }));
      await markInviteSent(tenant.id);
      setTenantsByProperty((prev) => ({
        ...prev,
        [propertyRow.property_id]: (prev[propertyRow.property_id] || []).map((t) =>
          t.id === tenant.id ? { ...t, invited_at: new Date().toISOString() } : t
        ),
      }));
    } catch {
      setNoteById((n) => ({ ...n, [tenant.id]: "Couldn't copy — select and copy the message manually." }));
    }
  };

  const doRemove = async (propertyId, tenantId) => {
    setBusyId(tenantId);
    try {
      await removeTenant(tenantId);
      setTenantsByProperty((prev) => ({
        ...prev,
        [propertyId]: (prev[propertyId] || []).filter((t) => t.id !== tenantId),
      }));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">Tenant Management</h1>
        <p className="text-[13px] text-gray-500 mt-1 mb-6">
          How much interest each property is getting, and who&apos;s actually renting it.
        </p>

        {!authLoading && !user ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Sign in to see your leads</p>
            <p className="text-[13px] text-gray-500 mb-4">This is tied to the properties on your MovEazy account.</p>
            <button type="button" onClick={() => openLogin()}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              Sign in
            </button>
          </div>
        ) : loading ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Nothing to show yet</p>
            <p className="text-[13px] text-gray-500 mb-4">List a property and its leads will show up here.</p>
            <button type="button" onClick={() => navigate("/list-my-flat")}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              List my flat
            </button>
          </div>
        ) : (
          <>
            {err && <p className="text-[12px] font-semibold text-red-500 mb-3">{err}</p>}
            <div className="space-y-4">
              {rows.map((p) => {
                const st = STATUS[p.status] || STATUS.published;
                const cover = p.cover_image_url || (p.images || [])[0] || "";
                const tenants = tenantsByProperty[p.property_id] || [];
                return (
                  <div key={p.property_id} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    <div className="flex gap-4 p-4">
                      <div
                        className="w-20 h-20 rounded-xl shrink-0 bg-gray-100 bg-cover bg-center"
                        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
                      >
                        {!cover && (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 text-center px-2">No photo</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-extrabold text-gray-900 truncate">
                              {p.title || `${p.area || "Home"}`}
                            </p>
                            <p className="text-[12px] text-gray-500 truncate">{p.area || "—"} · {inr(p.rent)}/mo</p>
                          </div>
                          <span
                            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                            style={{ background: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}
                          >
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-4 pb-4">
                      <Stat label="Views" value={p.view_count ?? 0} />
                      <Stat label="Shortlisted" value={p.shortlist_count ?? 0} />
                      <Stat label="Visit requests" value={p.visit_request_count ?? 0} />
                      <Stat label="Visits booked" value={p.visit_booking_count ?? 0} />
                      <Stat label="Liked" value={p.like_count ?? 0} />
                      <Stat label="Disliked" value={p.dislike_count ?? 0} />
                    </div>

                    <div className="border-t border-gray-100 px-4 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-extrabold text-gray-900">Tenants</p>
                        {formFor !== p.property_id && (
                          <button type="button" onClick={() => openForm(p.property_id)}
                            className="h-8 px-3 rounded-lg text-[12px] font-bold text-white"
                            style={{ background: "#16a34a" }}>
                            + Add tenant
                          </button>
                        )}
                      </div>

                      {tenants.length === 0 && formFor !== p.property_id && (
                        <p className="text-[12px] text-gray-400">No tenant added yet.</p>
                      )}

                      <div className="space-y-2">
                        {tenants.map((t) => {
                          const ts = TENANT_STATUS[t.status] || TENANT_STATUS.invited;
                          return (
                            <div key={t.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-bold text-gray-900 truncate">{t.name}</p>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    {[t.phone, t.email].filter(Boolean).join(" · ") || "No contact on file"}
                                  </p>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    {inr(t.rent_amount)}/mo · due day {t.rent_due_day}
                                  </p>
                                </div>
                                <span
                                  className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                                  style={{ background: ts.bg, color: ts.fg, border: `1px solid ${ts.bd}` }}
                                >
                                  {ts.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <button type="button" disabled={busyId === t.id} onClick={() => sendInvite(p, t)}
                                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-50">
                                  {t.invited_at ? "Resend invite email" : "Email invite"}
                                </button>
                                <button type="button" disabled={busyId === t.id} onClick={() => copyInvite(p, t)}
                                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-50">
                                  Copy invite
                                </button>
                                <button type="button" disabled={busyId === t.id} onClick={() => doRemove(p.property_id, t.id)}
                                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">
                                  Remove
                                </button>
                                {noteById[t.id] && <span className="text-[11px] text-gray-500">{noteById[t.id]}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {formFor === p.property_id && (
                        <div className="mt-3 rounded-xl border border-gray-200 p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Tenant name" className="col-span-2 h-9 px-3 rounded-lg border border-gray-200 text-[13px]"
                            />
                            <input
                              value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                              placeholder="Phone" className="h-9 px-3 rounded-lg border border-gray-200 text-[13px]"
                            />
                            <input
                              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                              placeholder="Email" className="h-9 px-3 rounded-lg border border-gray-200 text-[13px]"
                            />
                            <input
                              value={form.rentAmount} onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))}
                              placeholder="Monthly rent (₹)" type="number" min="0"
                              className="h-9 px-3 rounded-lg border border-gray-200 text-[13px]"
                            />
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] text-gray-500 whitespace-nowrap">Due day</label>
                              <input
                                value={form.rentDueDay} onChange={(e) => setForm((f) => ({ ...f, rentDueDay: e.target.value }))}
                                type="number" min="1" max="28" className="h-9 w-16 px-2 rounded-lg border border-gray-200 text-[13px]"
                              />
                            </div>
                          </div>
                          {formErr && <p className="text-[11px] font-semibold text-red-500">{formErr}</p>}
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={saving} onClick={() => saveTenant(p.property_id)}
                              className="h-9 px-4 rounded-lg text-[12px] font-bold text-white disabled:opacity-60"
                              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
                              {saving ? "Saving…" : "Save tenant"}
                            </button>
                            <button type="button" onClick={() => setFormFor(null)}
                              className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
