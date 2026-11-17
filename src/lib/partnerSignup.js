/**
 * "Become Partner": the number first, then Google.
 *
 * The number a visitor types is recorded straight away (partner_prospect — so
 * an abandoned Google step still shows in the funnel as "number filled") and
 * kept on the device through the Google round trip. Back in the partner app,
 * the gate saves it to the account (no second phone prompt) and stamps where
 * the partner came from (partner_signup_meta).
 *
 * Where they came from is first-touch: the first landing's ?ref= referral
 * code, utm_* tags or channel hint is kept until they sign up.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { normalizeIndianMobile } from "./mobile";

const PENDING_KEY = "mz_partner_signup";
const SOURCE_KEY = "mz_partner_src";
const PENDING_TTL = 24 * 60 * 60 * 1000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

/**
 * A partner's referral link counts for 24 hours, in this browser, on every
 * MovEazy site: kept in a cookie for .moveazy.co.in as well as this site's
 * storage, so a broker who opens the link on partners.moveazy.co.in and signs
 * up a few hours later on www.moveazy.co.in (or the other way round) is still
 * theirs. After 24 hours it is dropped (and the database won't credit a link
 * to anyone who was a partner before it — partner_referral_mapping.sql).
 */
export const REF_TTL = 24 * 60 * 60 * 1000;
const REF_COOKIE = "mz_partner_ref";
const cookieDomain = () => {
  try { return /(^|\.)moveazy\.co\.in$/.test(window.location.hostname) ? "; Domain=.moveazy.co.in" : ""; } catch { return ""; }
};
function writeRefCookie(code, at) {
  try {
    document.cookie = `${REF_COOKIE}=${encodeURIComponent(`${code}.${at}`)}; Max-Age=${REF_TTL / 1000}; Path=/; SameSite=Lax${cookieDomain()}${window.location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* cookies off */ }
}
/** The referral this browser opened within 24 hours, from any MovEazy site: { ref, at } or null. */
export function refFromCookie(cookie = typeof document === "undefined" ? "" : document.cookie, now = Date.now()) {
  const m = new RegExp(`(?:^|;\\s*)${REF_COOKIE}=([^;]+)`).exec(cookie || "");
  if (!m) return null;
  const [code, at] = decodeURIComponent(m[1]).split(".");
  const ref = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return ref && now - Number(at) < REF_TTL ? { ref, at: Number(at) } : null;
}

/** Remember where this visitor came from, the first time only. `hint` names a channel the URL can't (e.g. group_invite). */
export function captureSource(hint = "") {
  if (typeof window === "undefined") return null;
  const have = read(SOURCE_KEY);
  const q = new URLSearchParams(window.location.search);
  const ref = (q.get("ref") || "").trim().toUpperCase().slice(0, 12);
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, (q.get(k) || "").slice(0, 100)]).filter(([, v]) => v));
  // A referral link is worth recording even over an earlier plain visit — or over a
  // referral whose 24 hours are up. The first link stands while it lasts.
  const haveRefLive = Boolean(have?.ref) && Date.now() - Number(have.refAt || have.at || 0) < REF_TTL;
  if (have && (!ref || haveRefLive)) return have;
  let channel = hint || (ref ? "referral" : utm.utm_source || q.get("src") || "");
  if (!channel) {
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      channel = host && !/moveazy\.co\.in$/.test(host) ? host : "direct";
    } catch {
      channel = "direct";
    }
  }
  const now = Date.now();
  const src = {
    channel: channel.slice(0, 40), ref: ref || have?.ref || "", refAt: ref ? now : have?.refAt || have?.at || now,
    utm: Object.keys(utm).length ? utm : have?.utm || {}, at: now,
  };
  write(SOURCE_KEY, src);
  if (ref) writeRefCookie(ref, now);
  return src;
}

/**
 * Where this visitor came from, as sign-up stamps it. The referral code only
 * while its 24 hours last — from this site's storage, or the cookie a link
 * opened on another MovEazy site left.
 */
export function signupSource(now = Date.now()) {
  const src = read(SOURCE_KEY) || { channel: "direct", ref: "", utm: {} };
  const local = src.ref && now - Number(src.refAt || src.at || 0) < REF_TTL ? src.ref : "";
  const cookie = local ? null : refFromCookie(undefined, now);
  const ref = local || cookie?.ref || "";
  return { ...src, ref, channel: ref && (!src.channel || src.channel === "direct") ? "referral" : src.channel || "direct" };
}

/** The number typed into Become Partner, if it is recent. */
export function pendingSignupPhone() {
  const p = read(PENDING_KEY);
  return p && Date.now() - p.at < PENDING_TTL ? normalizeIndianMobile(p.phone) : "";
}

export function clearPendingSignup() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
}

/** Step one: validate, record and keep the number. Throws a message a person can act on. */
export async function startPartnerSignup(rawPhone) {
  const phone = normalizeIndianMobile(rawPhone);
  if (!phone) throw new Error("Enter a valid 10-digit mobile number.");
  const src = signupSource();
  write(PENDING_KEY, { phone, at: Date.now() });
  if (isSupabaseConfigured && supabase) {
    // Best effort: the funnel row must never stand between a broker and signing up.
    await supabase.rpc("partner_prospect", { p_phone: phone, p_channel: src.channel, p_ref: src.ref, p_utm: src.utm })
      .then(() => {}, () => {});
  }
  return phone;
}

/** After partner_register: stamp channel / referral / UTM and log the funnel steps. */
export async function stampPartnerSignup() {
  if (!isSupabaseConfigured || !supabase) return;
  const src = signupSource();
  await supabase.rpc("partner_signup_meta", { p_channel: src.channel, p_ref: src.ref, p_utm: src.utm }).then(() => {}, () => {});
}

/* ── Joining through a referral link ─────────────────────────────────────── */

/** MovEazy's partner desk: a referred broker joins by talking to it, not by picking a plan. */
export const JOIN_DESK = "8090911024";

/** Did this visitor first arrive on a partner's referral link (?ref=CODE)? */
export const cameByReferral = () => Boolean(signupSource().ref);

/** The WhatsApp a referred broker sends the partner desk. */
export function joinMessage(phone, ref = "") {
  return [
    "Hi, I want to join as a MovEazy partner, help me understand the steps.",
    phone ? `My number: ${phone}` : "",
    ref ? `Referral code: ${ref}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Step one for a referred broker: validate the number, record it against the
 * referral (the funnel's "number filled", credited to the referrer), and hand
 * back the WhatsApp link to the partner desk. Throws a message a person can act on.
 */
export function startReferralJoin(rawPhone) {
  const phone = normalizeIndianMobile(rawPhone);
  if (!phone) throw new Error("Enter a valid 10-digit mobile number.");
  const src = signupSource();
  if (isSupabaseConfigured && supabase) {
    // Not awaited: WhatsApp must open inside the tap, or the browser blocks it.
    supabase.rpc("partner_prospect", { p_phone: phone, p_channel: src.channel || "referral", p_ref: src.ref, p_utm: src.utm })
      .then(() => {}, () => {});
  }
  return `https://wa.me/91${JOIN_DESK}?text=${encodeURIComponent(joinMessage(phone, src.ref))}`;
}
