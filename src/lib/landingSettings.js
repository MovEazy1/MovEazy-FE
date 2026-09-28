/**
 * Everything on the landing pages that the team may want to change without a
 * deploy: prices, brokerage shares, owner cost assumptions, headline stats and
 * the "how it works" video links.
 *
 * The authority will be the CRM (Settings → Landing & pricing), read through a
 * public, read-only landing_settings() function. Until that loads — or on a
 * database that doesn't have it yet — the page shows these defaults, so it
 * never renders blank or with a wrong price flashing in.
 */
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

export const LANDING_DEFAULTS = {
  // Broker Premium, per month
  premiumPrice: 1499,
  premiumListPrice: 10000,
  // Brokerage the broker keeps
  avgBrokerage: 25000,
  propertyShare: 50, // MovEazy-posted properties
  clientShare: 70, // clients MovEazy shares with the broker
  // Owner assumptions
  paintMarket: 50000,
  paintMoveazy: 25000,
  paintCycles: 3,
  hourlyValue: 2000,
  vacantDaysWith: 7,
  // Headline stats
  statBrokers: "20+",
  statProperties: "1000+",
  statRating: "4.8/5",
  // "Watch how it works" — empty hides the button
  videoBroker: "",
  videoOwner: "",
};

let cached = null;

const merge = (data) => ({ ...LANDING_DEFAULTS, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== "")) });

export async function fetchLandingSettings({ fresh = false } = {}) {
  if (cached && !fresh) return cached;
  if (!isSupabaseConfigured || !supabase) return LANDING_DEFAULTS;
  try {
    const { data, error } = await supabase.rpc("landing_settings");
    if (error || !data || typeof data !== "object") return cached || LANDING_DEFAULTS;
    cached = merge(data);
    return cached;
  } catch {
    return cached || LANDING_DEFAULTS;
  }
}

/** CRM only (partners.manage): save any subset, keyed as above. Returns the new settings. */
export async function adminSaveProgramSettings(patch) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("admin_set_program_settings", { p: patch });
  if (error) throw error;
  cached = merge(data || {});
  return cached;
}

export function useLandingSettings() {
  const [s, setS] = useState(cached || LANDING_DEFAULTS);
  useEffect(() => {
    let alive = true;
    fetchLandingSettings().then((v) => { if (alive) setS(v); });
    return () => { alive = false; };
  }, []);
  return s;
}
