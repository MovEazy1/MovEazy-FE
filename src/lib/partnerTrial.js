/**
 * Trial Premium (MovEazy-BE/supabase/partner_trial.sql): every Premium
 * feature, free, for brokers the CRM adds by email — not unlimited MovEazy
 * leads. The CRM sets days left, adds +10 / +20, or ends it; the partner app
 * hears about it through partner_status().trial.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/* CRM */
export const fetchTrials = () => rpc("crm_trial_list").then((r) => r ?? []);
export const addTrials = (emails) => rpc("crm_trial_add", { p_emails: emails });
export const setTrialDays = (email, days) => rpc("crm_trial_set_days", { p_email: email, p_days: Number(days) });
export const addTrialDays = (email, days) => rpc("crm_trial_add_days", { p_email: email, p_days: days });
export const endTrial = (email) => rpc("crm_trial_end", { p_email: email });

/* Partner */
export const trialSeen = (what) => rpc("partner_trial_seen", { p_what: what });

/** Emails out of whatever was pasted: commas, spaces, new lines. */
export function parseEmails(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Which pop-up the partner should see now, if any: ended, then welcome, then extended. */
export function trialPopup(trial) {
  if (!trial) return null;
  if (trial.ended_due) return { kind: "ended" };
  if (trial.welcome_due) return { kind: "welcome", days: trial.days_left };
  if (trial.extended_days > 0) return { kind: "extended", days: trial.extended_days, left: trial.days_left };
  return null;
}

/** From this many days left, the Home chip turns into a warning. */
export const TRIAL_WARN_DAYS = 5;

export const daysLabel = (n) => `${n} day${n === 1 ? "" : "s"}`;

/** The words the CRM asked for, verbatim. */
export const extendedMessage = (days) =>
  `Congratulations, your Trial Premium Pack is Extended by ${days} Day${days === 1 ? "" : "s"}. Enjoy all the premium and make the most of this time.`;
