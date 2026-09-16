/**
 * Counting the top of the marketing funnel.
 *
 * Every step below "Visitors" can be reconstructed later from the account rows —
 * lib/attribution.js stamps the first touch onto the profile at signup, and the
 * dashboards join on it. Clicks and unique visitors cannot: the overwhelming
 * majority of people who tap a link in a Facebook group or a WhatsApp forward
 * never create an account, and if the arrival isn't written down as it happens
 * there is nothing left to count. A channel that produced 400 opens and two
 * signups is a useful fact; without this it looks identical to one that produced
 * two of each.
 *
 * The write goes through public.record_marketing_click(), a security-definer
 * function, for the same reason share opens do: the visitor has no session, and
 * opening the table to anonymous inserts would let anyone forge the numbers the
 * channel owners are judged on. The function resolves the campaign itself, so an
 * unrecognised one is a silent no-op and this file needs no channel list.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { anonId } from "./sessionSync";
import { readUtm } from "./shareAttribution";

/** Per-tab, so a new visit in a new tab counts — matching how people share. */
const SEEN_KEY = "moveazy_marketing_click";

function alreadyCounted(campaign) {
  try {
    return sessionStorage.getItem(SEEN_KEY) === campaign;
  } catch {
    return false;
  }
}

function markCounted(campaign) {
  try {
    sessionStorage.setItem(SEEN_KEY, campaign);
  } catch {
    /* private mode — Postgres still drops repeats inside its dedupe window */
  }
}

/**
 * Record an arrival if this page load carries a tracked campaign.
 *
 * Silent and best-effort throughout: a visitor must never see a marketing
 * counter fail, and a blocked write is not worth a console error.
 */
export async function recordMarketingClickFromUrl() {
  if (typeof window === "undefined") return null;

  const campaign = new URLSearchParams(window.location.search).get("utm_campaign");
  if (!campaign) return null;

  const trimmed = String(campaign).trim().slice(0, 120);
  if (!trimmed || alreadyCounted(trimmed)) return null;
  if (!isSupabaseConfigured || !supabase) return null;

  // Mark before the call, not after: a failure that left this unmarked would
  // retry on every re-render for as long as the parameters stay in the URL.
  markCounted(trimmed);

  try {
    const { data } = await supabase.rpc("record_marketing_click", {
      p_campaign: trimmed,
      p_anon_id: anonId(),
      p_landing_path: String(window.location.pathname + window.location.search).slice(0, 300),
      p_referrer: typeof document !== "undefined" ? String(document.referrer || "").slice(0, 300) : "",
      p_utm: readUtm(),
    });
    return data || null;
  } catch {
    return null;
  }
}
