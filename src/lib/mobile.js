/**
 * One definition of an Indian mobile number.
 *
 * Two gates now ask for a number — RequirePhoneFirst before signup and
 * RequirePhoneModal after it — and public.normalize_mobile() checks it a third
 * time at the database. Three copies of "what counts as a valid number" is two
 * too many: a rule that drifts between them is a number accepted by one screen
 * and rejected by the next.
 */

/** 10 digits starting 6-9, tolerating spaces and a +91 prefix. '' if invalid. */
export function normalizeIndianMobile(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}

/** "98765 43210" — the spacing Indian numbers are normally read in. */
export function formatForDisplay(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}
