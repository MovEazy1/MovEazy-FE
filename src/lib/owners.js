/**
 * MovEazy Owners — every read and write the owner app makes, and the CRM's
 * Inventory Ops tab.
 *
 * The authority is MovEazy-BE/supabase/owner_schema.sql. Which flats are an
 * owner's is owner_property_links and nothing else; every function here that
 * touches a flat goes through a database function that checks it. Interested
 * renters arrive as "Rahul M." — the database never hands this file a
 * renter's phone, email or id, so there is nothing here that could leak one.
 *
 * Out of scope for V1, deliberately: rent collection, payment history, dues,
 * receipts and bank details.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { buildInventoryRow, generatePropertyId, isMissingColumn, withoutOptionalColumns } from "./inventory";
import { propertyLink } from "./crmSettings";
import { normalizeIndianMobile } from "./mobile";
import { MOVEAZY_TEAM_WHATSAPP } from "../config/contactChannels";

/* ── Where the app lives ─────────────────────────────────────────────────── */

/** owners.moveazy.co.in serves the app at its root; everywhere else it is /owners. */
export function isOwnerHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  return /^owners?\./i.test(String(hostname || ""));
}

export const OWNER_BASE = isOwnerHost() ? "" : "/owners";

/** An in-app path, spelled the same on either host. */
export const op = (path = "/") => `${OWNER_BASE}${path.startsWith("/") ? path : `/${path}`}` || "/";

export const PUBLIC_ORIGIN = "https://www.moveazy.co.in";

/** The public page for a flat, attributed to the owner app, always on the customer site. */
export function ownerListingLink(propertyId, medium = "whatsapp") {
  const url = new URL(propertyLink(propertyId, { source: "owner_app", medium, campaign: "owner_share" }));
  if (isOwnerHost() || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    return `${PUBLIC_ORIGIN}${url.pathname}${url.search}`;
  }
  return url.toString();
}

export function waLink(phone, text = "") {
  const local = normalizeIndianMobile(phone);
  const digits = local ? `91${local}` : String(phone || "").replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return digits ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
}

export const telLink = (phone) => {
  const local = normalizeIndianMobile(phone);
  return local ? `tel:+91${local}` : `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
};

/** The MovEazy team on WhatsApp, with the message pre-typed. */
export const teamWa = (text) => `${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`;

export const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

export const inrShort = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return v >= 100000 ? `₹${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L` : `₹${Math.round(v / 1000)}k`;
};

export function bhkLabel(p) {
  if (p?.flat_type) return p.flat_type;
  const b = Number(p?.bedrooms);
  return Number.isFinite(b) && b > 0 ? `${b} BHK` : "Home";
}

export const propertyName = (p) => `${bhkLabel(p)} · ${p?.area || "Bengaluru"}`;

export const fmtDate = (d, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  d ? new Date(String(d).length === 10 ? `${d}T00:00` : d).toLocaleDateString("en-IN", opts) : "";

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

export function relTime(d) {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d, { day: "numeric", month: "short" });
}

/** A LinkedIn profile URL we are willing to link to, or "". */
export function cleanLinkedIn(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname) || !/^\/(in|pub)\/[^/]+/i.test(u.pathname)) return "";
    return `https://www.linkedin.com${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

function need() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
}

export function friendlyError(e, fallback = "Something went wrong. Please try again.") {
  const msg = String(e?.message || "");
  if (/function .* does not exist|could not find the function/i.test(msg)) {
    return "The owner app isn't set up on this database yet (run owner_schema.sql).";
  }
  if (/bucket not found/i.test(msg)) return "Document storage isn't set up yet. Ask MovEazy to finish the setup.";
  if (e?.code === "22023" || (e?.code === "42501" && !/permission denied/i.test(msg))) return msg;
  return msg && msg.length < 140 && !/violates|syntax|relation|jwt/i.test(msg) ? msg : fallback;
}

async function rpc(name, args) {
  need();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

/* ── Me ──────────────────────────────────────────────────────────────────── */

export const fetchOwnerMe = () => rpc("owner_me");
export const registerOwner = (name = null) => rpc("owner_register", { p_name: name || null });

/* ── Properties ──────────────────────────────────────────────────────────── */

export async function fetchOwnerProperties() {
  const [rows, waiting] = await Promise.all([
    rpc("owner_properties"),
    // Before owner_auto_list.sql nothing waits; the flats still load.
    rpc("owner_waiting_to_list").catch(() => []),
  ]);
  const wait = new Set(waiting ?? []);
  return (rows ?? []).map((p) => ({
    ...p, images: p.images ?? [], amenities: p.amenities ?? [], list_when_ready: wait.has(p.property_id),
  }));
}

/**
 * "List on MovEazy": a vacant flat goes live as soon as it has a photo — at
 * once if it already has one. Off stops that. → the flat's status after it.
 */
export const listWhenReady = (propertyId, on) =>
  rpc("owner_list_when_ready", { p_property: propertyId, p_on: Boolean(on) });

export const updateProperty = (propertyId, patch) =>
  rpc("owner_update_property", { p_property: propertyId, p_patch: patch });

/**
 * A new flat, added in the app. An ordinary inventory row the owner posts (so
 * the same public page and broker network apply to it), claimed as theirs.
 * Occupied flats start as 'rented' — off the public site — and vacant ones as
 * 'paused'; the form's "List on MovEazy" switch (listWhenReady) then takes a
 * vacant one live on its first photo.
 */
export async function createOwnerProperty(draft, user) {
  need();
  let row = {
    ...buildInventoryRow({ ...draft, postedBy: "owner", phone: user?.phone || "" }, user),
    status: draft.occupied ? "rented" : "paused",
    property_type: draft.propertyType || "",
    area_sqft: draft.areaSqft ? Number(draft.areaSqft) : null,
    source: "owner_app",
  };
  let propertyId = row.property_id;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.from("inventory").insert(row).select("property_id").single();
    if (!error) break;
    if (error.code === "23505") {
      propertyId = generatePropertyId();
      row = { ...row, property_id: propertyId };
      continue;
    }
    if (isMissingColumn(error) && ("area_sqft" in row || "property_type" in row)) {
      row = withoutOptionalColumns(row);
      continue;
    }
    throw error;
  }
  await rpc("owner_claim_property", { p_property: propertyId });
  return propertyId;
}

/** Vacant / listed / occupied, as the owner reads it. */
export function occupancyOf(p, tenants = []) {
  const active = tenants.filter((t) => t.property_id === p.property_id && ["active", "invited"].includes(t.status));
  if (p.status === "rented" || active.length > 0) return "occupied";
  return p.status === "published" ? "listed" : "vacant";
}

/* ── Find a tenant ───────────────────────────────────────────────────────── */

export const fetchCandidates = (propertyId) =>
  rpc("owner_property_candidates", { p_property: propertyId }).then((r) => r ?? []);

export const CANDIDATE_LABEL = {
  visit_booked: "Visit booked",
  visited: "Visited",
  visit_requested: "Asked to visit",
  shortlisted: "Shortlisted by MovEazy",
  liked: "Liked your flat",
};

export const fetchAreaRent = (propertyId) => rpc("owner_area_rent", { p_property: propertyId });

/* ── Tenants ─────────────────────────────────────────────────────────────── */

const TENANT_COLS =
  "id,property_id,name,phone,email,occupation,company,linkedin_url,move_in_date,lease_end_date,moved_out_on,notes,status,created_at,updated_at";

export async function fetchOwnerTenants() {
  need();
  const { data, error } = await supabase.from("tenants").select(TENANT_COLS)
    .neq("status", "removed").order("created_at", { ascending: false });
  if (error) {
    // Before owner_schema.sql the new columns are missing; the roster still loads.
    if (isMissingColumn(error)) {
      const r = await supabase.from("tenants").select("id,property_id,name,phone,email,status,created_at")
        .neq("status", "removed");
      if (r.error) throw r.error;
      return r.data ?? [];
    }
    throw error;
  }
  return data ?? [];
}

function tenantRow(f) {
  return {
    property_id: f.property_id,
    name: String(f.name || "").trim().slice(0, 120),
    phone: normalizeIndianMobile(f.phone) || String(f.phone || "").trim().slice(0, 20),
    email: String(f.email || "").trim().toLowerCase().slice(0, 160),
    occupation: String(f.occupation || "").trim().slice(0, 80),
    company: String(f.company || "").trim().slice(0, 80),
    linkedin_url: cleanLinkedIn(f.linkedin_url),
    move_in_date: f.move_in_date || null,
    lease_end_date: f.lease_end_date || null,
    notes: String(f.notes || "").slice(0, 1000),
    status: f.status || "active",
    updated_at: new Date().toISOString(),
  };
}

export async function saveTenant(f, id = null) {
  need();
  const row = tenantRow(f);
  const q = id ? supabase.from("tenants").update(row).eq("id", id) : supabase.from("tenants").insert(row);
  const { data, error } = await q.select(TENANT_COLS).single();
  if (error) throw error;
  return data;
}

export async function patchTenant(id, patch) {
  need();
  const { data, error } = await supabase.from("tenants")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(TENANT_COLS).single();
  if (error) throw error;
  return data;
}

export async function fetchRatings() {
  if (!isSupabaseConfigured || !supabase) return {};
  const { data, error } = await supabase.from("owner_tenant_ratings").select("tenant_id,stars,comment,updated_at");
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.tenant_id, r]));
}

export async function saveRating(tenantId, stars, comment = "") {
  need();
  const { data, error } = await supabase.from("owner_tenant_ratings")
    .upsert({ tenant_id: tenantId, stars, comment: String(comment).slice(0, 500), updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" })
    .select("tenant_id,stars,comment,updated_at").single();
  if (error) throw error;
  return data;
}

/* ── Private files (owner-docs bucket) ───────────────────────────────────── */

const DOCS_BUCKET = "owner-docs";

/**
 * Shrink a photo before it leaves the phone (PRD: "compress and preview").
 * Anything that is not an image, or is already small, goes up as it is.
 */
export async function compressImage(file, { maxSide = 1600, quality = 0.8, minBytes = 700 * 1024 } = {}) {
  if (!file?.type?.startsWith("image/") || file.size < minBytes || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function uploadPrivate(uid, folder, file) {
  need();
  const safe = String(file.name || "file").replace(/[^a-z0-9._-]/gi, "-").toLowerCase().slice(-80);
  const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    upsert: false, contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(path, seconds = 120) {
  if (!isSupabaseConfigured || !supabase || !path) return "";
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, seconds);
  if (error) return "";
  return data?.signedUrl || "";
}

export async function uploadRequestPhotos(uid, files = []) {
  const out = [];
  for (const f of files) out.push(await uploadPrivate(uid, "requests", await compressImage(f)));
  return out;
}

export const DOC_KINDS = [
  ["agreement", "Rental agreement"],
  ["police_verification", "Police verification"],
  ["move_in", "Move-in photos & inventory"],
  ["other", "Other"],
];

export async function fetchDocuments() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from("owner_documents")
    .select("id,property_id,tenant_id,kind,title,storage_path,mime,size_bytes,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadDocument(uid, { file, kind, title, property_id = null, tenant_id = null }) {
  const upload = await compressImage(file);
  const path = await uploadPrivate(uid, "docs", upload);
  const { data, error } = await supabase.from("owner_documents").insert({
    kind, title: String(title || file.name || "Document").slice(0, 120), storage_path: path,
    mime: upload.type || "", size_bytes: upload.size || 0, property_id: property_id || null, tenant_id: tenant_id || null,
  }).select("id,property_id,tenant_id,kind,title,storage_path,mime,size_bytes,created_at").single();
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]).catch(() => {});
    throw error;
  }
  return data;
}

export async function deleteDocument(doc) {
  need();
  const { error } = await supabase.from("owner_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await supabase.storage.from(DOCS_BUCKET).remove([doc.storage_path]).catch(() => {});
}

/* ── Services, repairs, designer calls ───────────────────────────────────── */

export const REPAIR_CATEGORIES = [
  { key: "ac", label: "AC Service" },
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "painting", label: "Painting" },
  { key: "cleaning", label: "Cleaning" },
  { key: "appliance", label: "Appliance Repair" },
  { key: "other", label: "Other" },
];

export const SERVICE_TABS = [
  { key: "popular", label: "Popular" },
  { key: "cleaning", label: "Cleaning" },
  { key: "repairs", label: "Repairs" },
  { key: "appliances", label: "Appliances" },
  { key: "painting", label: "Painting" },
];

export const SLOTS = [
  ["morning", "Morning", "9am – 12pm"],
  ["afternoon", "Afternoon", "12 – 4pm"],
  ["evening", "Evening", "4 – 8pm"],
  ["any", "Any time", ""],
];

export const REQUEST_STATUS = {
  open: { label: "Open", tone: "red" },
  awaiting_approval: { label: "Needs approval", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  in_progress: { label: "In Progress", tone: "blue" },
  resolved: { label: "Resolved", tone: "green" },
  cancelled: { label: "Cancelled", tone: "grey" },
};

/** The four tabs on the Repairs screen. */
export function requestBucket(status) {
  if (status === "resolved") return "resolved";
  if (status === "scheduled" || status === "in_progress") return "in_progress";
  if (status === "cancelled") return "cancelled";
  return "open";
}

export async function fetchCatalogue() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.from("owner_service_catalogue")
    .select("id,category,title,from_price,summary,scope,duration,popular,sort,active")
    .eq("active", true).order("sort");
  if (error) throw error;
  return data ?? [];
}

export const fetchRequests = () => rpc("owner_requests_list").then((r) => (r ?? []).map((q) => ({ ...q, events: q.events ?? [] })));
export const createRequest = (payload) => rpc("owner_create_request", { p: payload });
export const respondQuote = (id, approve) => rpc("owner_respond_quote", { p_request: id, p_approve: approve });
export const cancelRequest = (id) => rpc("owner_cancel_request", { p_request: id });
export const fetchActivity = (days = 30) => rpc("owner_activity", { p_days: days }).then((r) => r ?? []);

/* ── CRM: Inventory Ops ──────────────────────────────────────────────────── */

export const opsUpdateRequest = (id, patch) => rpc("ops_update_request", { p_request: id, p_patch: patch });
export const adminListOwners = () => rpc("owner_admin_list").then((r) => r ?? []);
export const adminSetOwnerStatus = (userId, status) => rpc("owner_admin_set_status", { p_user: userId, p_status: status });
export const adminOwnerSettings = ({ autoApprove = null, threshold = null } = {}) =>
  rpc("owner_admin_settings", { p_auto_approve: autoApprove, p_threshold: threshold });
export const adminLinkProperty = (propertyId, userId) =>
  rpc("owner_admin_link_property", { p_property: propertyId, p_user: userId });
export const adminUnlinkProperty = (propertyId) => rpc("owner_admin_unlink_property", { p_property: propertyId });

/** Everything the ops queue needs, in one round of requests (staff-read policies). */
export async function fetchOpsData() {
  need();
  const [requests, events, owners, links, settings, tenants, catalogue] = await Promise.all([
    supabase.from("owner_requests").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("owner_request_events").select("*").order("at", { ascending: true }).limit(5000),
    supabase.from("owner_accounts").select("user_id,name,phone,email,status"),
    supabase.from("owner_property_links").select("property_id,owner_id,linked_by,linked_at"),
    supabase.from("owner_program_settings").select("auto_approve,quote_approval_threshold,updated_at,updated_by").eq("id", 1).maybeSingle(),
    supabase.from("tenants").select("id,property_id,name,phone,status").in("status", ["active", "invited"]),
    supabase.from("owner_service_catalogue").select("*").order("sort"),
  ]);
  if (requests.error) throw requests.error;
  const byRequest = new Map();
  for (const e of events.data ?? []) {
    if (!byRequest.has(e.request_id)) byRequest.set(e.request_id, []);
    byRequest.get(e.request_id).push(e);
  }
  return {
    requests: (requests.data ?? []).map((r) => ({ ...r, events: byRequest.get(r.id) ?? [] })),
    owners: owners.data ?? [],
    links: links.data ?? [],
    settings: settings.data ?? null,
    tenants: tenants.data ?? [],
    catalogue: catalogue.data ?? [],
  };
}

export async function saveCatalogueItem(item) {
  need();
  const row = {
    id: String(item.id || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    category: item.category || "repairs",
    title: String(item.title || "").trim(),
    from_price: Math.max(0, Math.round(Number(item.from_price) || 0)),
    summary: String(item.summary || "").trim(),
    scope: String(item.scope || ""),
    duration: String(item.duration || ""),
    popular: Boolean(item.popular),
    sort: Number(item.sort) || 100,
    active: item.active !== false,
    updated_at: new Date().toISOString(),
  };
  if (!row.id || !row.title) throw new Error("A service needs an id and a title.");
  const { error } = await supabase.from("owner_service_catalogue").upsert(row, { onConflict: "id" });
  if (error) throw error;
  return row;
}
