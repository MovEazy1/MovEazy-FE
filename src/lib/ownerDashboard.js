import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * Performance stats for every property the signed-in user has posted (as owner,
 * tenant, or broker via /list-my-flat) — shortlists, views, visit requests/bookings,
 * and reactions. Consumed by pages/MyProperties.jsx ("My Properties", /my-properties)
 * to add a shortlist count alongside its existing view/visit-slot stats. Backed by the
 * public.my_listing_stats() RPC (see MovEazy-BE/supabase/owner_dashboard_stats.sql),
 * which is scoped server-side to the caller's own poster_id so it never needs broader
 * read access to other users' data.
 */
export async function fetchMyListingStats() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("my_listing_stats");
  if (error) {
    console.error("my_listing_stats failed:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Individual timestamped events (likes, visit requests, visit bookings) on the
 * signed-in user's own properties — the data behind the notification bell in
 * MovEazyNav.jsx. Backed by public.my_recent_activity() (see
 * MovEazy-BE/supabase/owner_notifications.sql), which is scoped server-side to
 * the caller's own poster_id.
 */
export async function fetchRecentActivity({ days = 14, limit = 50 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("my_recent_activity", { days, limit_n: limit });
  if (error) {
    console.error("my_recent_activity failed:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Booked visits on one property the signed-in user posted, nearest first.
 * Backed by public.my_property_visits() (MovEazy-BE/supabase/owner_notifications.sql):
 * visit_bookings is RLS'd to the renter who booked, so a poster can only see
 * their own listing's visits through that security-definer function. Returns
 * times and headcounts only — never who booked.
 */
export async function fetchPropertyVisits(propertyId) {
  if (!isSupabaseConfigured || !supabase || !propertyId) return [];
  const { data, error } = await supabase.rpc("my_property_visits", { pid: propertyId });
  if (error) {
    console.error("my_property_visits failed:", error.message);
    return [];
  }
  return data || [];
}
