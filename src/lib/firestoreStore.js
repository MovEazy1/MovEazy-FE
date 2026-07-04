import { supabase, isSupabaseConfigured } from "./supabase";
import { sanitizePublicListing } from "./accessControl";

/**
 * Legacy Firestore-backed marketplace/CRM module — being retired now that auth
 * and data live in Supabase. Only the functions below are called from a live
 * route (Profile, PropertyModal via FlatSearchAgentChat); everything past that
 * marker only exists so the still-imported-but-unrouted legacy admin/seller/CRM
 * pages don't crash at parse time, and returns safe empty defaults.
 */

/** Shown on map / discovery; withdrawn = off-market (seller hid listing; admin can still delete doc). */
export function isListingPubliclyVisible(listing) {
  const s = String(listing?.marketStatus || "published").toLowerCase();
  return s !== "withdrawn" && s !== "archived";
}

/** Customer-facing listing catalogue now comes from the static/local catalog (see lib/store.js). */
export async function getListingsData() {
  const { getListings } = await import("./store");
  return getListings().map(sanitizePublicListing);
}

export async function getAdminListingsData() {
  return getListingsData();
}

/** Broker/owner phone for a listing, when the caller is authorized to see it. */
export async function getListingPrivateData(listingId) {
  const id = String(listingId || "");
  if (!id || !isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from("listing_private").select("*").eq("listing_id", id).maybeSingle();
  if (error || !data) return null;
  return { id: data.listing_id, agentPhone: data.agent_phone, ownerPhone: data.owner_phone, ownerEmail: data.owner_email };
}

export async function upsertListingPrivateData(listingId, privateFields, actor) {
  const id = String(listingId || "");
  if (!id) throw new Error("listingId is required");
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const payload = {
    listing_id: id,
    agent_phone: privateFields?.agentPhone || "",
    owner_phone: privateFields?.ownerPhone || "",
    owner_email: String(actor?.email || "").toLowerCase().trim(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("listing_private").upsert(payload, { onConflict: "listing_id" });
  if (error) throw error;
  return payload;
}

/** Tour / visit request submitted from the listing modal ("Request a tour" / "Enquire"). */
export async function addVisitRequestData({ listingId, listingTitle, customerEmail, customerPhone, sellerEmail, visitTime, notes }) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const record = {
    listing_id: String(listingId),
    listing_title: listingTitle || "",
    customer_email: customerEmail,
    customer_phone: customerPhone || "",
    seller_email: sellerEmail || "",
    visit_time: visitTime || "",
    notes: notes || "",
    status: "pending",
  };
  const { data, error } = await supabase.from("visit_requests").insert(record).select("id, created_at").single();
  if (error) throw error;
  return { id: data.id, ...record, createdAt: data.created_at };
}

export async function getVisitsForCustomerEmail(customerEmail) {
  const em = String(customerEmail || "").toLowerCase().trim();
  if (!em || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("visit_requests")
    .select("*")
    .eq("customer_email", em)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

/** Save a listing for the signed-in customer ("Save" heart button). Upsert so re-saving is a no-op.
 * `listingData` is a snapshot of the full listing (title/image/rent/address) so the Profile
 * "Saved" tab can render and open it without a separate catalog lookup. */
export async function addSavedPropertyData({ listingId, listingTitle, listingData, customerId }) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const record = {
    listing_id: String(listingId),
    listing_title: listingTitle || "",
    listing_data: listingData || null,
    customer_id: customerId,
  };
  const { data, error } = await supabase
    .from("saved_properties")
    .upsert(record, { onConflict: "customer_id,listing_id" })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return { id: data.id, ...record, createdAt: data.created_at };
}

export async function removeSavedPropertyData(customerId, listingId) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from("saved_properties")
    .delete()
    .eq("customer_id", customerId)
    .eq("listing_id", String(listingId));
  if (error) throw error;
}

export async function getSavedPropertiesForCustomer(customerId) {
  if (!customerId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("saved_properties")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

/* ── Legacy Firestore marketplace/CRM (SellerDashboard/AdminDashboard/CrmDashboard —
 * currently unrouted). Stubs below keep those pages import-safe without Firebase. */

export async function uploadListingFiles() {
  return [];
}

export function mergeAdminListingsWithSeedData(rows) {
  return Array.isArray(rows) ? rows.map((r) => sanitizePublicListing(r)) : [];
}

export async function getListingsForSellerEmail() {
  return [];
}

export async function upsertListingData(listing) {
  return { ...listing, updatedAt: new Date().toISOString() };
}

export async function withdrawListingBySeller() {}

export async function republishListingBySeller() {}

export async function removeListingData() {}

export async function getAssignmentsData() {
  return [];
}

export async function addAssignmentData(payload) {
  return { id: `local-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
}

export async function getAllUsersData() {
  return [];
}

export async function addUserProfileData() {}

export async function updateUserProfileData() {}

export async function removeUserProfileData() {}

export async function getSellerRequestsData() {
  return [];
}

export async function addSellerRequestData() {}

export async function getVisitsData() {
  return [];
}

export async function getVisitsForSellerEmail() {
  return [];
}

export async function addInterestRequestData() {
  return `local-${Date.now()}`;
}

export async function getInterestsData() {
  return [];
}

/** Interest submissions now live in local storage (see lib/crmSync.js, lib/store.js). */
export async function getInterestsForCustomerEmail(customerEmail) {
  const { getInterestsGlobal } = await import("./store");
  const em = String(customerEmail || "").toLowerCase().trim();
  if (!em) return [];
  return getInterestsGlobal().filter((i) => String(i.customerEmail || "").toLowerCase() === em);
}

export async function getInterestsForSellerEmail() {
  return [];
}

export async function getAssignmentsForCustomerEmail() {
  return [];
}

export async function getAssignmentsForSellerEmail() {
  return [];
}

export async function updateInterestStatusData() {}

export async function updateInterestSellerNotesData() {}

export async function addNotificationData() {}

export async function getAdminNotificationsData() {
  return [];
}

export async function getSellerNotificationsData() {
  return [];
}

export async function getCustomerNotificationsData() {
  return [];
}

export async function getConsultantNotificationsData() {
  return [];
}

export async function markNotificationReadData() {}

export async function getListingImages() {
  return [];
}

export async function addActivityEventData() {}

export async function getActivityEventsForEmail() {
  return [];
}

export async function getCrmLeadsForStaff() {
  return [];
}

export async function createCrmLeadData(payload) {
  return { id: `local-${Date.now()}`, ...payload };
}

export async function updateCrmLeadData() {}

export async function getCrmTasksForStaff() {
  return [];
}

export async function addCrmTaskData(payload) {
  return { id: `local-${Date.now()}`, ...payload };
}

export async function setCrmTaskCompletedData() {}
