/**
 * The tenant profile and its score.
 *
 * A fuller profile gets a tenant flats faster — owners and brokers pick
 * profiles they can trust — so every field carries points and the score is
 * shown back to the tenant as they go.
 *
 *   name, verified mobile       come from sign-up          10 + 10
 *   LinkedIn profile                                       10
 *   current company                                        15
 *   past company (or "first job")                          10
 *   college                                                10
 *   graduation year                                         5
 *   in Bangalore since                                     10
 *   married / single                                       10
 *                                                         ----
 *   every field filled                                     90  Excellent
 *   every field filled, and a family (married)            100  Outstanding
 *
 * Stored in public.tenant_profiles — see Storage below.
 */

import { supabase, isSupabaseConfigured } from "./supabase";

export const STATUS = [
  { value: "single", label: "Single", sub: "Bachelor / spinster", family: false },
  { value: "married", label: "Married", sub: "With your partner", family: true },
  { value: "family", label: "Married with kids", sub: "Family", family: true },
];

export const FIRST_JOB = "__first_job__";

export const FIELDS = [
  { key: "name", label: "Full name", points: 10, fromSignup: true },
  { key: "phone", label: "Verified mobile", points: 10, fromSignup: true },
  { key: "linkedin", label: "LinkedIn", points: 10 },
  { key: "currentCompany", label: "Current company", points: 15 },
  { key: "pastCompany", label: "Past company", points: 10 },
  { key: "college", label: "College", points: 10 },
  { key: "graduationYear", label: "Graduation year", points: 5 },
  { key: "inBangaloreSince", label: "In Bangalore since", points: 10 },
  { key: "maritalStatus", label: "Married / single", points: 10 },
];

/** The screens of the profile flow, in order; a screen can ask for more than one field. */
export const PROFILE_STEPS = [
  { id: "linkedin", fields: ["linkedin"] },
  { id: "currentCompany", fields: ["currentCompany"] },
  { id: "pastCompany", fields: ["pastCompany"] },
  { id: "education", fields: ["college", "graduationYear"] },
  { id: "inBangaloreSince", fields: ["inBangaloreSince"] },
  { id: "maritalStatus", fields: ["maritalStatus"] },
];

export const FAMILY_BONUS = 10;
export const pointsOf = (key) => FIELDS.find((f) => f.key === key)?.points ?? 0;
export const stepPoints = (step) => step.fields.reduce((n, k) => n + pointsOf(k), 0);

/**
 * A LinkedIn profile, however it's pasted: the full link (with or without
 * https, www or a country prefix, and with the share-link tracking or a
 * /details/... tail the LinkedIn app adds), "/in/handle", "@handle", or just
 * the handle — the ID people usually type. Returns the canonical link, or ""
 * if it isn't a profile (a company page, a post, a sentence).
 */
export function normalizeLinkedIn(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  const handle = (h) => {
    let x = h;
    try { x = decodeURIComponent(h); } catch { /* keep as typed */ }
    x = x.trim();
    // LinkedIn IDs are letters, digits and hyphens (3–100); anything else is encoded.
    if (!/^[\p{L}\p{M}\p{N}_-]{3,100}$/u.test(x)) return "";
    return `https://www.linkedin.com/in/${encodeURIComponent(x)}`;
  };
  const url = v.match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)(?:[/?#].*)?$/i);
  if (url) return handle(url[1]);
  if (/linkedin\.com/i.test(v) || /[\s/.]/.test(v.replace(/^\/?in\//i, "").replace(/\/$/, ""))) return "";
  return handle(v.replace(/^@/, "").replace(/^\/?in\//i, "").replace(/\/$/, ""));
}

const filled = (key, v) => {
  if (v === undefined || v === null || String(v).trim() === "") return false;
  if (key === "linkedin") return normalizeLinkedIn(v) !== "";
  return true;
};

export const isFilled = (profile, key) => filled(key, profile?.[key]);
export const isFamily = (profile) => STATUS.some((s) => s.value === profile?.maritalStatus && s.family);

/** 0–100, and whether every field is in. */
export function profileScore(profile = {}) {
  let score = 0;
  let complete = true;
  for (const f of FIELDS) {
    if (filled(f.key, profile[f.key])) score += f.points;
    else complete = false;
  }
  if (complete && isFamily(profile)) score += FAMILY_BONUS;
  return { score, complete };
}

export function scoreLabel(score) {
  if (score >= 100) return "Outstanding";
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Great";
  if (score >= 40) return "Good";
  return "Getting started";
}

/** Screens with anything still missing, in the order the flow asks. */
export const missingSteps = (profile = {}) => PROFILE_STEPS.filter((s) => s.fields.some((k) => !filled(k, profile[k])));

export const pastCompanyLabel = (v) => (v === FIRST_JOB ? "First job" : v || "");
export const statusLabel = (v) => STATUS.find((s) => s.value === v)?.label || "";

/* ── Storage ──────────────────────────────────────────────────────────────
 * public.tenant_profiles (MovEazy-BE/supabase/tenant_profile_schema.sql) is
 * the record — the database also works out the score there, so the owner-facing
 * verification portal never trusts a number from a browser. The device keeps a
 * copy so the home paints instantly and survives a failed save.
 */

const KEY = (uid) => `moveazy_tenant_profile_${uid || "guest"}`;

export function loadTenantProfile(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || "{}") || {}; } catch { return {}; }
}

export function cacheTenantProfile(uid, profile) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(profile)); } catch { /* private mode: keep it in memory */ }
  return profile;
}

/** Row → the flow's shape. Name and mobile aren't stored here; they come from sign-up. */
export function fromRow(r) {
  if (!r) return {};
  const p = {
    linkedin: r.linkedin || "",
    currentCompany: r.current_company || "",
    pastCompany: r.first_job ? FIRST_JOB : r.past_company || "",
    college: r.college || "",
    graduationYear: r.graduation_year ? String(r.graduation_year) : "",
    inBangaloreSince: r.in_bangalore_since || "",
    maritalStatus: r.marital_status || "",
  };
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== ""));
}

/** The flow's shape → row. Empty fields go as empty, so clearing one sticks. */
export function toRow(uid, p = {}) {
  const t = (v) => String(v ?? "").trim();
  const year = parseInt(p.graduationYear, 10);
  return {
    user_id: uid,
    linkedin: normalizeLinkedIn(p.linkedin),
    current_company: t(p.currentCompany).slice(0, 120),
    past_company: p.pastCompany === FIRST_JOB ? "" : t(p.pastCompany).slice(0, 120),
    first_job: p.pastCompany === FIRST_JOB,
    college: t(p.college).slice(0, 160),
    graduation_year: Number.isFinite(year) && year >= 1950 && year <= 2100 ? year : null,
    in_bangalore_since: t(p.inBangaloreSince).slice(0, 30),
    marital_status: STATUS.some((s) => s.value === p.maritalStatus) ? p.maritalStatus : "",
  };
}

/** The signed-in tenant's saved profile, or the device copy if the database can't be reached. */
export async function fetchMyTenantProfile(uid) {
  if (!uid) return {};
  if (!isSupabaseConfigured || !supabase) return loadTenantProfile(uid);
  const { data, error } = await supabase.from("tenant_profiles").select("*").eq("user_id", uid).maybeSingle();
  if (error) return loadTenantProfile(uid);
  const profile = data ? fromRow(data) : loadTenantProfile(uid);
  cacheTenantProfile(uid, profile);
  return profile;
}

/** Save to the database (and the device). Throws if the database refused it. */
export async function saveMyTenantProfile(uid, profile) {
  const { name, phone, ...fields } = profile || {};
  void name; void phone;
  cacheTenantProfile(uid, fields);
  if (!uid || !isSupabaseConfigured || !supabase) return fields;
  const { error } = await supabase.from("tenant_profiles").upsert(toRow(uid, fields), { onConflict: "user_id" });
  if (error) throw error;
  return fields;
}
