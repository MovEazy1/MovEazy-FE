import { supabase, isSupabaseConfigured } from "./supabase";
import { fetchPublishedInventory } from "./inventory";
import { matchRequirementToListings, normalizeRequirement } from "./inventoryMatch";

/**
 * Recommendation retrieval for the /recommendations (Helium-style) page.
 *
 * Primary path: the public.recommend_inventory(req, min_score) RPC scores + filters
 * inventory in the backend (see MovEazy-BE/supabase/recommend_inventory.sql). If that
 * function isn't deployed yet, we fall back to fetching published inventory and
 * scoring it client-side with the identical logic in inventoryMatch.js — so the page
 * works either way and both paths agree.
 *
 * @returns {Promise<Array<{listing, score, reasons, source}>>} ranked best-first
 */
export async function recommendInventory(prefs, { min = 30 } = {}) {
  if (!isSupabaseConfigured || !supabase) return [];
  const req = normalizeRequirement(prefs);

  // 1) Backend RPC
  try {
    const { data, error } = await supabase.rpc("recommend_inventory", { req, min_score: min });
    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        listing: row.listing,
        score: Number(row.match_score) || 0,
        reasons: row.match_reasons || [],
        source: "backend",
      }));
    }
  } catch { /* fall through to client scoring */ }

  // 2) Client fallback — identical scoring, run against fetched inventory.
  try {
    const inventory = await fetchPublishedInventory();
    return matchRequirementToListings(prefs, inventory, { min }).map((m) => ({
      listing: m.listing,
      score: m.score,
      reasons: m.reasons,
      source: "client",
    }));
  } catch {
    return [];
  }
}
