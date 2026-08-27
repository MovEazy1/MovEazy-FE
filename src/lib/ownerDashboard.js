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
