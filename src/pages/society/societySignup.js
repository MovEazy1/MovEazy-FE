/**
 * Kept on the device through the Google round trip: the mobile number typed
 * on the login screen, an invite link opened before signing in, and whether
 * the splash was seen.
 */
import { normalizeIndianMobile } from "../../lib/mobile";

const PHONE_KEY = "mz_society_signup";
const INVITE_KEY = "mz_society_invite";
const SPLASH_KEY = "mz_society_splash";
const TTL = 24 * 60 * 60 * 1000;

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export function rememberSocietyPhone(raw) {
  const phone = normalizeIndianMobile(raw);
  if (phone) write(PHONE_KEY, { phone, at: Date.now() });
  return phone;
}
export function pendingSocietyPhone() {
  const p = read(PHONE_KEY);
  return p && Date.now() - p.at < TTL ? normalizeIndianMobile(p.phone) : "";
}
export const clearPendingSocietyPhone = () => drop(PHONE_KEY);

export const rememberInvite = (token) => write(INVITE_KEY, { token, at: Date.now() });
export function pendingInvite() {
  const p = read(INVITE_KEY);
  return p && Date.now() - p.at < 7 * TTL ? p.token : "";
}
export const forgetInvite = () => drop(INVITE_KEY);

export const splashSeen = () => Boolean(read(SPLASH_KEY));
export const markSplashSeen = () => write(SPLASH_KEY, 1);
