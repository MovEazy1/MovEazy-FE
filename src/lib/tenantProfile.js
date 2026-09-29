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
 * Kept on this device for now (a design preview); the same shape moves to the
 * user's profile row when the flow goes live.
 */

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

/** linkedin.com/in/<handle>, with or without https / www; anything else isn't a profile. */
export function normalizeLinkedIn(raw) {
  const m = String(raw || "").trim().match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})\/?(?:[?#].*)?$/i);
  return m ? `https://www.linkedin.com/in/${m[1]}` : "";
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

const KEY = (uid) => `moveazy_tenant_profile_${uid || "guest"}`;

export function loadTenantProfile(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || "{}") || {}; } catch { return {}; }
}

export function saveTenantProfile(uid, profile) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(profile)); } catch { /* private mode: keep it in memory */ }
  return profile;
}
