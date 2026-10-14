/**
 * The partner's own inventory, the pool their AI matching searches, and the
 * upload milestones (MovEazy-BE/supabase/partner_pool_milestones.sql decides;
 * this mirrors what the app needs to show).
 *
 *   complete   6 of the 9 details (FLAT_DETAILS), with rent, BHK, area and a
 *              photo among them — the same rule the server counts
 *   website    a live flat with a photo is on moveazy.co.in
 *   milestones 3 → 10 fresh leads · 10 → "65% more leads" · 20 → 20 fresh
 *              leads · then a streak of 5 complete uploads a day
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { FLAT_DETAILS } from "./partnerTenants";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const hasPhoto = (l) => Boolean(l?.cover_image_url || (l?.images ?? []).some(Boolean));

/** 6 of 9 details, rent + BHK + area + a photo required. */
export function isFlatComplete(l) {
  if (!l || !(Number(l.rent) > 0) || !(l.flat_type || Number(l.bedrooms) > 0) || !String(l.area || "").trim() || !hasPhoto(l)) return false;
  return FLAT_DETAILS.filter(([, , ok]) => ok(l)).length >= 6;
}

/** On moveazy.co.in: live, with a photo. */
export const liveOnWebsite = (l) => l?.status === "published" && hasPhoto(l);

export const fetchPoolCount = () => rpc("partner_pool_count");
/** { complete, total, today, next, plan_ok, milestones: [...], streak: { days, day1, today_done, active } } — also gives a due reward. */
export const fetchUploadProgress = () => rpc("partner_upload_progress");

export const DAILY_GOAL = 5;

/**
 * What the bar on top of My inventory (and the after-upload screen) says, from
 * the progress. Only the next step, never the whole ladder.
 * → { title, body, value, max, reward, streak }
 */
export function nextStep(p) {
  if (!p) return null;
  const n = Number(p.complete) || 0;
  const locked = p.plan_ok === false;
  if (n < 3) {
    return { value: n, max: 3, reward: true,
      title: `${3 - n} more complete flat${3 - n === 1 ? "" : "s"} → 10 fresh leads`,
      body: locked ? "Unlocks on Premium or your free trial." : "We hand you 10 tenants who fit your flats, the moment you reach 3." };
  }
  if (n < 10) {
    return { value: n, max: 10, reward: false,
      title: `${n}/10 flats — partners with 10+ get 65% more leads`,
      body: "Every flat you add is matched to our clients' requirements. There's no limit." };
  }
  if (n < 20) {
    return { value: n, max: 20, reward: true,
      title: `${20 - n} more to 20 → 20 fresh leads`,
      body: locked ? "Unlocks on Premium or your free trial." : "Reach 20 complete flats and 20 more tenants are yours." };
  }
  const s = p.streak || {};
  const days = Number(s.days) || 0;
  const today = Number(p.today) || 0;
  if (s.today_done) {
    return { value: DAILY_GOAL, max: DAILY_GOAL, reward: false, streak: days,
      title: `${days}-day streak 🔥`, body: "Done for today. Upload 5 tomorrow to keep it going." };
  }
  return { value: Math.min(today, DAILY_GOAL), max: DAILY_GOAL, reward: false, streak: days,
    title: today ? `${today}/${DAILY_GOAL} uploaded today` : "No inventory uploaded today",
    body: days ? `Upload ${DAILY_GOAL - today} more to keep your ${days}-day streak.` : `Upload ${DAILY_GOAL} today to start a streak.` };
}

/** A milestone reward given in the last few minutes (to celebrate on the after-upload screen). */
export function justAwarded(p, now = Date.now(), withinMs = 10 * 60 * 1000) {
  return (p?.milestones ?? []).filter((m) => m.awarded_at && now - new Date(m.awarded_at).getTime() < withinMs && Number(m.given) > 0);
}

/* ── The CRM ───────────────────────────────────────────────────────────── */
/** No partner: { user_id: { total, assigned, contacted, visit, closed, not_interested, untouched, own } }. One: their leads. */
export const fetchCrmPartnerLeads = (brokerId = null) => rpc("crm_partner_leads", { p_broker: brokerId });
