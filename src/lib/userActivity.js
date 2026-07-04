const BOOKINGS_KEY = "moveasy_bookings";
const FILTER_HISTORY_ROOT = "moveasy_filter_history_v2";
const SAVED_ROOT = "moveasy_saved_listings_v2";
const MAP_RESTORE_KEY = "moveasy_map_restore_v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function storageUserKey(user) {
  return (user?.email || "guest").toLowerCase().trim();
}

/** --- Saved listings (per browser user key) --- */

export function getSavedMap(user) {
  const root = readJson(SAVED_ROOT, {});
  const key = storageUserKey(user);
  return root[key] || [];
}

export function isListingSaved(user, listingId) {
  return getSavedMap(user).some((r) => String(r.listingId) === String(listingId));
}

/** `listingSnapshot` is either a title string (legacy callers) or a full listing object
 * (title/image/rent/address) to store alongside the save so it can be rendered later. */
export function toggleSavedListing(user, listingId, listingSnapshot) {
  const root = readJson(SAVED_ROOT, {});
  const key = storageUserKey(user);
  const list = root[key] || [];
  const exists = list.findIndex((r) => String(r.listingId) === String(listingId));
  if (exists >= 0) {
    list.splice(exists, 1);
  } else {
    const listing = typeof listingSnapshot === "string" ? { title: listingSnapshot } : (listingSnapshot || null);
    list.unshift({ listingId: String(listingId), savedAt: new Date().toISOString(), listing });
  }
  root[key] = list;
  writeJson(SAVED_ROOT, root);
  return exists < 0;
}

/** --- Filter search history --- */

export function getFilterHistory(user) {
  const root = readJson(FILTER_HISTORY_ROOT, {});
  return root[storageUserKey(user)] || [];
}

export function appendFilterHistory(user, snapshot) {
  const key = storageUserKey(user);
  const root = readJson(FILTER_HISTORY_ROOT, {});
  const prev = root[key] || [];
  const entry = {
    ...snapshot,
    at: new Date().toISOString(),
  };
  const next = [entry, ...prev].slice(0, 35);
  root[key] = next;
  writeJson(FILTER_HISTORY_ROOT, root);
}

/** --- Restore map search from My Activity --- */

export function setMapRestorePayload(payload) {
  sessionStorage.setItem(MAP_RESTORE_KEY, JSON.stringify(payload));
}

export function consumeMapRestorePayload() {
  const raw = sessionStorage.getItem(MAP_RESTORE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(MAP_RESTORE_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** --- Interest / apply (shared with Customer dashboard bookings list) --- */

export function appendInterestApplication(user, payload) {
  const {
    listingId,
    listingTitle,
    seller,
    contact,
    sellerEmail = "",
    tenancyPreference = "entire_unit",
    adultsSharing = 1,
    notes = "",
  } = payload;
  const arr = readJson(BOOKINGS_KEY, []);
  const email = (user?.email || "").trim() || "guest@local.moveasy";
  const name = (user?.name || "").trim() || "Guest";
  const filtered = arr.filter(
    (b) => !(String(b.listingId) === String(listingId) && String(b.customerEmail || "").toLowerCase() === email.toLowerCase())
  );
  const row = {
    listingId,
    listingTitle,
    customerName: name,
    customerEmail: email,
    seller: seller || "",
    contact: contact || "",
    sellerEmail: sellerEmail || "",
    date: new Date().toISOString(),
    status: "Submitted",
    tenancyPreference,
    adultsSharing: Math.max(1, Math.min(6, Number(adultsSharing) || 1)),
    notes: String(notes || "").slice(0, 500),
  };
  filtered.unshift(row);
  writeJson(BOOKINGS_KEY, filtered);
  return row;
}

export function getBookings() {
  return readJson(BOOKINGS_KEY, []);
}

/** Keeps local “My bookings” in sync when admin updates CRM status (same browser). */
export function syncBookingApplicationStatus(customerEmail, listingId, statusCode, statusLabel) {
  const em = String(customerEmail || "").toLowerCase().trim();
  if (!em) return;
  const arr = readJson(BOOKINGS_KEY, []);
  const next = arr.map((b) => {
    if (String(b.listingId) === String(listingId) && String(b.customerEmail || "").toLowerCase() === em) {
      return { ...b, status: statusLabel, applicationStatusCode: statusCode };
    }
    return b;
  });
  writeJson(BOOKINGS_KEY, next);
}
