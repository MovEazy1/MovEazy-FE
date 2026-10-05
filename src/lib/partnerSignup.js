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

/** Remember where this visitor came from, the first time only. `hint` names a channel the URL can't (e.g. group_invite). */
export function captureSource(hint = "") {
  if (typeof window === "undefined") return null;
  const have = read(SOURCE_KEY);
  const q = new URLSearchParams(window.location.search);
  const ref = (q.get("ref") || "").trim().toUpperCase().slice(0, 12);
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, (q.get(k) || "").slice(0, 100)]).filter(([, v]) => v));
  // A referral link is worth recording even over an earlier plain visit.
  if (have && !(ref && !have.ref)) return have;
  let channel = hint || (ref ? "referral" : utm.utm_source || q.get("src") || "");
  if (!channel) {
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      channel = host && !/moveazy\.co\.in$/.test(host) ? host : "direct";
    } catch {
      channel = "direct";
    }
  }
  const src = { channel: channel.slice(0, 40), ref: ref || have?.ref || "", utm: Object.keys(utm).length ? utm : have?.utm || {}, at: Date.now() };
  write(SOURCE_KEY, src);
  return src;
}

export const signupSource = () => read(SOURCE_KEY) || { channel: "direct", ref: "", utm: {} };

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
