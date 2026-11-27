/**
 * Rent agreements (MovEazy-BE/supabase/rent_agreements.sql).
 *
 * A request by an owner, broker or tenant → routed to the nearest local vendor
 * → the vendor prepares and uploads the stamped PDF → owner and tenant e-sign
 * through a link → saved with a renewal date. Simple e-sign (typed/drawn +
 * Google-verified account + timestamp). Price is per city, paid in-app (manual
 * CRM mark-paid until the Razorpay gate is wired). Aadhaar is only ever shown to
 * the vendor and CRM super-admin.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

const BUCKET = "rent-agreements";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/* ── Status ─────────────────────────────────────────────────────────────────── */

export const RENT_STATUS = {
  unpaid:           { label: "Payment pending",   tone: "#B45309", step: 1 },
  with_vendor:      { label: "With the vendor",    tone: "#1D4ED8", step: 2 },
  ready_to_sign:    { label: "Ready to sign",      tone: "#7C3AED", step: 3 },
  partially_signed: { label: "Partly signed",      tone: "#7C3AED", step: 3 },
  completed:        { label: "Signed & saved",     tone: "#059669", step: 4 },
  cancelled:        { label: "Cancelled",          tone: "#6B7280", step: 0 },
};
export const statusInfo = (s) => RENT_STATUS[s] || { label: s || "—", tone: "#6B7280", step: 0 };

export const ROLE_LABEL = { owner: "Owner", tenant: "Tenant", broker: "Broker" };

export const fmtINR = (n) =>
  n == null || n === "" ? "—" : "₹" + Number(n).toLocaleString("en-IN");

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/* ── Requester (owner / broker / tenant apps + the site) ────────────────────── */

/** Create a request. See rent_request() for the payload shape. */
export const requestRentAgreement = (payload) => rpc("rent_request", { p: payload });

/** Agreements the signed-in person is on (as requester or party). */
export const fetchMyAgreements = () => rpc("rent_my_agreements").then((r) => r ?? []);

export const fetchAgreement = (id) => rpc("rent_agreement", { p_id: id });

export const renewAgreement = (id, patch = {}) => rpc("rent_renew", { p_id: id, p: patch });

/* ── Party signing (/rent/sign/:token) ──────────────────────────────────────── */

/** Open a sign link: binds the account to the party and returns the agreement. */
export const openSignLink = (token) => rpc("rent_sign_view", { p_token: token });

/** Record the e-signature. type: "typed" | "drawn"; data: the name or a data-URL. */
export const signAgreement = (token, type, data) =>
  rpc("rent_sign", { p_token: token, p_type: type, p_data: data });

/* ── Vendor app ─────────────────────────────────────────────────────────────── */

export const fetchVendorMe = () => rpc("rent_vendor_me");
export const fetchVendorQueue = (status = null) => rpc("rent_vendor_queue", { p_status: status }).then((r) => r ?? []);
export const fetchVendorAgreement = (id) => rpc("rent_vendor_agreement", { p_id: id });
export const vendorUpdateDetails = (id, patch) => rpc("rent_vendor_update", { p_id: id, p: patch });
export const vendorRecordUpload = (id, path, name) => rpc("rent_vendor_upload", { p_id: id, p_path: path, p_name: name });
export const vendorFlag = (id, stamped, registered) =>
  rpc("rent_vendor_flag", { p_id: id, p_stamped: stamped ?? null, p_registered: registered ?? null });

/* ── CRM ────────────────────────────────────────────────────────────────────── */

export const crmRentList = (city = null, status = null) => rpc("crm_rent_list", { p_city: city, p_status: status }).then((r) => r ?? []);
export const crmRentDetail = (id) => rpc("crm_rent_detail", { p_id: id });
export const crmRentPrices = () => rpc("crm_rent_prices").then((r) => r ?? {});
export const crmRentSetPrice = (city, price) => rpc("crm_rent_set_price", { p_city: city, p_price: Math.round(Number(price) || 0) });
export const crmRentMarkPaid = (id, ref = "manual") => rpc("crm_rent_mark_paid", { p_id: id, p_ref: ref });
export const crmRentAssignVendor = (id, vendorId) => rpc("crm_rent_assign_vendor", { p_id: id, p_vendor: vendorId });
export const crmRentCancel = (id) => rpc("crm_rent_cancel", { p_id: id });
export const crmRentVendors = () => rpc("crm_rent_vendors").then((r) => r ?? []);
export const crmRentVendorSave = (vendor) => rpc("crm_rent_vendor_save", { p: vendor });
export const crmRentRenewals = (city = null) => rpc("crm_rent_renewals", { p_city: city }).then((r) => r ?? []);

/* ── Storage: the stamped PDF ───────────────────────────────────────────────── */

/** Vendor uploads the stamped file, then records it with vendorRecordUpload. */
export async function uploadStampedPdf(agreementId, file) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const safe = String(file.name || "agreement.pdf").replace(/[^a-z0-9._-]/gi, "-").toLowerCase().slice(-80);
  const path = `${agreementId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false, contentType: file.type || "application/pdf",
  });
  if (error) throw error;
  return { path, name: file.name || safe };
}

/** A short-lived signed URL to view/download the stamped PDF. */
export async function signedDocUrl(path, seconds = 300) {
  if (!isSupabaseConfigured || !supabase || !path) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) return "";
  return data?.signedUrl || "";
}

/* ── Current location (for nearest-vendor routing) ──────────────────────────── */

/** Best-effort browser geolocation; resolves {lat,lng} or {} (never rejects). */
export function getCurrentLatLng(timeout = 8000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: false, timeout, maximumAge: 300000 }
    );
  });
}

/* ── WhatsApp share of a sign link ──────────────────────────────────────────── */

export function siteOrigin() {
  if (typeof window === "undefined") return "https://moveazy.co.in";
  const h = window.location.hostname.replace(/^(partners|owners?|society|tenants?|vendor)\./i, "");
  return `${window.location.protocol}//${h === "localhost" || /^\d/.test(h) ? window.location.host : h}`;
}

export const signUrl = (token) => `${siteOrigin()}/rent/sign/${token}`;

export function waShareSign(party, agreement) {
  const url = signUrl(party.sign_token);
  const who = party.name || ROLE_LABEL[party.role] || "there";
  const msg =
    `Hi ${who}, your MovEazy rent agreement is ready to sign.\n` +
    `View, download and e-sign here: ${url}\n` +
    (agreement?.rent ? `Rent ${fmtINR(agreement.rent)} · ${fmtDate(agreement.start_date)} start.` : "");
  const to = (party.mobile || "").replace(/\D/g, "");
  return `https://wa.me/${to ? (to.length === 10 ? "91" + to : to) : ""}?text=${encodeURIComponent(msg)}`;
}

/* ── The request form schema (shared by every entry point) ──────────────────── */

export const FURNISHING = ["Unfurnished", "Semi-furnished", "Furnished"];
export const UTILITIES = ["Electricity", "Water", "Gas", "Piped gas"];
export const PARKING = ["None", "2-wheeler", "4-wheeler", "Both"];

/** An empty form. role is filled from the app the request starts in. */
export const emptyRequest = (role = "tenant", city = "") => ({
  role, city,
  property_id: "",
  address: { building: "", flat_no: "", floor: "", street: "", locality: "", pincode: "" },
  area: "",
  flat_type: "", furnishing: "Semi-furnished",
  owner: { name: "", mobile: "", email: "" },
  tenant: { name: "", mobile: "", email: "", aadhaar: "" },
  occupants: [{ name: "", relation: "", age: "" }],
  rent: "", deposit: "", maintenance: "included", maintenance_amount: "",
  start_date: "", duration_months: 11, lock_in_months: "", notice_months: 1,
  increment_pct: 5, rent_due_day: 5,
  utilities: [], parking: "None", pets: false, repaint_months: 1,
});

/** Turn the form state into the rent_request payload. */
export function toRequestPayload(f, latlng = {}) {
  const addr = f.address || {};
  return {
    city: f.city, role: f.role, property_id: f.property_id || null,
    lat: latlng.lat ?? null, lng: latlng.lng ?? null,
    aadhaar: (f.tenant?.aadhaar || "").trim(),
    rent: f.rent, deposit: f.deposit,
    start_date: f.start_date, duration_months: f.duration_months,
    owner: { name: f.owner?.name, mobile: f.owner?.mobile, email: f.owner?.email },
    tenant: { name: f.tenant?.name, mobile: f.tenant?.mobile, email: f.tenant?.email },
    details: {
      area: f.area,
      address: [addr.building, addr.flat_no && `Flat ${addr.flat_no}`, addr.floor && `Floor ${addr.floor}`,
                addr.street, addr.locality, addr.pincode].filter(Boolean).join(", "),
      address_parts: addr,
      flat_type: f.flat_type, furnishing: f.furnishing,
      occupants: (f.occupants || []).filter((o) => o.name).map((o) => ({ name: o.name, relation: o.relation, age: o.age })),
      occupant_count: (f.occupants || []).filter((o) => o.name).length,
      owner_address: f.owner?.address || "",
      maintenance: f.maintenance, maintenance_amount: f.maintenance_amount,
      lock_in_months: f.lock_in_months, notice_months: f.notice_months,
      increment_pct: f.increment_pct, rent_due_day: f.rent_due_day,
      utilities: f.utilities, parking: f.parking, pets: f.pets, repaint_months: f.repaint_months,
    },
  };
}

/** Validate; returns an array of human messages (empty = ok). */
export function validateRequest(f) {
  const e = [];
  if (!f.city) e.push("Pick the city.");
  if (!f.owner?.name || !f.owner?.mobile) e.push("Owner name and mobile are needed.");
  if (!f.tenant?.name || !f.tenant?.mobile) e.push("Tenant name and mobile are needed.");
  if (!f.owner?.email && !f.tenant?.email) e.push("At least one email is needed so they can sign.");
  if (!f.rent) e.push("Monthly rent is needed.");
  if (!f.start_date) e.push("Start date is needed.");
  return e;
}
