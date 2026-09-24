/**
 * When a flat can be seen.
 *
 * property_visit_slots stores one timestamp per bookable time and has no end
 * column, so "every day, 8am to 8pm" is not a row — it is 12 hourly rows per
 * day across a rolling window. That expansion used to live inside
 * PropertyVisitSlots, which meant only the edit screen could do it: a flat
 * uploaded through the CRM was published with no bookable time at all, and
 * every visit on it had to be arranged by hand.
 *
 * The rule-to-timestamps arithmetic lives here so the upload form can apply a
 * default the moment a listing exists, and so the part worth testing is
 * testable without a database.
 */
import { addVisitSlot } from "./visits";

/** One bookable time an hour, up to this many visitors each. Not configurable. */
export const VISIT_STEP_MIN = 60;
export const VISIT_CAPACITY = 10;

/** How far a recurring rule reaches, and how far a hand-picked date may go. */
export const DATE_WINDOW_DAYS = 7;
export const CUSTOM_PICKER_DAYS = 45;

/**
 * What a property gets if nobody says otherwise.
 *
 * Open rather than empty: a listing with no times offers a tenant only "next
 * available slot", which is a message to answer instead of a booking to keep.
 * Wide enough that the common case needs no editing, and an agent who knows
 * the real window can narrow it on the property afterwards.
 */
export const DEFAULT_VISIT_RULE = { mode: "everyday", fromT: "08:00", toT: "20:00" };

export const VISIT_MODES = [
  ["everyday", "Every day"],
  ["weekday", "Weekdays"],
  ["weekend", "Weekends"],
];

/**
 * Local-calendar YYYY-MM-DD.
 *
 * Deliberately not toISOString(), which converts through UTC and shifts the
 * date backward for any zone ahead of UTC: local midnight in IST is the
 * previous UTC day, so every "today" would be filed as yesterday.
 */
export function localYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "HH:MM" to minutes past midnight, or NaN. */
export function toMin(hhmm) {
  // Number("") is 0, so an empty <input type="time"> would otherwise read as
  // midnight and silently generate a full day of slots — demand real HH:MM.
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
}

export function toHHMM(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** The hourly start times inside a from–to window. */
export function buildTimes(from, to) {
  const a = toMin(from);
  const b = toMin(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return [];
  const out = [];
  for (let t = a; t + VISIT_STEP_MIN <= b; t += VISIT_STEP_MIN) out.push(toHHMM(t));
  return out;
}

/** The dates a recurring mode covers, within the rolling window. */
export function datesForMode(mode, now = new Date()) {
  const out = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < DATE_WINDOW_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dow = d.getDay(); // 0 = Sun … 6 = Sat
    const isWeekend = dow === 0 || dow === 6;
    if (mode === "everyday" || (mode === "weekday" && !isWeekend) || (mode === "weekend" && isWeekend)) {
      out.push(localYMD(d));
    }
  }
  return out;
}

/** The next CUSTOM_PICKER_DAYS calendar days, for a tappable date grid. */
export function upcomingDays(now = new Date()) {
  const out = [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < CUSTOM_PICKER_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

/** Where a remembered recurring rule lives (this browser only). */
export const recurringRuleKey = (propertyId) => `moveazy_visit_recur_${propertyId}`;

export function rememberVisitRule(propertyId, rule) {
  if (!propertyId) return;
  try {
    if (!rule || rule.mode === "custom") localStorage.removeItem(recurringRuleKey(propertyId));
    else localStorage.setItem(recurringRuleKey(propertyId), JSON.stringify(rule));
  } catch { /* localStorage unavailable — renewal just won't be remembered */ }
}

export function readVisitRule(propertyId) {
  if (!propertyId) return null;
  try {
    const raw = localStorage.getItem(recurringRuleKey(propertyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

/**
 * Every bookable timestamp a rule produces, as ISO strings.
 *
 * `skipDates` is what makes topping up a rolling window idempotent: the dates
 * already covered are left alone rather than re-inserted and bounced off the
 * unique index.
 */
export function slotTimestamps(rule, { now = new Date(), skipDates = [] } = {}) {
  if (!rule) return [];
  const times = buildTimes(rule.fromT, rule.toT);
  if (!times.length) return [];
  const skip = new Set(skipDates);
  const dates = (rule.mode === "custom" ? (rule.dates ?? []) : datesForMode(rule.mode, now))
    .filter((d) => !skip.has(d));
  const out = [];
  for (const d of dates) {
    for (const t of times) {
      const at = new Date(`${d}T${t}`);
      if (Number.isFinite(at.getTime())) out.push(at.toISOString());
    }
  }
  return out;
}

/**
 * Write a rule's slots.
 *
 * A time that already exists is not a failure — (property_id, slot_at) is
 * unique, and re-applying a rule over a window that partly exists is the
 * normal case, not an error to surface.
 */
export async function applyVisitRule(propertyId, rule, { now = new Date(), skipDates = [] } = {}) {
  if (!propertyId) return { added: 0, skipped: 0, failed: 0 };
  const stamps = slotTimestamps(rule, { now, skipDates });
  let added = 0;
  let skipped = 0;
  let failed = 0;
  let lastError = null;
  for (const iso of stamps) {
    try {
      await addVisitSlot(propertyId, iso, VISIT_CAPACITY);
      added += 1;
    } catch (e) {
      const m = String(e?.message || "").toLowerCase();
      if (m.includes("duplicate") || m.includes("unique")) skipped += 1;
      else { failed += 1; lastError = e; }
    }
  }
  return { added, skipped, failed, lastError };
}
