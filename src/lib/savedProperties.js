import { isSupabaseConfigured } from "./supabase";
import {
  addSavedPropertyData,
  removeSavedPropertyData,
  getSavedPropertiesForCustomer,
} from "./firestoreStore";
import { getSavedMap, isListingSaved as isListingSavedLocal, toggleSavedListing as toggleSavedListingLocal } from "./userActivity";

/**
 * Saved listings now persist to the `saved_properties` Supabase table for
 * signed-in customers (so they follow the account across devices/browsers),
 * with the older localStorage store (lib/userActivity.js) kept only as the
 * fallback for guests or when Supabase isn't configured.
 */
function canUseRemote(user) {
  return Boolean(user?.uid) && isSupabaseConfigured;
}

export async function isPropertySaved(user, listingId) {
  if (!canUseRemote(user)) return isListingSavedLocal(user, listingId);
  const rows = await getSavedPropertiesForCustomer(user.uid);
  return rows.some((r) => String(r.listing_id) === String(listingId));
}

/**
 * Toggles save state for a full listing object (needs at least `.id`, ideally also
 * `.title`/`.image`/`.monthlyRent`/`.address` so it can be shown later without a
 * separate catalog lookup — the flat-agent's catalog isn't queryable by id from
 * the frontend). Returns true if the listing is now saved, false if removed.
 * Falls back to the local store on any remote failure (e.g. the `saved_properties`
 * table hasn't been created yet in this Supabase project — see customer_schema.sql)
 * so the button still works instead of silently doing nothing.
 */
export async function toggleSavedProperty(user, listing) {
  const listingId = listing?.id;
  if (!canUseRemote(user)) return toggleSavedListingLocal(user, listingId, listing);
  try {
    const rows = await getSavedPropertiesForCustomer(user.uid);
    const exists = rows.some((r) => String(r.listing_id) === String(listingId));
    if (exists) {
      await removeSavedPropertyData(user.uid, listingId);
      return false;
    }
    await addSavedPropertyData({ listingId, listingTitle: listing?.title || "", listingData: listing, customerId: user.uid });
    return true;
  } catch (err) {
    console.error("Saved-property sync failed, falling back to local storage:", err);
    return toggleSavedListingLocal(user, listingId, listing);
  }
}

/** All saved listings for the Profile "Saved" tab: remote rows for a signed-in
 * customer, merged with any not-yet-synced local ones (e.g. saved while signed out).
 * Each row's `listing` is the snapshot captured at save time (may be missing for
 * saves made before that snapshot was introduced). */
export async function getSavedPropertiesMerged(user) {
  const local = getSavedMap(user).map((r) => ({
    listingId: String(r.listingId),
    savedAt: r.savedAt,
    listing: r.listing || null,
  }));
  if (!canUseRemote(user)) return local;
  const remote = await getSavedPropertiesForCustomer(user.uid).catch(() => []);
  const byId = new Map(local.map((r) => [r.listingId, r]));
  for (const row of remote) {
    byId.set(String(row.listing_id), {
      listingId: String(row.listing_id),
      savedAt: row.created_at,
      listing: row.listing_data || (row.listing_title ? { title: row.listing_title } : null),
    });
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}
