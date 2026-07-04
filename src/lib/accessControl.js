/** Roles that may see staff CRM and broker private listing phones (Firestore rules must match). */
export const STAFF_ROLES = ["admin", "sub_admin", "consultant"];

export function normalizeStaffRole(role) {
  return String(role ?? "")
    .toLowerCase()
    .trim();
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(normalizeStaffRole(role));
}

/** May create leads/tasks; sub-admins only see leads/tasks where they are assignee (same as consultants). */
export function isCrmElevatedRole(role) {
  const r = normalizeStaffRole(role);
  return r === "admin" || r === "sub_admin";
}

export function isConsultantRole(role) {
  return normalizeStaffRole(role) === "consultant";
}

/**
 * Who may read listingPrivate (agent / owner phones). Matches Firestore rules intent.
 * Signed-in verified users only (session already requires verification for Firebase).
 */
export function canReadListingPrivatePhones(user, listing) {
  if (!user?.email || !listing) return false;
  if (isStaffRole(user.role)) return true;
  const u = String(user.email).toLowerCase().trim();
  const seller = String(listing.sellerEmail || "").toLowerCase().trim();
  return normalizeStaffRole(user.role) === "seller" && seller && seller === u;
}

/** Strip broker phone from listing objects returned to the public map / discovery. */
export function sanitizePublicListing(listing) {
  if (!listing || typeof listing !== "object") return listing;
  return { ...listing, contact: "" };
}
