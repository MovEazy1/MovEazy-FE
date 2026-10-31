/**
 * Mobile verification by SMS one-time code, on Supabase Auth.
 *
 * Signed out: the code signs them in with their number (a phone account), so
 * what they book afterwards belongs to an account the CRM can see.
 * Signed in already (Google): the code attaches the verified number to that
 * account instead of starting a second one.
 *
 * Needs Supabase → Authentication → Providers → Phone switched on with an SMS
 * provider. Until it is, `phoneOtpAvailable()` is false and callers fall back
 * to Google sign-in, so a page using this never dead-ends.
 */
import { supabase, isSupabaseConfigured, getSupabaseAuthSettings } from "./supabase";

export const OTP_LENGTH = 6;
export const RESEND_AFTER_S = 30;

/** "9876543210" → "+919876543210" (Supabase wants E.164). */
export const e164 = (mobile) => `+91${String(mobile || "").replace(/\D/g, "").slice(-10)}`;

/** Is SMS sign-in switched on for this project? Cached with the rest of the auth settings. */
export async function phoneOtpAvailable() {
  if (!isSupabaseConfigured || !supabase) return false;
  const s = await getSupabaseAuthSettings();
  return s?.external?.phone === true;
}

/** Has this account's own number been verified, and is it this one? */
export function accountHasVerifiedMobile(sbUser, mobile) {
  if (!sbUser?.phone || !sbUser?.phone_confirmed_at) return false;
  return String(sbUser.phone).replace(/\D/g, "").slice(-10) === String(mobile || "").replace(/\D/g, "").slice(-10);
}

function friendly(error, fallback) {
  const m = String(error?.message || "");
  if (/rate|too many|security purposes/i.test(m)) return "Too many tries. Please wait a minute and try again.";
  if (/expired|invalid|token/i.test(m)) return "That code didn't match. Check the SMS and try again.";
  if (/disabled|unsupported|provider/i.test(m)) return "SMS verification isn't available right now.";
  if (/already.*(registered|exists)|in use/i.test(m)) return "This number is linked to another MovEazy account. Sign out and verify again to use it.";
  return m || fallback;
}

/** Send the code. `signedIn`: attach to the current account rather than sign in. */
export async function sendOtp(mobile, { signedIn = false, name = "" } = {}) {
  const phone = e164(mobile);
  const { error } = signedIn
    ? await supabase.auth.updateUser({ phone })
    : await supabase.auth.signInWithOtp({ phone, options: { channel: "sms", data: name ? { full_name: name } : undefined } });
  if (error) throw new Error(friendly(error, "Couldn't send the code. Please try again."));
}

/** Check the code. Resolves with the signed-in user. */
export async function verifyOtp(mobile, code, { signedIn = false } = {}) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: e164(mobile), token: String(code || "").trim(), type: signedIn ? "phone_change" : "sms",
  });
  if (error) throw new Error(friendly(error, "Couldn't verify the code. Please try again."));
  return data?.user ?? null;
}
